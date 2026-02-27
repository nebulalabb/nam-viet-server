import { Router } from 'express';
import paymentVoucherController from '@controllers/payment-voucher.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createPaymentVoucherSchema,
  updatePaymentVoucherSchema,
  approveVoucherSchema,
  postVoucherSchema,
  paymentVoucherQuerySchema,
} from '@validators/payment-voucher.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/payment-vouchers/statistics - Get statistics (must be before /:id)
router.get(
  '/statistics',
  authorize('view_payment_vouchers'),
  asyncHandler(paymentVoucherController.getStatistics.bind(paymentVoucherController))
);

// GET /api/payment-vouchers/report/expense - Get expense report (must be before /:id)
router.get(
  '/report/expense',
  authorize('view_payment_vouchers'),
  asyncHandler(paymentVoucherController.getExpenseReport.bind(paymentVoucherController))
);

// GET /api/payment-vouchers/summary - Get summary (must be before /:id)
router.get(
  '/summary',
  authorize('view_payment_vouchers'),
  asyncHandler(paymentVoucherController.getSummary.bind(paymentVoucherController))
);

// GET /api/payment-vouchers/supplier/:supplierId - Get by supplier (must be before /:id)
router.get(
  '/supplier/:supplierId',
  authorize('view_payment_vouchers'),
  asyncHandler(paymentVoucherController.getBySupplier.bind(paymentVoucherController))
);

// GET /api/payment-vouchers - Get all payment vouchers
router.get(
  '/',
  authorize('view_payment_vouchers'),
  validate(paymentVoucherQuerySchema, 'query'),
  asyncHandler(paymentVoucherController.getAll.bind(paymentVoucherController))
);

// GET /api/payment-vouchers/:id - Get payment voucher by ID
router.get(
  '/:id',
  authorize('view_payment_vouchers'),
  asyncHandler(paymentVoucherController.getById.bind(paymentVoucherController))
);

// POST /api/payment-vouchers - Create new payment voucher
router.post(
  '/',
  authorize('create_payment_voucher'),
  validate(createPaymentVoucherSchema),
  logActivityMiddleware('create', 'payment_voucher'),
  asyncHandler(paymentVoucherController.create.bind(paymentVoucherController))
);

// PUT /api/payment-vouchers/:id/approve - Approve voucher
router.put(
  '/:id/approve',
  authorize('approve_payment'),
  validate(approveVoucherSchema),
  logActivityMiddleware('approve', 'payment_voucher'),
  asyncHandler(paymentVoucherController.approve.bind(paymentVoucherController))
);

// PUT /api/payment-vouchers/:id - Update payment voucher
router.put(
  '/:id',
  authorize('update_payment_voucher'),
  validate(updatePaymentVoucherSchema),
  logActivityMiddleware('update', 'payment_voucher'),
  asyncHandler(paymentVoucherController.update.bind(paymentVoucherController))
);

// POST /api/payment-vouchers/:id/post - Post voucher to accounting
router.post(
  '/:id/post',
  authorize('post_payment_voucher'),
  validate(postVoucherSchema),
  logActivityMiddleware('post', 'payment_voucher'),
  asyncHandler(paymentVoucherController.post.bind(paymentVoucherController))
);

// DELETE /api/payment-vouchers/:id/unpost - Unpost voucher (Revert)
router.delete(
  '/:id/unpost',
  authorize('post_payment_voucher'),
  logActivityMiddleware('unpost', 'payment_voucher'),
  asyncHandler(paymentVoucherController.unpost.bind(paymentVoucherController))
);

// POST /api/payment-vouchers/bulk-post - Bulk post vouchers
router.post(
  '/bulk-post',
  authorize('post_payment_voucher'),
  logActivityMiddleware('bulkPost', 'payment_voucher'),
  asyncHandler(paymentVoucherController.bulkPost.bind(paymentVoucherController))
);

// DELETE /api/payment-vouchers/:id - Delete payment voucher
router.delete(
  '/:id',
  authorize('delete_payment_voucher'),
  logActivityMiddleware('delete', 'payment_voucher'),
  asyncHandler(paymentVoucherController.delete.bind(paymentVoucherController))
);

export default router;
