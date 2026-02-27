import { Router } from 'express';
import salesOrderController from '@controllers/sales-order.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  approveOrderSchema,
  cancelOrderSchema,
  processPaymentSchema,
  salesOrderQuerySchema,
} from '@validators/sales-order.validator';
import { logActivityMiddleware } from '@middlewares/logger';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/sales-orders - Get all sales orders
router.get(
  '/',
  authorize('view_sales_orders'),
  validate(salesOrderQuerySchema, 'query'),
  asyncHandler(salesOrderController.getAll.bind(salesOrderController))
);

// GET /api/sales-orders/:id - Get sales order by ID
router.get(
  '/:id',
  authorize('view_sales_orders'),
  asyncHandler(salesOrderController.getById.bind(salesOrderController))
);

// POST /api/sales-orders - Create new sales order
router.post(
  '/',
  authorize('create_sales_order'),
  validate(createSalesOrderSchema),
  logActivityMiddleware('create', 'sales_order'),
  asyncHandler(salesOrderController.create.bind(salesOrderController))
);

// PUT /api/sales-orders/:id - Update sales order
router.put(
  '/:id',
  authorize('update_sales_order'),
  validate(updateSalesOrderSchema),
  logActivityMiddleware('update', 'sales_order'),
  asyncHandler(salesOrderController.update.bind(salesOrderController))
);

// PUT /api/sales-orders/:id/approve - Approve order
router.put(
  '/:id/approve',
  authorize('approve_sales_order'),
  validate(approveOrderSchema),
  logActivityMiddleware('approve', 'sales_order'),
  asyncHandler(salesOrderController.approve.bind(salesOrderController))
);

// PUT /api/sales-orders/:id/complete - Complete order
router.put(
  '/:id/complete',
  authorize('complete_sales_order'),
  logActivityMiddleware('complete', 'sales_order'),
  asyncHandler(salesOrderController.complete.bind(salesOrderController))
);

// PUT /api/sales-orders/:id/cancel - Cancel order
router.put(
  '/:id/cancel',
  authorize('cancel_sales_order'),
  validate(cancelOrderSchema),
  logActivityMiddleware('cancel', 'sales_order'),
  asyncHandler(salesOrderController.cancel.bind(salesOrderController))
);

// POST /api/sales-orders/:id/payment - Process payment
router.post(
  '/:id/payment',
  authorize('process_payment'),
  validate(processPaymentSchema),
  logActivityMiddleware('process', 'sales_order'),
  asyncHandler(salesOrderController.processPayment.bind(salesOrderController))
);

// DELETE /api/sales-orders/:id - Delete order
router.delete(
  '/:id',
  authorize('delete_sales_order'),
  logActivityMiddleware('delete', 'sales_order'),
  asyncHandler(salesOrderController.delete.bind(salesOrderController))
);

export default router;
