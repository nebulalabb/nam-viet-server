import { Router } from 'express';
import paymentReceiptController from '@controllers/payment-receipt.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createPaymentReceiptSchema,
  updatePaymentReceiptSchema,
  approveReceiptSchema,
  postReceiptSchema,
  paymentReceiptQuerySchema,
} from '@validators/payment-receipt.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/payment-receipts/summary - Get summary (must be before /:id)
router.get(
  '/summary',
  authorize('view_payment_receipts'),
  asyncHandler(paymentReceiptController.getSummary.bind(paymentReceiptController))
);

// GET /api/payment-receipts/customer/:customerId - Get by customer (must be before /:id)
router.get(
  '/customer/:customerId',
  authorize('view_payment_receipts'),
  asyncHandler(paymentReceiptController.getByCustomer.bind(paymentReceiptController))
);

// GET /api/payment-receipts - Get all payment receipts
router.get(
  '/',
  authorize('view_payment_receipts'),
  validate(paymentReceiptQuerySchema, 'query'),
  asyncHandler(paymentReceiptController.getAll.bind(paymentReceiptController))
);

// GET /api/payment-receipts/:id - Get payment receipt by ID
router.get(
  '/:id',
  authorize('view_payment_receipts'),
  asyncHandler(paymentReceiptController.getById.bind(paymentReceiptController))
);

// POST /api/payment-receipts - Create new payment receipt
router.post(
  '/',
  authorize('create_payment_receipt'),
  validate(createPaymentReceiptSchema),
  logActivityMiddleware('create', 'payment_receipt'),
  asyncHandler(paymentReceiptController.create.bind(paymentReceiptController))
);

// PUT /api/payment-receipts/:id - Update payment receipt
router.put(
  '/:id',
  authorize('update_payment_receipt'),
  validate(updatePaymentReceiptSchema),
  logActivityMiddleware('update', 'payment_receipt'),
  asyncHandler(paymentReceiptController.update.bind(paymentReceiptController))
);

// PUT /api/payment-receipts/:id/approve - Approve receipt
router.put(
  '/:id/approve',
  authorize('approve_payment_receipt'),
  validate(approveReceiptSchema),
  logActivityMiddleware('approve', 'payment_receipt'),
  asyncHandler(paymentReceiptController.approve.bind(paymentReceiptController))
);

// POST /api/payment-receipts/:id/post - Post receipt to accounting
router.post(
  '/:id/post',
  authorize('post_payment_receipt'),
  validate(postReceiptSchema),
  logActivityMiddleware('post', 'payment_receipt'),
  asyncHandler(paymentReceiptController.post.bind(paymentReceiptController))
);

// POST /api/payment-receipts/:id/send-email - Send email receipt
router.post(
  '/:id/send-email',
  authorize('send_email_payment_receipt'),
  logActivityMiddleware('send_email', 'payment_receipt'),
  asyncHandler(paymentReceiptController.sendEmail.bind(paymentReceiptController))
);

// DELETE /api/payment-receipts/:id - Delete payment receipt
router.delete(
  '/:id',
  authorize('delete_payment_receipt'),
  logActivityMiddleware('delete', 'payment_receipt'),
  asyncHandler(paymentReceiptController.delete.bind(paymentReceiptController))
);

export default router;
