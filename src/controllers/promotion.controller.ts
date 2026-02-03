import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import promotionService from '@services/promotion.service';
import {
  CreatePromotionInput,
  UpdatePromotionInput,
  ApplyPromotionInput,
  PromotionQueryInput,
} from '@validators/promotion.validator';

class PromotionController {
  // GET /api/promotions - Get all promotions
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as PromotionQueryInput;
      const result = await promotionService.getAll(query);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        statistics: result.statistics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // GET /api/promotions/:id - Get promotion by ID
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const promotion = await promotionService.getById(id);

      res.json({
        success: true,
        data: promotion,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  async getStatistics(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const statistics = await promotionService.getStatistics();

      res.json({
        success: true,
        data: statistics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  // POST /api/promotions - Create new promotion
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreatePromotionInput;
      console.log("concocquy", data)
      const userId = req.user!.id;

      const promotion = await promotionService.create(data, userId);

      res.status(201).json({
        success: true,
        data: promotion,
        message: 'Tạo khuyến mãi thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // PUT /api/promotions/:id - Update promotion
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as UpdatePromotionInput;
      const userId = req.user!.id;

      const promotion = await promotionService.update(id, data, userId);

      res.json({
        success: true,
        data: promotion,
        message: 'Cập nhật khuyến mãi thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // PUT /api/promotions/:id/approve - Approve promotion
  async approve(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;

      const promotion = await promotionService.approve(id, userId);

      res.json({
        success: true,
        data: promotion,
        message: 'Phê duyệt khuyến mãi thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // DELETE /api/promotions/:id - Cancel promotion
  async cancel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const userId = req.user!.id;

      const promotion = await promotionService.cancel(id, reason, userId);

      res.json({
        success: true,
        data: promotion,
        message: 'Hủy khuyến mãi thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // DELETE /api/promotions/:id/delete - Delete promotion
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;

      const promotion = await promotionService.delete(id, userId);

      res.json({
        success: true,
        data: promotion,
        message: 'Xóa khuyến mãi thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // GET /api/promotions/active - Get active promotions
  async getActive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { date } = req.query;
      const promotions = await promotionService.getActive(date as string);

      res.json({
        success: true,
        data: promotions,
        count: promotions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // POST /api/promotions/:id/apply - Apply promotion to order
  async apply(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as ApplyPromotionInput;

      const result = await promotionService.apply(id, data);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // POST /api/promotions/auto-expire - Auto expire promotions (cron job)
  async autoExpire(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const count = await promotionService.autoExpirePromotions();

      res.json({
        success: true,
        data: { expiredCount: count },
        message: `Đã hết hạn ${count} khuyến mãi`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

export default new PromotionController();
