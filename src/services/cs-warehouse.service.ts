import { PrismaClient, Prisma } from '@prisma/client';
import type { QueryWarehousesInput } from '@validators/warehouse.validator';

const prisma = new PrismaClient();

class PublicWarehouseService {

  // Lấy danh sách kho hàng (Store Locator) cho khách hàng
  async getAllWarehouses(query: QueryWarehousesInput) {
    const {
      page = '1',
      limit = '20',
      search,
      city,
      region,
      warehouseType,
      // Bỏ status khỏi input vì ta sẽ ép buộc nó
      sortBy = 'warehouseName', // Mặc định sắp xếp theo tên cho dễ tìm
      sortOrder = 'asc',
    } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 2. Xây dựng điều kiện lọc
    const where: Prisma.WarehouseWhereInput = {
      status: 'active', // QUAN TRỌNG: Chỉ lấy kho đang hoạt động
      ...(search && {
        OR: [
          { warehouseName: { contains: search } },
          { address: { contains: search } },
          { city: { contains: search } },
          { region: { contains: search } },
        ],
      }),
      ...(city && { city: { contains: city } }),
      ...(region && { region: { contains: region } }),
      ...(warehouseType && { warehouseType }),
    };

    // 3. Truy vấn Database
    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          // CHỈ LẤY CÁC TRƯỜNG CẦN THIẾT CHO KHÁCH HÀNG
          id: true,
          warehouseName: true,
          warehouseType: true, // Để khách biết đâu là cửa hàng, đâu là kho lớn
          address: true,
          city: true,
          region: true,
          description: true, // Có thể chứa thông tin giờ mở cửa hoặc chỉ dẫn
          // BỎ: warehouseCode (nội bộ), managerId, capacity, users, _count...
        },
      }),
      prisma.warehouse.count({ where }),
    ]);

    const result = {
      data: warehouses,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Lấy danh sách cửa hàng thành công',
    };

    return result;
  }
}

export default new PublicWarehouseService();