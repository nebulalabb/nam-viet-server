import { Router } from 'express';
import authController from '@controllers/auth.controller';
import { authentication } from '@middlewares/auth';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { loginRateLimiter, createRateLimiter } from '@middlewares/rateLimiter';
import {
  loginSchema,
  // refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOTPSchema,
  resendOTPSchema,
} from '@validators/auth.validator';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.login.bind(authController))
);

router.post('/logout', authentication, asyncHandler(authController.logout.bind(authController)));

router.post(
  '/authenticated',
  authentication,
  asyncHandler(authController.authenticated.bind(authController))
);

router.put(
  '/change-password',
  authentication,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword.bind(authController))
);

router.post(
  '/forgot-password',
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset requests',
  }),
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword.bind(authController))
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword.bind(authController))
);

// removed /me as it is replaced by /authenticated

router.post(
  '/verify-otp',
  loginRateLimiter,
  validate(verifyOTPSchema),
  asyncHandler(authController.verifyOTP.bind(authController))
);

router.post(
  '/resend-otp',
  createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 3, // Max 3 requests per minute
    message: 'Too many OTP requests. Please wait before requesting another code',
  }),
  validate(resendOTPSchema),
  asyncHandler(authController.resendOTP.bind(authController))
);

export default router;
