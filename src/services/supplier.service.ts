import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  QuerySuppliersInput,
} from '@validators/supplier.validator';

const prisma = new PrismaClient();

class SupplierService {
  async getAllSuppliers(query: QuerySuppliersInput) {
    const {
      page = '1',
      limit = '20',
      search,
      supplierType,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { supplierName: { contains: search } },
          { supplierCode: { contains: search } },
          { contactName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { taxCode: { contains: search } },
        ],
      }),
      ...(supplierType && { supplierType }),
      ...(status && { status }),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          supplierCode: true,
          supplierName: true,
          supplierType: true,
          contactName: true,
          phone: true,
          email: true,
          taxCode: true,
          totalPayable: true,
          paymentTerms: true,
          status: true,
          payableUpdatedAt: true,
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    // Stat Cards
    const totalSuppliers = total;
    const activeSuppliers = await prisma.supplier.count({
      where: {
        ...where,
        status: 'active',
      },
    });
    const totalDebt = suppliers.reduce((total, supplier) => {
      return total + Number(supplier.totalPayable);
    }, 0);

    const result = {
      data: suppliers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      cards: {
        totalSuppliers,
        activeSuppliers,
        totalDebt,
      },
    };

    return result;
  }

  async getSupplierById(id: number) {

    const supplier = await prisma.supplier.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        supplierType: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        totalPayable: true,
        paymentTerms: true,
        notes: true,
        status: true,
        createdBy: true,
        updatedBy: true,
        payableUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
            paymentVouchers: true,
            // debtReconciliations: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    return supplier;
  }

  async createSupplier(data: CreateSupplierInput, createdBy: number) {
    const codeExists = await this.checkSupplierCodeExists(data.supplierCode);
    if (codeExists) {
      throw new ConflictError('Mã nhà cung cấp đã tồn tại');
    }

    if (data.taxCode) {
      const taxCodeExists = await this.checkTaxCodeExists(data.taxCode);
      if (taxCodeExists) {
        throw new ConflictError('Mã số thuế đã tồn tại');
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: data.supplierCode,
        supplierName: data.supplierName,
        supplierType: data.supplierType || 'local',
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        taxCode: data.taxCode || null,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
        status: data.status || 'active',
        createdBy,
      },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        supplierType: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        paymentTerms: true,
        notes: true,
        status: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    logActivity('create', createdBy, 'suppliers', {
      recordId: supplier.id,
      newValue: supplier,
    });

    return supplier;
  }

  async updateSupplier(id: number, data: UpdateSupplierInput, updatedBy: number) {
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingSupplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    if (data.supplierCode && data.supplierCode !== existingSupplier.supplierCode) {
      const codeExists = await this.checkSupplierCodeExists(data.supplierCode, id);
      if (codeExists) {
        throw new ConflictError('Mã nhà cung cấp đã tồn tại');
      }
    }

    if (data.taxCode && data.taxCode !== existingSupplier.taxCode) {
      const taxCodeExists = await this.checkTaxCodeExists(data.taxCode, id);
      if (taxCodeExists) {
        throw new ConflictError('Mã số thuế đã tồn tại');
      }
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.supplierCode && { supplierCode: data.supplierCode }),
        ...(data.supplierName && { supplierName: data.supplierName }),
        ...(data.supplierType && { supplierType: data.supplierType }),
        ...(data.contactName !== undefined && { contactName: data.contactName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.taxCode !== undefined && { taxCode: data.taxCode }),
        ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status && { status: data.status }),
        updatedBy,
      },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        supplierType: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        paymentTerms: true,
        notes: true,
        status: true,
        updatedAt: true,
        updater: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    logActivity('update', updatedBy, 'suppliers', {
      recordId: id,
      oldValue: existingSupplier,
      newValue: updatedSupplier,
    });

    return updatedSupplier;
  }

  async deleteSupplier(id: number, deletedBy: number) {
    const supplier = await prisma.supplier.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundError('Nhà cung cấp không tồn tại');
    }

    if (supplier._count.products > 0) {
      throw new ValidationError('Không thể xóa nhà cung cấp có sản phẩm tồn tại');
    }

    if (supplier._count.purchaseOrders > 0) {
      throw new ValidationError('Không thể xóa nhà cung cấp có đơn hàng tồn tại');
    }

    // soft delete
    await prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logActivity('delete', deletedBy, 'suppliers', {
      recordId: id,
      oldValue: supplier,
    });

    return { message: 'Xóa nhà cung cấp thành công' };
  }

  async checkSupplierCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const supplier = await prisma.supplier.findFirst({
      where: {
        supplierCode: code,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!supplier;
  }

  async checkTaxCodeExists(taxCode: string, excludeId?: number): Promise<boolean> {
    const supplier = await prisma.supplier.findFirst({
      where: {
        taxCode,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !!supplier;
  }
}

export default new SupplierService();
