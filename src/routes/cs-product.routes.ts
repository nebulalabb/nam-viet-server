import { Router } from 'express';
import publicProductController from '@controllers/cs-product.controller';
import { asyncHandler } from '@middlewares/errorHandler';
import { optionalCustomerAuthentication } from '@middlewares/authCustomer';

const router = Router();

// ==========================================
// PUBLIC PRODUCT ROUTES
// ==========================================
router.get(
  '/',
  optionalCustomerAuthentication,
  asyncHandler(publicProductController.getAll.bind(publicProductController))
);

router.get(
  '/:slug',
  optionalCustomerAuthentication,
  asyncHandler(publicProductController.getById.bind(publicProductController))
);

export default router;
