import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, SendEmailOutLimitError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import {
  type CreatePurchaseOrderInput,
  type PurchaseOrderQueryInput,
  type ReceivePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
} from '@validators/purchase-order.validator';
import sendPurchaseOrderEmail from './email.service';

const prisma = new PrismaClient();

class PurchaseOrderService {
  private async generatePOCode(): Promise<string> {
    const prefix = 'PO';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.purchaseOrder.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}-${dateStr}-${sequence}`;
  }

  async getAll(query: PurchaseOrderQueryInput) {
    const {
      page = '1',
      limit = '20',
      search = '',
      status,
      supplierId,
      warehouseId,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PurchaseOrderWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { poCode: { contains: search } },
          { supplier: { supplierName: { contains: search } } },
        ],
      }),
      ...(status && { status: status as any }),
      ...(supplierId && { supplierId: parseInt(supplierId) }),
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(fromDate &&
        toDate && {
          orderDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const total = await prisma.purchaseOrder.count({ where });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      select: {
        id: true,
        poCode: true,
        orderDate: true,
        expectedDeliveryDate: true,
        totalAmount: true,
        status: true,
        notes: true,
        subTotal: true,
        taxRate: true,
        supplier: {
          select: {
            id: true,
            supplierName: true,
            supplierCode: true,
            contactName: true,
            phone: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            details: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: skip,
      take: limitNum,
    });

    // Stat Cards
    const cards = {
      pending: await prisma.purchaseOrder.count({ where: { ...where, status: 'pending' } }),
      approved: await prisma.purchaseOrder.count({ where: { ...where, status: 'approved' } }),
      received: await prisma.purchaseOrder.count({ where: { ...where, status: 'received' } }),
      cancelled: await prisma.purchaseOrder.count({ where: { ...where, status: 'cancelled' } }),
    };

    const result = {
      data: purchaseOrders,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      cards,
      message: 'Success',
    };

    return result;
  }

  async getById(id: number) {

    const [po, t] = await Promise.all([
      prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          warehouse: true,
          creator: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          approver: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          details: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  productName: true,
                  unit: true,
                  basePrice: true,
                },
              },
            },
          },
        },
      }),
      prisma.stockTransaction.findFirst({
        where: {
          referenceId: id,
          referenceType: 'purchase_order',
        },
        select: {
          id: true,
        },
      }),
    ]);

    const purchaseOrder = {
      ...po,
      stockTransaction: t,
    };

    if (!purchaseOrder) {
      throw new NotFoundError('Purchase Order');
    }

    return purchaseOrder;
  }

  async create(data: CreatePurchaseOrderInput, userId: number) {
    let supplierId = data.supplierId;
    let validatedSupplier: any = null;

    // Handle Supplier logic
    if (supplierId) {
      validatedSupplier = await prisma.supplier.findUnique({
        where: { id: Number(supplierId) },
      });
      if (!validatedSupplier) {
        throw new NotFoundError('Supplier');
      }
      if (validatedSupplier.status !== 'active') {
        throw new ValidationError('Nhà cung cấp phải ở trạng thái hoạt động để tạo đơn hàng');
      }

      // If newSupplier data is provided while supplierId exists, update the supplier
      if (data.newSupplier) {
        await prisma.supplier.update({
          where: { id: Number(supplierId) },
          data: {
            supplierName: data.newSupplier.name || validatedSupplier.supplierName,
            phone: data.newSupplier.phone || validatedSupplier.phone,
            email: data.newSupplier.email || validatedSupplier.email,
            address: data.newSupplier.address || validatedSupplier.address,
            taxCode: data.newSupplier.taxCode || validatedSupplier.taxCode,
          }
        });
      }
    } else if (data.newSupplier) {
      // Create new supplier
      const newSup = await prisma.supplier.create({
        data: {
          supplierName: data.newSupplier.name || 'Nhà cung cấp mới',
          supplierCode: `NCC-${Date.now()}`,
          supplierType: 'local',
          phone: data.newSupplier.phone || '',
          email: data.newSupplier.email || null,
          address: data.newSupplier.address || null,
          taxCode: data.newSupplier.taxCode || null,
          status: 'active',
          createdBy: userId,
        }
      });
      supplierId = newSup.id;
      validatedSupplier = newSup;
    } else {
      throw new ValidationError('Thông tin nhà cung cấp không hợp lệ. Vui lòng chọn nhà cung cấp hoặc cung cấp thông tin mới.');
    }

    // Validate warehouse - optional, fallback to first warehouse
    let warehouseId = data.warehouseId;
    if (warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) {
        throw new NotFoundError('Warehouse');
      }
    } else {
      // Fallback: use first available warehouse
      const defaultWarehouse = await prisma.warehouse.findFirst();
      if (defaultWarehouse) {
        warehouseId = defaultWarehouse.id;
      }
    }

    // Validate products
    for (const detail of data.details) {
      const product = await prisma.product.findUnique({
        where: { id: detail.productId },
      });
      if (!product) {
        throw new NotFoundError(`Product with ID ${detail.productId}`);
      }
    }

    // Generate PO code
    const poCode = await this.generatePOCode();

    // Calculate total amount
    const subTotal = data.details.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const totalAmount = subTotal + (subTotal * data.taxRate) / 100;

    // Create purchase order
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poCode,
        supplierId: supplierId as number,
        warehouseId: warehouseId as number,
        orderDate: new Date(data.orderDate),
        expectedDeliveryDate: data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : null,
        subTotal,
        totalAmount,
        status: 'pending',
        taxRate: data.taxRate,
        notes: data.notes,
        createdBy: userId,
        details: {
          create: data.details.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
          })),
        },
      },
      include: {
        supplier: true,
        warehouse: true,
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    // Log activity
    logActivity('create', userId, 'purchase_orders', {
      recordId: purchaseOrder.id,
      poCode: purchaseOrder.poCode,
    });

    return purchaseOrder;
  }

  async update(id: number, data: UpdatePurchaseOrderInput, userId: number) {
    const purchaseOrder = await this.getById(id);

    // Only allow update for pending status
    if (purchaseOrder.status !== 'pending') {
      throw new ValidationError('Chỉ đơn mua ở trạng thái chờ duyệt mới có thể update');
    }

    let supplierId = data.supplierId || purchaseOrder.supplierId;
    if (data.supplierId || data.newSupplier) {
      if (data.supplierId) {
        const validatedSupplier = await prisma.supplier.findUnique({
          where: { id: Number(data.supplierId) },
        });
        if (!validatedSupplier) {
          throw new NotFoundError('Supplier');
        }

        if (data.newSupplier) {
          await prisma.supplier.update({
            where: { id: Number(data.supplierId) },
            data: {
              supplierName: data.newSupplier.name || validatedSupplier.supplierName,
              phone: data.newSupplier.phone || validatedSupplier.phone,
              email: data.newSupplier.email || validatedSupplier.email,
              address: data.newSupplier.address || validatedSupplier.address,
              taxCode: data.newSupplier.taxCode || validatedSupplier.taxCode,
            }
          });
        }
        supplierId = Number(data.supplierId);
      } else if (data.newSupplier) {
        const newSup = await prisma.supplier.create({
          data: {
            supplierName: data.newSupplier.name || 'Nhà cung cấp mới',
            supplierCode: `NCC-${Date.now()}`,
            supplierType: 'local',
            phone: data.newSupplier.phone || '',
            email: data.newSupplier.email || null,
            address: data.newSupplier.address || null,
            taxCode: data.newSupplier.taxCode || null,
            status: 'active',
            createdBy: userId,
          }
        });
        supplierId = newSup.id;
      }
    }

    // Validate warehouse if provided
    if (data.warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });
      if (!warehouse) {
        throw new NotFoundError('Warehouse');
      }
    }

    // Calculate total amount if details provided
    let subTotal = purchaseOrder.subTotal;
    if (data.details) {
      // Validate products
      for (const detail of data.details) {
        const product = await prisma.product.findUnique({
          where: { id: detail.productId },
        });
        if (!product) {
          throw new NotFoundError(`Product with ID ${detail.productId}`);
        }
      }

      subTotal = data.details.reduce((sum, item) => new Prisma.Decimal(Number(sum) + Number(item.unitPrice) * item.quantity), new Prisma.Decimal(0));
    }

    const totalAmount = new Prisma.Decimal(Number(subTotal) + (Number(subTotal) * data.taxRate) / 100);

    // Update purchase order
    const updated = await prisma.$transaction(async (tx) => {
      // If details provided, delete old details and create new ones
      if (data.details) {
        await tx.purchaseOrderDetail.deleteMany({
          where: { poId: id },
        });
      }

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId,
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
          ...(data.orderDate && { orderDate: new Date(data.orderDate) }),
          ...(data.expectedDeliveryDate !== undefined && {
            expectedDeliveryDate: data.expectedDeliveryDate
              ? new Date(data.expectedDeliveryDate)
              : null,
          }),
          ...(data.notes !== undefined && { notes: data.notes }),
          taxRate: data.taxRate,
          subTotal,
          totalAmount,
          ...(data.details && {
            details: {
              create: data.details.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                notes: item.notes,
              })),
            },
          }),
        },
        include: {
          supplier: true,
          warehouse: true,
          creator: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          details: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    // Log activity
    logActivity('update', userId, 'purchase_orders', {
      recordId: id,
      poCode: purchaseOrder.poCode,
    });

    return updated;
  }

  async approve(id: number, userId: number, notes?: string) {
    const purchaseOrder = await this.getById(id);

    if (purchaseOrder.status !== 'pending') {
      throw new ValidationError(`Đơn mua ở trạng thái ${purchaseOrder.status}`);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        notes: notes
          ? `${purchaseOrder.notes || ''}\nApproval notes: ${notes}`
          : purchaseOrder.notes,
      },
      include: {
        supplier: true,
        warehouse: true,
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    // Log activity
    logActivity('update', userId, 'purchase_orders', {
      recordId: id,
      poCode: purchaseOrder.poCode,
      action: 'approve',
    });

    return updated;
  }

  async sendEmail(id: number, userId: number) {
    const purchaseOrder = await this.getById(id);

    if (purchaseOrder.status !== 'approved') {
      throw new ValidationError('Đơn đặt hàng phải được phê duyệt.');
    }

    if (purchaseOrder.sendNumber && purchaseOrder.sendNumber >= 3) {
      throw new SendEmailOutLimitError('Không được gửi quá 3 lần email!');
    }

    try {
      await sendPurchaseOrderEmail.sendPurchaseOrderEmail(purchaseOrder);
    } catch (error) {
      throw new Error('Lỗi không gửi được email');
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        sendNumber: (purchaseOrder.sendNumber || 0) + 1,
      },
      include: {
        supplier: true,
        warehouse: true,
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    logActivity('send email', userId, 'purchase_orders', {
      recordId: id,
      poCode: purchaseOrder.poCode,
      action: 'sendEmail',
    });

    return updated;
  }

  async receive(_id: number, _userId: number, _data?: ReceivePurchaseOrderInput) {
    return 1;
    // const purchaseOrder = await this.getById(id);

    // if (purchaseOrder.status !== 'approved') {
    //   throw new ValidationError('Đơn đặt hàng phải được phê duyệt.');
    // }

    // // Use PO details if no custom details provided
    // const receiveDetails =
    //   data?.details ||
    //   purchaseOrder.details.map((d: any) => ({
    //     productId: d.productId,
    //     quantity: Number(d.quantity),
    //     unitPrice: Number(d.unitPrice),
    //     batchNumber: undefined,
    //     expiryDate: undefined,
    //     notes: d.notes || undefined,
    //   }));

    // const result = await prisma.$transaction(async (tx) => {
    //   // Create import stock transaction
    //   // Note: Transaction will be in 'pending' status
    //   const stockTransaction = await stockTransactionService.createImport(
    //     {
    //       warehouseId: purchaseOrder.warehouseId,
    //       referenceType: 'purchase_order',
    //       referenceId: purchaseOrder.id,
    //       reason: `Nhập hàng từ đơn đặt hàng ${purchaseOrder.poCode}`,
    //       notes: data?.notes,
    //       details: receiveDetails,
    //     },
    //     userId
    //   );

    //   // Auto-approve the transaction
    //   // This will trigger processImport which handles:
    //   // 1. Increase inventory quantity
    //   // 2. Update product purchase price
    //   // 3. Add to supplier debt
    //   // 4. Update PO status to 'received'
    //   const approvedTransaction = await tx.stockTransaction.update({
    //     where: { id: stockTransaction.id },
    //     data: {
    //       status: 'approved',
    //       approvedBy: userId,
    //       approvedAt: new Date(),
    //     },
    //     include: {
    //       details: {
    //         include: {
    //           product: true,
    //         },
    //       },
    //       warehouse: true,
    //     },
    //   });

    //   // Process import logic inline (since we're in transaction)
    //   for (const detail of approvedTransaction.details) {
    //     const current = await tx.inventory.findUnique({
    //       where: {
    //         warehouseId_productId: {
    //           warehouseId: approvedTransaction.warehouseId,
    //           productId: detail.productId,
    //         },
    //       },
    //     });

    //     const newQuantity = (current ? Number(current.quantity) : 0) + Number(detail.quantity);

    //     // 1️⃣ Increase inventory
    //     await tx.inventory.upsert({
    //       where: {
    //         warehouseId_productId: {
    //           warehouseId: approvedTransaction.warehouseId,
    //           productId: detail.productId,
    //         },
    //       },
    //       create: {
    //         warehouseId: approvedTransaction.warehouseId,
    //         productId: detail.productId,
    //         quantity: newQuantity,
    //         reservedQuantity: 0,
    //         updatedBy: userId,
    //       },
    //       update: {
    //         quantity: newQuantity,
    //         updatedBy: userId,
    //       },
    //     });

    //     // 2️⃣ Update product purchase price
    //     if (detail.unitPrice) {
    //       await tx.product.update({
    //         where: { id: detail.productId },
    //         data: {
    //           purchasePrice: Number(detail.unitPrice),
    //         },
    //       });
    //     }
    //   }

    //   // 3️⃣ Add to supplier debt
    //   const supplier = await tx.supplier.findUnique({
    //     where: { id: purchaseOrder.supplierId },
    //   });

    //   const newPayable = (supplier ? Number(supplier.totalPayable) || 0 : 0) + Number(purchaseOrder.totalAmount);

    //   await tx.supplier.update({
    //     where: { id: purchaseOrder.supplierId },
    //     data: {
    //       totalPayable: newPayable,
    //     },
    //   });

    //   // 4️⃣ Update PO status to 'received'
    //   const updatedPO = await tx.purchaseOrder.update({
    //     where: { id },
    //     data: {
    //       status: 'received',
    //     },
    //     include: {
    //       supplier: true,
    //       warehouse: true,
    //       creator: {
    //         select: {
    //           id: true,
    //           fullName: true,
    //           employeeCode: true,
    //         },
    //       },
    //       approver: {
    //         select: {
    //           id: true,
    //           fullName: true,
    //           employeeCode: true,
    //         },
    //       },
    //       details: {
    //         include: {
    //           product: true,
    //         },
    //       },
    //     },
    //   });

    //   return { purchaseOrder: updatedPO, stockTransaction: approvedTransaction };
    // });



    // // Log activity
    // logActivity('update', userId, 'purchase_orders', {
    //   recordId: id,
    //   poCode: purchaseOrder.poCode,
    //   action: 'receive',
    //   stockTransactionId: result.stockTransaction.id,
    // });

    // return result;
  }

  async cancel(id: number, userId: number, reason?: string) {
    const purchaseOrder = await this.getById(id);

    if (purchaseOrder.status !== 'pending' && purchaseOrder.status !== 'approved') {
      throw new ValidationError(
        'Chỉ những đơn đặt hàng đang chờ xử lý hoặc đã được phê duyệt mới có thể bị hủy.'
      );
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        notes: reason ? `${purchaseOrder.notes || ''} - Lý do hủy: ${reason}` : purchaseOrder.notes,
      },
      include: {
        supplier: true,
        warehouse: true,
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    // Log activity
    logActivity('update', userId, 'purchase_orders', {
      recordId: id,
      poCode: purchaseOrder.poCode,
      action: 'cancel',
      reason,
    });

    return updated;
  }

  async delete(id: number, userId: number) {
    const purchaseOrder = await this.getById(id);

    if (purchaseOrder.status !== 'pending') {
      throw new ValidationError('Chỉ những đơn đặt hàng đang chờ xử lý mới có thể bị xóa.');
    }

    // Soft delete
    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    // Log activity
    logActivity('delete', userId, 'purchase_orders', {
      recordId: id,
      poCode: purchaseOrder.poCode,
    });

    return {
      success: true,
      message: 'Đơn đặt hàng đã được xóa thành công',
      timestamp: new Date().toISOString(),
    };
  }
}

export default new PurchaseOrderService();
