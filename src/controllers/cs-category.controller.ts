import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import categoryService from '@services/category.service'; // Vẫn dùng Service chung
import { ApiResponse } from '@custom-types/common.type';
import { NotFoundError } from '@utils/errors';

class PublicCategoryController {

    // GET /api/public/categories (Lấy danh sách, có thể filter theo status='active')
    async getAllCategories(req: AuthRequest, res: Response) {
        // Khách hàng chỉ nên xem các danh mục có status là 'active'
        const query = {
            ...req.query,
            status: 'active'
        };

        const result = await categoryService.getAllCategories(query as any);

        const response: ApiResponse = {
            success: true,
            data: result.data,
            meta: result.meta,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }

    // GET /api/public/categories/tree (Cây danh mục, đã tự lọc status='active' trong Service)
    async getCategoryTree(_req: AuthRequest, res: Response) {
        const tree = await categoryService.getCategoryTree();

        const response: ApiResponse = {
            success: true,
            data: tree,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }

    // GET /api/public/categories/:id (Chi tiết 1 danh mục)
    async getCategoryById(req: AuthRequest, res: Response) {
        const id = parseInt(req.params.id);
        const category = await categoryService.getCategoryById(id);

        // Thêm kiểm tra: Khách hàng chỉ nên thấy danh mục đang active
        if (!category || category.status !== 'active') {
            throw new NotFoundError('Danh mục không tồn tại hoặc không khả dụng');
        }

        const response: ApiResponse = {
            success: true,
            data: category,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }
}

export default new PublicCategoryController();