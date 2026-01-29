import { Router } from 'express';
// ✅ Import Controller Auth mới
import accountController from '../controllers/cs-auth.controller'; 
import { validateNested } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/errorHandler';
import { customerAuthentication } from '../middlewares/authCustomer'; // Middleware verify token

import {
    socialLoginSchema,
    checkPhoneSchema 
    // Các schema khác như loginPasswordSchema, setPasswordSchema... ĐÃ BỎ
} from '../validators/customer_account.validator';

const router = Router();

// ==========================================
// 1. PUBLIC ROUTES (Không cần đăng nhập)
// ==========================================

// 1.1 Login Zalo (MỚI)
// Nhận vào { code: string }
router.post(
    '/login-zalo', 
    asyncHandler(accountController.loginZalo.bind(accountController))
);

// 1.2 Login Social (Google/FB)
// Nhận vào { uid, email, name, avatar, provider }
router.post(
    '/social-login',
    validateNested(socialLoginSchema), // Validate input đầu vào
    asyncHandler(accountController.socialLogin.bind(accountController))
);

// 1.3 Refresh Token (Cấp lại Access Token mới)
// Nhận cookie c_refresh_token
router.post(
    '/refresh-token',
    asyncHandler(accountController.refreshToken.bind(accountController))
);

// 1.4 Kiểm tra SĐT (Dùng cho UI cập nhật Profile)
// Nhận vào { phone: string }
router.post(
    '/check-phone', 
    validateNested(checkPhoneSchema),
    asyncHandler(accountController.checkPhone.bind(accountController))
);

// ==========================================
// 2. PROTECTED ROUTES (Cần Token)
// ==========================================

// Áp dụng middleware xác thực cho các route bên dưới
router.use(customerAuthentication); 

// 2.1 Đăng xuất
// Cần token để backend biết user nào đang logout (để clear session Redis)
router.post(
    '/logout',
    asyncHandler(accountController.logout.bind(accountController))
);


export default router;