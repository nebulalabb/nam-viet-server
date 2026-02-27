import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';



const prisma = new PrismaClient();


class PublicInventoryService {

    // ========================================================
    // 1. CHECK AVAILABILITY (Kiểm tra tính khả dụng)
    // ========================================================
    async checkAvailability(
        items: Array<{
            productId: number;
            warehouseId: number;
            quantity: number;
        }>
    ) {
        const results = [];

        for (const item of items) {
            // Bắt buộc phải có productId và quantity
            if (!item.productId || item.quantity === undefined || item.quantity <= 0) {
                throw new ValidationError('Invalid item data in request.');
            }

            // Tìm kiếm tồn kho (Bạn có thể cân nhắc bỏ warehouseId nếu Khách hàng không chọn kho)
            const inventory = await prisma.inventory.findUnique({
                where: {
                    warehouseId_productId: {
                        warehouseId: item.warehouseId,
                        productId: item.productId,
                    },
                },
                // Chỉ include các trường cần thiết cho việc kiểm tra
                include: {
                    product: {
                        select: { sku: true, productName: true, unit: true, status: true },
                    },
                    warehouse: {
                        select: { warehouseName: true },
                    },
                },
            });

            if (!inventory) {
                results.push({
                    productId: item.productId,
                    requestedQuantity: item.quantity,
                    isAvailable: false,
                    message: 'Sản phẩm không có sẵn (hoặc kho không tồn tại)',
                });
                continue;
            }

            // Kiểm tra Sản phẩm có Active không
            if (inventory.product.status !== 'active') {
                results.push({
                    productId: item.productId,
                    requestedQuantity: item.quantity,
                    isAvailable: false,
                    message: 'Sản phẩm không hoạt động',
                });
                continue;
            }

            // Tính toán số lượng có sẵn
            const availableQty = Number(inventory.quantity) - Number(inventory.reservedQuantity);

            results.push({
                productId: item.productId,
                warehouseId: item.warehouseId,
                product: { sku: inventory.product.sku, productName: inventory.product.productName },
                warehouse: { warehouseName: inventory.warehouse.warehouseName },
                requestedQuantity: item.quantity,
                availableQuantity: availableQty,
                isAvailable: availableQty >= item.quantity,
                shortfall: Math.max(0, item.quantity - availableQty),
                message:
                    availableQty >= item.quantity
                        ? 'Available'
                        : `Insufficient stock.`,
            });
        }

        const allAvailable = results.every((r) => r.isAvailable);

        return {
            allAvailable,
            items: results,
            summary: {
                totalItems: results.length,
                availableItems: results.filter((r) => r.isAvailable).length,
                unavailableItems: results.filter((r) => !r.isAvailable).length,
            },
        };
    }


    async getProductAvailability(productId: number) {

        // 2. Chỉ lấy sản phẩm đang Active 
        const product = await prisma.product.findUnique({
            where: { id: productId, status: 'active' },
            // Chỉ lấy thông tin cơ bản để hiển thị
            select: {
                id: true,
                productName: true,
                sku: true,
                unit: true,
                productType: true
            }
        });

        if (!product) {
            throw new NotFoundError('Product not found or inactive');
        }

        // 3. Lấy tồn kho
        const inventory = await prisma.inventory.findMany({
            where: {
                productId,
                // Chỉ lấy các kho đang hoạt động (tránh hiện kho đã đóng cửa/bảo trì)
                warehouse: { status: 'active' }
            },
            select: {
                // Chỉ lấy số liệu cần thiết để tính toán
                quantity: true,
                reservedQuantity: true,
                warehouse: {
                    select: {
                        // Chỉ lấy thông tin địa chỉ để khách tìm đến
                        warehouseName: true,
                        address: true,
                        city: true,
                        region: true,
                    },
                },
            },
            // Sắp xếp theo khu vực/tên để dễ nhìn
            orderBy: { warehouse: { city: 'asc' } },
        });

        // 4. Xử lý logic hiển thị cho khách hàng
        const stockLocations = inventory.map((inv) => {
            // Tính số lượng thực tế có thể bán
            const rawAvailable = Number(inv.quantity) - Number(inv.reservedQuantity);

            // Đảm bảo không bao giờ trả về số âm
            const finalAvailable = Math.max(0, rawAvailable);

            // Logic xác định trạng thái văn bản
            let statusMessage = 'Còn hàng';
            if (finalAvailable === 0) {
                statusMessage = 'Hết hàng';
            } else if (finalAvailable < 10) {
                statusMessage = 'Sắp hết hàng';
            }

            return {
                warehouseName: inv.warehouse.warehouseName,
                address: inv.warehouse.address,
                city: inv.warehouse.city,
                region: inv.warehouse.region,
                // Trả về số lượng cụ thể và trạng thái rõ ràng
                availableQuantity: finalAvailable,
                status: statusMessage
            };
        });

        const result = {
            product: product,
            stockLocations: stockLocations,
            // Tổng hợp nhanh để hiện ở header trang chi tiết (nếu cần)
            summary: {
                totalAvailable: stockLocations.reduce((sum, loc) => sum + loc.availableQuantity, 0),
                inStockLocations: stockLocations.filter(l => l.availableQuantity > 0).length
            }
        };

        return result;
    }
}

export default new PublicInventoryService();