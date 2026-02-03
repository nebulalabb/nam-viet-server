import { Router } from 'express';
import promotionController from '@controllers/promotion.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  promotionQuerySchema,
  createPromotionSchema,
  updatePromotionSchema,
  approvePromotionSchema,
  cancelPromotionSchema,
  applyPromotionSchema,
  getActivePromotionsSchema,
} from '@validators/promotion.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/promotions - Get all promotions
router.get(
  '/',
  authorize('view_promotions'),
  validate(promotionQuerySchema, 'query'),
  asyncHandler(promotionController.getAll.bind(promotionController))
);

// GET /api/promotions/active - Get active promotions (before /:id to avoid conflict)
router.get(
  '/active',
  validate(getActivePromotionsSchema, 'query'),
  asyncHandler(promotionController.getActive.bind(promotionController))
);

// POST /api/promotions/auto-expire - Auto expire promotions (cron job)
router.post(
  '/auto-expire',
  authorize('manage_promotions'),
  asyncHandler(promotionController.autoExpire.bind(promotionController))
);

router.get(
  '/statistics',
  authorize('view_promotions'),
  asyncHandler(promotionController.getStatistics.bind(promotionController))
);
// GET /api/promotions/:id - Get promotion by ID
router.get(
  '/:id',
  authorize('view_promotions'),
  asyncHandler(promotionController.getById.bind(promotionController))
);

// POST /api/promotions - Create new promotion
router.post(
  '/',
  authorize('create_promotion'),
  validate(createPromotionSchema),
  logActivityMiddleware('create', 'promotion'),
  asyncHandler(promotionController.create.bind(promotionController))
);

// PUT /api/promotions/:id - Update promotion
router.put(
  '/:id',
  authorize('update_promotion'),
  validate(updatePromotionSchema),
  logActivityMiddleware('update', 'promotion'),
  asyncHandler(promotionController.update.bind(promotionController))
);

// PUT /api/promotions/:id/approve - Approve promotion
router.put(
  '/:id/approve',
  authorize('approve_promotion'),
  validate(approvePromotionSchema),
  logActivityMiddleware('approve', 'promotion'),
  asyncHandler(promotionController.approve.bind(promotionController))
);

// DELETE /api/promotions/:id - Cancel promotion
router.delete(
  '/:id',
  authorize('cancel_promotion'),
  validate(cancelPromotionSchema),
  logActivityMiddleware('cancel', 'promotion'),
  asyncHandler(promotionController.cancel.bind(promotionController))
);

// POST /api/promotions/:id/apply - Apply promotion to order
router.post(
  '/:id/apply',
  validate(applyPromotionSchema),
  logActivityMiddleware('apply', 'promotion'),
  asyncHandler(promotionController.apply.bind(promotionController))
);

export default router;
