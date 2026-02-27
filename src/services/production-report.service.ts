import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface ProductionReportFilters {
  startDate: string;
  endDate: string;
  status?: string;
  finishedProductId?: number;
  createdBy?: number;
  page?: number;
  limit?: number;
}

interface DateRange {
  fromDate: Date;
  toDate: Date;
}

class ProductionReportService {
  private getDateRange(fromDate?: string, toDate?: string): DateRange {
    const today = new Date();
    const from = fromDate ? new Date(fromDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    from.setHours(0, 0, 0, 0);

    const to = toDate ? new Date(toDate) : new Date(today.setHours(23, 59, 59, 999));
    to.setHours(23, 59, 59, 999);

    return { fromDate: from, toDate: to };
  }

  private buildWhereClause(filters: ProductionReportFilters) {
    const dateRange = this.getDateRange(filters.startDate, filters.endDate);

    const where: any = {
      startDate: {
        gte: dateRange.fromDate,
        lte: dateRange.toDate,
      },
    };

    // Default: loại bỏ orders đã hủy, trừ khi người dùng chọn lọc cancelled
    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = { not: 'cancelled' };
    }

    if (filters.finishedProductId) {
      where.finishedProductId = filters.finishedProductId;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    return where;
  }

  // =====================================================
  // API 1: DASHBOARD SUMMARY (KPI Cards)
  // =====================================================
  async getProductionSummary(filters: ProductionReportFilters) {
    const where = this.buildWhereClause(filters);

    // Fetch all orders
    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        materials: {
          select: {
            wastage: true,
            unitPrice: true,
          },
        },
      },
    });

    // Calculate metrics
    const totalPlanned = orders.reduce((sum, o) => sum + Number(o.plannedQuantity), 0);
    const totalActual = orders.reduce((sum, o) => sum + Number(o.actualQuantity || 0), 0);
    const completionPercentage = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    // Total production cost
    const totalProductionCost = orders.reduce((sum, o) => sum + Number(o.productionCost || 0), 0);
    const costPerUnit = orders.length > 0 ? totalProductionCost / totalActual : 0;

    // Wastage calculation
    let wastageValue = 0;
    orders.forEach((order) => {
      order.materials.forEach((material) => {
        const wastageQty = Number(material.wastage || 0);
        const price = Number(material.unitPrice || 0);
        wastageValue += wastageQty * price;
      });
    });

    const totalMaterialCost = orders.reduce((sum, order) => {
      return sum + order.materials.reduce((matSum, m) => matSum + (Number(m.wastage || 0) * Number(m.unitPrice || 0)), 0);
    }, 0);

    const wastageRate = totalMaterialCost > 0 ? (wastageValue / (totalMaterialCost + wastageValue)) * 100 : 0;

    // On-time delivery
    const completedOrders = orders.filter((o) => o.status === 'completed');
    const completedOnTime = completedOrders.filter((o) => {
      const isOnTime = o.endDate ? o.endDate >= new Date(o.completedAt || o.endDate) : true;
      return isOnTime;
    }).length;

    const onTimeDeliveryRate = completedOrders.length > 0 ? (completedOnTime / completedOrders.length) * 100 : 0;

    const result = {
      summary: {
        outputVolume: totalActual,
        plannedVolume: totalPlanned,
        completionPercentage,
        wastageRate,
        wastageValue,
        totalProductionCost,
        costPerUnit,
        activeOrders: orders.filter((o) => o.status === 'in_progress').length,
        completedOrders: completedOrders.length,
        totalOrders: orders.length,
        onTimeDeliveryRate,
        completedOnTime,
      },
    };
    return result;
  }

  // =====================================================
  // API 2: TIMELINE CHART (Plan vs Actual)
  // =====================================================
  async getTimelineChart(filters: ProductionReportFilters) {
    const where = this.buildWhereClause(filters);

    const orders = await prisma.productionOrder.findMany({
      where,
      select: {
        startDate: true,
        plannedQuantity: true,
        actualQuantity: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Group by date and aggregate
    const groupedByDate = new Map<string, { planned: number; actual: number }>();

    orders.forEach((order) => {
      const dateKey = order.startDate.toISOString().split('T')[0];
      const existing = groupedByDate.get(dateKey) || { planned: 0, actual: 0 };

      existing.planned += Number(order.plannedQuantity);
      existing.actual += Number(order.actualQuantity || 0);

      groupedByDate.set(dateKey, existing);
    });

    // Convert to array format
    const timeline = Array.from(groupedByDate).map(([date, values]) => ({
      date,
      planned: values.planned,
      actual: values.actual,
      percentage: values.planned > 0 ? (values.actual / values.planned) * 100 : 0,
    }));

    return { planVsActualTrend: timeline };
  }

  // =====================================================
  // API 3: TOP WASTAGE CHART (Top 5 Materials)
  // =====================================================
  async getTopWastageChart(filters: ProductionReportFilters) {
    const where = this.buildWhereClause(filters);

    // Modify where clause for ProductionOrderMaterial
    const materialWhere = {
      productionOrder: where,
      wastage: { gt: 0 },
    };

    const wastageStats = await prisma.productionOrderMaterial.groupBy({
      by: ['materialId'],
      where: materialWhere,
      _sum: {
        wastage: true,
      },
    });

    // Fetch material details and calculate costs
    const topWastage = await Promise.all(
      wastageStats.map(async (stat) => {
        const material = await prisma.product.findUnique({
          where: { id: stat.materialId },
          select: {
            productName: true,
            sku: true,
            purchasePrice: true,
          },
        });

        const wastageQty = Number(stat._sum.wastage || 0);
        const unitPrice = Number(material?.purchasePrice || 0);
        const wastageCost = wastageQty * unitPrice;

        return {
          materialId: stat.materialId,
          materialName: material?.productName || 'Unknown',
          sku: material?.sku || '',
          wastageQty,
          wastageCost,
          wastagePercentage: 0, // Will be calculated if needed
        };
      })
    );

    // Sort by cost (descending) and take top 5
    const top5 = topWastage.sort((a, b) => b.wastageCost - a.wastageCost).slice(0, 5);

    return { topWastageByMaterial: top5 };
  }

  // =====================================================
  // API 4: PRODUCTION ORDERS LIST (Tab 1)
  // =====================================================
  async getProductionOrders(filters: ProductionReportFilters) {
    const where = this.buildWhereClause(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        finishedProduct: {
          select: {
            productName: true,
            sku: true,
          },
        },
        creator: {
          select: {
            fullName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
      skip,
      take: limit,
    });

    const total = await prisma.productionOrder.count({ where });

    const orderList = orders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      productName: order.finishedProduct?.productName,
      sku: order.finishedProduct?.sku,
      plannedQuantity: Number(order.plannedQuantity),
      actualQuantity: Number(order.actualQuantity || 0),
      completionPercentage: Number(order.plannedQuantity) > 0 ? (Number(order.actualQuantity || 0) / Number(order.plannedQuantity)) * 100 : 0,
      status: order.status,
      startDate: order.startDate,
      expectedEndDate: order.endDate,
      actualEndDate: order.completedAt,
      creator: order.creator?.fullName,
      creatorCode: order.creator?.employeeCode,
      isOverdue: order.status !== 'completed' && order.endDate && order.endDate < new Date(),
    }));

    return {
      orders: orderList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =====================================================
  // API 5: MATERIAL USAGE REPORT (Tab 2)
  // =====================================================
  async getMaterialUsageReport(filters: ProductionReportFilters) {
    const where = this.buildWhereClause(filters);

    const materialWhere = {
      productionOrder: where,
    };

    const usageStats = await prisma.productionOrderMaterial.groupBy({
      by: ['materialId'],
      where: materialWhere,
      _sum: {
        plannedQuantity: true,
        actualQuantity: true,
        wastage: true,
      },
    });

    const materialConsumption = await Promise.all(
      usageStats.map(async (stat) => {
        const material = await prisma.product.findUnique({
          where: { id: stat.materialId },
          select: {
            productName: true,
            sku: true,
            unit: true,
            purchasePrice: true,
          },
        });

        const planned = Number(stat._sum.plannedQuantity || 0);
        const actual = Number(stat._sum.actualQuantity || 0);
        const wastage = Number(stat._sum.wastage || 0);
        const unitPrice = Number(material?.purchasePrice || 0);
        const wastageValue = wastage * unitPrice;

        return {
          materialId: stat.materialId,
          materialName: material?.productName || 'Unknown',
          sku: material?.sku || '',
          unit: material?.unit || '',
          plannedQuantity: planned,
          actualQuantity: actual,
          wastage,
          wastageValue,
          variance: actual - planned,
          variancePercentage: planned > 0 ? ((actual - planned) / planned) * 100 : 0,
        };
      })
    );

    // Sort by wastage value (descending)
    return {
      materialConsumption: materialConsumption.sort((a, b) => b.wastageValue - a.wastageValue),
    };
  }

  // =====================================================
  // API 6: COST STRUCTURE CHART
  // =====================================================
  async getCostStructureChart(filters: ProductionReportFilters) {
    const where = this.buildWhereClause(filters);

    const orders = await prisma.productionOrder.findMany({
      where,
      select: {
        productionCost: true,
        materials: {
          select: {
            wastage: true,
            unitPrice: true,
          },
        },
      },
    });

    // Calculate cost components
    let rawMaterialCost = 0;
    let wastageCost = 0;
    let laborOverheadCost = 0;

    orders.forEach((order) => {
      // Raw material cost
      order.materials.forEach((m) => {
        const actualQty = Number(m.wastage || 0);
        rawMaterialCost += actualQty * Number(m.unitPrice || 0);
      });
    });

    // Estimate wastage and labor costs
    wastageCost = orders.reduce((sum, order) => {
      return sum + order.materials.reduce((matSum, m) => matSum + (Number(m.wastage || 0) * Number(m.unitPrice || 0)), 0);
    }, 0);

    const totalCost = orders.reduce((sum, o) => sum + Number(o.productionCost || 0), 0);
    laborOverheadCost = totalCost - rawMaterialCost - wastageCost;

    const costStructure = [
      {
        type: 'raw_material',
        name: 'Nguyên liệu thô',
        amount: Math.max(0, rawMaterialCost),
        percentage: totalCost > 0 ? (rawMaterialCost / totalCost) * 100 : 0,
      },
      {
        type: 'wastage',
        name: 'Hao hụt',
        amount: wastageCost,
        percentage: totalCost > 0 ? (wastageCost / totalCost) * 100 : 0,
      },
      {
        type: 'labor_overhead',
        name: 'Lao động & Overhead',
        amount: Math.max(0, laborOverheadCost),
        percentage: totalCost > 0 ? (laborOverheadCost / totalCost) * 100 : 0,
      },
    ];

    return { costStructure };
  }
}

export default new ProductionReportService();
