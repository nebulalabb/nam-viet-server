import {
  CashFundCreateInput,
  CashFundFilter,
  CashFundLockInput,
  CashFundUpdateInput,
} from '@custom-types/index';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import { logActivity } from '@utils/logger';

const prisma = new PrismaClient();

export class CashFundService {
  async getDailyCashFund(date: Date) {

    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    if (!fund) {
      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);

      const previousFund = await prisma.cashFund.findUnique({
        where: { fundDate: previousDay },
      });

      const previousClosing = previousFund
        ? Number(previousFund.openingBalance) +
          Number(previousFund.totalReceipts) -
          Number(previousFund.totalPayments)
        : 0;
      const openingBalance = previousClosing;

      return await this.createCashFund({
        fundDate: date,
        openingBalance,
        notes: 'Auto-created fund',
      }, 1);
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const receipts = await prisma.paymentReceipt.aggregate({
      where: {
        receiptDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        isPosted: true,
      },
      _sum: {
        amount: true,
      },
    });

    const payments = await prisma.paymentVoucher.aggregate({
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        isPosted: true,
      },
      _sum: {
        amount: true,
      },
    });

    const totalReceipts = Number(receipts._sum.amount || 0);
    const totalPayments = Number(payments._sum.amount || 0);

    if (!fund.isLocked) {
      await prisma.cashFund.update({
        where: { id: fund.id },
        data: {
          totalReceipts,
          totalPayments,
        },
      });
    }

    const result = {
      ...fund,
      totalReceipts,
      totalPayments,
      closingBalance: Number(fund.openingBalance) + totalReceipts - totalPayments,
    };

