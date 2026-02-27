import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '@utils/errors';
import type {
    QueryCategoriesInput,
    // Bỏ qua CreateCategoryInput, UpdateCategoryInput
} from '@validators/category.validator';

const prisma = new PrismaClient();

class PublicCategoryService {

    // ========================================================
    // 1. GET ALL CATEGORIES (Danh sách có phân trang)
    // ========================================================
    async getAllCategories(query: QueryCategoriesInput) {
        const {
            page = '1',
            limit = '20',
            search,
            parentId,
            // status, // Biến này không dùng trong where
            sortBy = 'categoryName', // Mặc định sắp xếp thân thiện hơn với Khách hàng
            sortOrder = 'asc',
        } = query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Ép buộc chỉ lấy danh mục đang hoạt động
        const forcedStatus: 'active' = 'active';

        const where: Prisma.CategoryWhereInput = {
            status: forcedStatus, // Luôn luôn là active
            ...(search && {
                OR: [
                    { categoryName: { contains: search } },
                    { description: { contains: search } },
                ],
            }),
            ...(parentId !== undefined && {
                parentId: parentId === 'null' ? null : parseInt(parentId),
            }),
        };

        const [categories, total] = await Promise.all([
            prisma.category.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { [sortBy]: sortOrder },
                // Chỉ chọn các trường cần thiết cho Khách hàng
                select: {
                    id: true,
                    categoryCode: true,
                    categoryName: true,
                    slug: true,
                    parentId: true,
                    description: true,
                    // Bỏ qua status, createdAt, updatedAt để giảm tải (vì status luôn là active)
                    parent: {
                        select: { id: true, categoryName: true },
                    },
                    _count: {
                        select: { products: true, children: true },
                    },
                },
            }),
            prisma.category.count({ where }),
        ]);

        const result = {
            data: categories,
            meta: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };

        return result;
    }

    // ========================================================
    // 2. GET CATEGORY TREE (Cây danh mục)
    // ========================================================
    async getCategoryTree() {

        const categories = await prisma.category.findMany({
            // Luôn luôn lọc status: 'active'
            where: { status: 'active' }, 
            select: {
                id: true,
                categoryCode: true,
                categoryName: true,
                slug: true,
                parentId: true,
                description: true,
                _count: {
                    select: { products: true },
                },
            },
            orderBy: { categoryName: 'asc' },
        });

        const tree = this.buildTree(categories, null);

        return tree;
    }

    // ========================================================
    // 3. GET CATEGORY BY ID (Chi tiết danh mục)
    // ========================================================
    async getCategoryById(id: number) {

        const category = await prisma.category.findUnique({
            where: { id, status: 'active' }, // Luôn lọc active ở đây
            select: {
                id: true,
                categoryCode: true,
                categoryName: true,
                slug: true,
                parentId: true,
                description: true,
                // Bỏ status, createdAt, updatedAt
                parent: {
                    select: { id: true, categoryName: true, slug: true },
                },
                children: {
                    where: { status: 'active' }, // Chỉ lấy con active
                    select: {
                        id: true, categoryName: true, slug: true,
                        _count: { select: { products: true } },
                    },
                },
                _count: { select: { products: true } },
            },
        });

        if (!category) {
            throw new NotFoundError('Danh mục không tồn tại hoặc không khả dụng');
        }

        return category;
    }

    // ========================================================
    // HELPER (Giữ nguyên)
    // ========================================================
    private buildTree(categories: any[], parentId: number | null): any[] {
        return categories
            .filter((cat) => cat.parentId === parentId)
            .map((cat) => ({
                ...cat,
                children: this.buildTree(categories, cat.id),
            }));
    }

    // ========================================================
    // BỎ QUA CÁC HÀM ADMIN/CS: 
    // createCategory, updateCategory, deleteCategory, checkCategoryCodeExists, checkSlugExists, checkCircularReference
    // ========================================================
}

export default new PublicCategoryService();