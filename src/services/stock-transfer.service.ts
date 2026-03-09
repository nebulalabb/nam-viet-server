import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import inventoryService from './inventory.service';

const prisma = new PrismaClient();

class StockTransferService {
  private async generateTransferCode(): Promise<string> {
    const prefix = 'ST';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await prisma.stockTransfer.count({
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

  // Get all transfers
  async getAll(params: {
    page: number;
    limit: number;
    fromWarehouseId?: number;
    toWarehouseId?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 20,
      fromWarehouseId,
      toWarehouseId,
      status,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.StockTransferWhereInput = {
      ...(fromWarehouseId && { fromWarehouseId }),
      ...(toWarehouseId && { toWarehouseId }),
      ...(status && { status: status as any }),
      ...(fromDate &&
        toDate && {
          transferDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    const total = await prisma.stockTransfer.count({ where });

    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: {
        fromWarehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
            city: true,
            region: true,
          },
        },
        toWarehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseCode: true,
            city: true,
            region: true,
          },
        },
        requester: {
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
        _count: {
          select: {
            details: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
    });

    return {
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get transfer by ID
  async getById(id: number) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        requester: {
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
        canceller: {
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
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundError('Stock transfer');
    }

    return transfer;
  }

  // Create transfer
  async create(
    data: {
      fromWarehouseId: number;
      toWarehouseId: number;
      transferDate?: string | Date;
      reason?: string;
      details: Array<{
        productId: number;
        quantity: number;
        unitPrice?: number;
        batchNumber?: string;
        expiryDate?: string | Date;
        notes?: string;
      }>;
    },
    userId: number
  ) {
    const fromWarehouse = await prisma.warehouse.findUnique({
      where: { id: data.fromWarehouseId },
    });
    if (!fromWarehouse) {
      throw new NotFoundError('Source warehouse');
    }

    const toWarehouse = await prisma.warehouse.findUnique({
      where: { id: data.toWarehouseId },
    });
    if (!toWarehouse) {
      throw new NotFoundError('Destination warehouse');
    }

    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new ValidationError('Source and destination warehouses must be different');
    }

    // Check inventory availability
    const checkResult = await inventoryService.checkAvailability(
      data.details.map((d) => ({
        productId: d.productId,
        warehouseId: data.fromWarehouseId,
        quantity: d.quantity,
      }))
    );

    if (!checkResult.allAvailable) {
      throw new ValidationError('Insufficient inventory in source warehouse', {
        unavailableItems: checkResult.items.filter((i) => !i.isAvailable),
      });
    }

    const transferCode = await this.generateTransferCode();

    const totalValue = data.details.reduce(
      (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
      0
    );

    const transfer = await prisma.stockTransfer.create({
      data: {
        transferCode,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        transferDate: data.transferDate ? new Date(data.transferDate) : new Date(),
        totalValue,
        reason: data.reason,
        status: 'pending',
        requestedBy: userId,
        details: {
          create: data.details.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice || 0,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            notes: item.notes,
          })),
        },
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        fromWarehouse: true,
        toWarehouse: true,
        requester: true,
      },
    });

    logActivity('create', userId, 'stock_transfers', {
      recordId: transfer.id,
      newValue: transfer,
    });

    return transfer;
  }

  // Update transfer (only pending)
  async update(
    id: number,
    data: {
      fromWarehouseId?: number;
      toWarehouseId?: number;
      transferDate?: string | Date;
      reason?: string;
      details?: Array<{
        productId: number;
        quantity: number;
        unitPrice?: number;
        batchNumber?: string;
        expiryDate?: string | Date;
        notes?: string;
      }>;
    },
    userId: number
  ) {
    const existing = await this.getById(id);

    if (existing.status !== 'pending') {
      throw new ValidationError('Only pending transfers can be updated');
    }

    const finalFromId = data.fromWarehouseId || existing.fromWarehouseId;
    const finalToId = data.toWarehouseId || existing.toWarehouseId;

    if (finalFromId === finalToId) {
      throw new ValidationError('Source and destination warehouses must be different');
    }

    if (data.details) {
      const checkResult = await inventoryService.checkAvailability(
        data.details.map((d) => ({
          productId: d.productId,
          warehouseId: finalFromId,
          quantity: d.quantity,
        }))
      );

      if (!checkResult.allAvailable) {
        throw new ValidationError('Insufficient inventory in source warehouse');
      }
    }

    let totalValue = existing.totalValue;
    if (data.details) {
      totalValue = data.details.reduce((sum, item) => {
        const lineTotal = new Prisma.Decimal(item.unitPrice || 0).mul(item.quantity);
        return sum.add(lineTotal);
      }, new Prisma.Decimal(0));
    }

    const updated = await prisma.stockTransfer.update({
      where: { id },
      data: {
        ...(data.fromWarehouseId && { fromWarehouseId: data.fromWarehouseId }),
        ...(data.toWarehouseId && { toWarehouseId: data.toWarehouseId }),
        ...(data.transferDate && { transferDate: new Date(data.transferDate) }),
        ...(data.reason !== undefined && { reason: data.reason }),
        ...(data.details && { totalValue }),
        ...(data.details && {
          details: {
            deleteMany: {},
            create: data.details.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              notes: item.notes,
            })),
          },
        }),
      },
      include: {
        details: {
          include: {
            product: true,
          },
        },
        fromWarehouse: true,
        toWarehouse: true,
      },
    });

    logActivity('update', userId, 'stock_transfers', {
      recordId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  // Approve transfer (reserve inventory)
  async approve(id: number, userId: number) {
    const transfer = await this.getById(id);

    if (transfer.status !== 'pending') {
      throw new ValidationError(`Transfer is already ${transfer.status}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'in_transit',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          details: {
            include: {
              product: true,
            },
          },
          fromWarehouse: true,
          toWarehouse: true,
        },
      });

      // Reserve inventory in source
      for (const detail of transfer.details) {
        const current = await tx.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.fromWarehouseId,
              productId: detail.productId,
            },
          },
        });

        if (!current) {
          throw new NotFoundError(`Inventory not found for product ${detail.productId}`);
        }

        await tx.inventory.update({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.fromWarehouseId,
              productId: detail.productId,
            },
          },
          data: {
            reservedQuantity: Number(current.reservedQuantity) + Number(detail.quantity),
            updatedBy: userId,
          },
        });
      }

      return updated;
    });

    logActivity('update', userId, 'stock_transfers', {
      recordId: id,
      action: 'approve',
      newValue: { status: 'in_transit' },
    });

    return result;
  }

  // Complete transfer (move inventory)
  async complete(id: number, userId: number) {
    const transfer = await this.getById(id);

    if (transfer.status !== 'in_transit') {
      throw new ValidationError('Transfer must be in_transit to complete');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'completed',
        },
        include: {
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      // Move inventory
      for (const detail of transfer.details) {
        // Decrease from source
        const sourceInv = await tx.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.fromWarehouseId,
              productId: detail.productId,
            },
          },
        });

        if (!sourceInv) {
          throw new NotFoundError(`Source inventory not found`);
        }

        await tx.inventory.update({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.fromWarehouseId,
              productId: detail.productId,
            },
          },
          data: {
            quantity: Number(sourceInv.quantity) - Number(detail.quantity),
            reservedQuantity: Number(sourceInv.reservedQuantity) - Number(detail.quantity),
            updatedBy: userId,
          },
        });

        // Increase in destination
        const destInv = await tx.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.toWarehouseId,
              productId: detail.productId,
            },
          },
        });

        const newQty = (destInv ? Number(destInv.quantity) : 0) + Number(detail.quantity);

        await tx.inventory.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: transfer.toWarehouseId,
              productId: detail.productId,
            },
          },
          create: {
            warehouseId: transfer.toWarehouseId,
            productId: detail.productId,
            quantity: newQty,
            reservedQuantity: 0,
            updatedBy: userId,
          },
          update: {
            quantity: newQty,
            updatedBy: userId,
          },
        });
      }

      return updated;
    });

    logActivity('update', userId, 'stock_transfers', {
      recordId: id,
      action: 'complete',
      newValue: { status: 'completed' },
    });

    return result;
  }

  // Cancel transfer
  async cancel(id: number, userId: number, reason: string) {
    const transfer = await this.getById(id);

    if (transfer.status === 'cancelled') {
      throw new ValidationError('Transfer is already cancelled');
    }

    if (transfer.status === 'completed') {
      throw new ValidationError('Cannot cancel completed transfer');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Release reserved inventory if in_transit
      if (transfer.status === 'in_transit') {
        for (const detail of transfer.details) {
          const current = await tx.inventory.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: transfer.fromWarehouseId,
                productId: detail.productId,
              },
            },
          });

          if (current) {
            await tx.inventory.update({
              where: {
                warehouseId_productId: {
                  warehouseId: transfer.fromWarehouseId,
                  productId: detail.productId,
                },
              },
              data: {
                reservedQuantity: Math.max(
                  0,
                  Number(current.reservedQuantity) - Number(detail.quantity)
                ),
                updatedBy: userId,
              },
            });
          }
        }
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledBy: userId,
          cancelledAt: new Date(),
        },
        include: {
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      return updated;
    });

    logActivity('update', userId, 'stock_transfers', {
      recordId: id,
      action: 'cancel',
      reason,
    });

    return result;
  }

  // Delete transfer (only pending)
  async delete(id: number, userId: number) {
    const transfer = await this.getById(id);

    if (transfer.status !== 'pending') {
      throw new ValidationError('Can only delete pending transfers');
    }

    await prisma.stockTransfer.delete({
      where: { id },
    });

    logActivity('delete', userId, 'stock_transfers', {
      recordId: id,
      oldValue: transfer,
    });

    return { message: 'Transfer deleted successfully' };
  }
}

export default new StockTransferService();