    return result;
  }

  async getCashFundList(filter: CashFundFilter) {

    const where: any = {};

    if (filter.startDate || filter.endDate) {
      where.fundDate = {};
      if (filter.startDate) where.fundDate.gte = filter.startDate;
      if (filter.endDate) where.fundDate.lte = filter.endDate;
    }

    if (filter.isLocked !== undefined) {
      where.isLocked = filter.isLocked;
    }

    const [funds, total] = await Promise.all([
      prisma.cashFund.findMany({
        where,
        include: {
          approver: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
          reconciler: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
        },
        orderBy: { fundDate: 'desc' },
        skip: filter.page ? (filter.page - 1) * (filter.limit || 20) : 0,
        take: filter.limit || 20,
      }),
      prisma.cashFund.count({ where }),
    ]);

    // Calculate statistics
    const allFunds = await prisma.cashFund.findMany({
      where,
      select: {
        id: true,
        isLocked: true,
        totalReceipts: true,
        totalPayments: true,
      },
    });

    const statistics = {
      totalDays: allFunds.length,
      lockedDays: allFunds.filter((f) => f.isLocked).length,
      unlockedDays: allFunds.filter((f) => !f.isLocked).length,
      totalReceipts: allFunds.reduce((sum, f) => sum + Number(f.totalReceipts), 0),
      totalPayments: allFunds.reduce((sum, f) => sum + Number(f.totalPayments), 0),
    };

    const result = {
      data: funds,
      meta: {
        page: filter.page || 1,
        limit: filter.limit || 20,
        total,
        totalPages: Math.ceil(total / (filter.limit || 20)),
      },
      statistics,
    };

    return result;

    return result;
  }

  async createCashFund(data: CashFundCreateInput, userId: number) {
    const existing = await prisma.cashFund.findUnique({
      where: { fundDate: data.fundDate },
    });

    if (existing) {
      throw new ValidationError('Quỹ tiền mặt cho ngày này đã tồn tại');
    }

    const fund = await prisma.cashFund.create({
      data: {
        fundDate: data.fundDate,
        openingBalance: data.openingBalance || 0,
        totalReceipts: 0,
        totalPayments: 0,
        notes: data.notes,
      },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    logActivity('create', userId, 'cash_fund', {
      recordId: fund.id,
      fundDate: data.fundDate,
      openingBalance: data.openingBalance || 0,
    });

    return fund;

    return fund;
  }

  async updateCashFund(date: Date, data: CashFundUpdateInput, userId: number) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new NotFoundError('Quỹ tiền mặt không tồn tại');
    }

    if (fund.isLocked) {
      throw new ValidationError('Không thể cập nhật quỹ tiền mặt đã khóa');
    }

    const updated = await prisma.cashFund.update({
      where: { fundDate: date },
      data: {
        openingBalance: data.openingBalance,
        notes: data.notes,
      },
      include: {
        approver: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
        reconciler: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
          },
        },
      },
    });

    logActivity('update', userId, 'cash_fund', {
      recordId: updated.id,
      fundDate: date,
      openingBalance: data.openingBalance,
    });

    return updated;

    return updated;
  }

  async lockCashFund(date: Date, lockData: CashFundLockInput, userId: number) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new NotFoundError('Quỹ tiền mặt không tồn tại');
    }

    if (fund.isLocked) {
      throw new ValidationError('Quỹ tiền mặt đã được khóa');
    }

    // Use transaction for lock operation
    const locked = await prisma.$transaction(async (tx) => {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const receipts = await tx.paymentReceipt.aggregate({
        where: {
          receiptDate: {
            gte: dateStart,
            lte: dateEnd,
          },
          isPosted: true,
        },
        _sum: {
          amount: true,
        },
      });

      const payments = await tx.paymentVoucher.aggregate({
        where: {
          paymentDate: {
            gte: dateStart,
            lte: dateEnd,
          },
          isPosted: true,
        },
        _sum: {
          amount: true,
        },
      });

      const totalReceipts = Number(receipts._sum.amount || 0);
      const totalPayments = Number(payments._sum.amount || 0);

      const updated = await tx.cashFund.update({
        where: { fundDate: date },
        data: {
          totalReceipts,
          totalPayments,
          isLocked: true,
          lockedAt: new Date(),
          approvedBy: lockData.approvedBy,
          reconciledBy: lockData.reconciledBy,
          notes: lockData.notes || fund.notes,
        },
        include: {
          approver: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
          reconciler: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
        },
      });

      // Auto-create next day's fund
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const nextFundExists = await tx.cashFund.findUnique({
        where: { fundDate: nextDay },
      });

      if (!nextFundExists) {
        const closingBalance = Number(updated.openingBalance) + totalReceipts - totalPayments;
        await tx.cashFund.create({
          data: {
            fundDate: nextDay,
            openingBalance: closingBalance,
            notes: 'Auto-created from previous day lock',
          },
        });
      }

      return updated;
    });

    logActivity('lock', userId, 'cash_fund', {
      recordId: locked.id,
      fundDate: date,
      approvedBy: lockData.approvedBy,
      reconciledBy: lockData.reconciledBy,
      isLocked: true,
    });

    const closingBalance = Number(locked.openingBalance) + Number(locked.totalReceipts) - Number(locked.totalPayments);

    return {
      ...locked,
      closingBalance,
    };
  }

  async unlockCashFund(date: Date, userId: number) {
    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new NotFoundError('Quỹ tiền mặt không tồn tại');
    }

    if (!fund.isLocked) {
      throw new ValidationError('Quỹ tiền mặt chưa được khóa');
    }

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const nextFund = await prisma.cashFund.findUnique({
      where: { fundDate: nextDay },
    });

    if (nextFund?.isLocked) {
      throw new ValidationError('Không thể mở khóa: ngày tiếp theo đã được khóa');
    }

    // Use transaction for unlock operation
    const unlocked = await prisma.$transaction(async (tx) => {
      return await tx.cashFund.update({
        where: { fundDate: date },
        data: {
          isLocked: false,
          lockedAt: null,
          approvedBy: null,
          reconciledBy: null,
        },
        include: {
          approver: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
          reconciler: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
        },
      });
    });

    logActivity('unlock', userId, 'cash_fund', {
      recordId: unlocked.id,
      fundDate: date,
      isLocked: false,
    });

    return unlocked;

    return unlocked;
  }

  async getCashFundSummary(startDate: Date, endDate: Date) {

    const funds = await prisma.cashFund.findMany({
      where: {
        fundDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { fundDate: 'asc' },
    });

    const summary = {
      totalDays: funds.length,
      lockedDays: funds.filter((f) => f.isLocked).length,
      unlockedDays: funds.filter((f) => !f.isLocked).length,
      totalReceipts: funds.reduce((sum, f) => sum + Number(f.totalReceipts), 0),
      totalPayments: funds.reduce((sum, f) => sum + Number(f.totalPayments), 0),
      openingBalance: Number(funds[0]?.openingBalance || 0),
      closingBalance: 0,
      netChange: 0,
    };

    const lastFund = funds[funds.length - 1];
    if (lastFund) {
      summary.closingBalance =
        Number(lastFund.openingBalance) +
        Number(lastFund.totalReceipts) -
        Number(lastFund.totalPayments);
    }

    summary.netChange = summary.closingBalance - summary.openingBalance;

    return summary;

    return summary;
  }

  async getDiscrepancies(date: Date) {

    const fund = await prisma.cashFund.findUnique({
      where: { fundDate: date },
    });

    if (!fund) {
      throw new NotFoundError('Quỹ tiền mặt không tồn tại');
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    // Get all receipts for the day
    const receipts = await prisma.paymentReceipt.findMany({
      where: {
        receiptDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      select: {
        id: true,
        receiptCode: true,
        amount: true,
        receiptDate: true,
        isPosted: true,
      },
    });

    const payments = await prisma.paymentVoucher.findMany({
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      select: {
        id: true,
        voucherCode: true,
        amount: true,
        paymentDate: true,
        isPosted: true,
      },
    });

    const totalReceipts = receipts
      .filter((r: any) => r.isPosted)
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    const totalPayments = payments
      .filter((p: any) => p.isPosted)
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const calculatedClosing = Number(fund.openingBalance) + totalReceipts - totalPayments;
    const recordedClosing =
      Number(fund.openingBalance) + Number(fund.totalReceipts) - Number(fund.totalPayments);

    const discrepancy = calculatedClosing - recordedClosing;

    const result = {
      fundDate: fund.fundDate,
      openingBalance: Number(fund.openingBalance),
      recordedReceipts: Number(fund.totalReceipts),
      calculatedReceipts: totalReceipts,
      recordedPayments: Number(fund.totalPayments),
      calculatedPayments: totalPayments,
      recordedClosing,
      calculatedClosing,
      discrepancy,
      hasDiscrepancy: Math.abs(discrepancy) > 0.01,
      receipts,
      payments,
    };

    return result;

    return result;
  }
}

export default new CashFundService();
