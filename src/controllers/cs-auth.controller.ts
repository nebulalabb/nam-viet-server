import { Request, Response, NextFunction } from 'express';
import customerAuthService from '../services/cs-auth.service'; // Import Service đã dọn dẹp
import { AuthRequest } from '@custom-types/common.type'; // Type mở rộng của Express có req.user
import { BadRequestError, AuthenticationError } from '@utils/errors'; // File xử lý lỗi của bạn

// Cấu hình Cookie an toàn (HttpOnly)
const COOKIE_NAME = 'c_refresh_token';
const COOKIE_OPTIONS = {
    httpOnly: true, // Client JS không đọc được (Chống XSS)
    secure: process.env.NODE_ENV === 'production', // Chỉ HTTPS khi deploy
    sameSite: 'strict' as const, // Chống CSRF
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
};

class CustomerAuthController {

    // ============================================================
    // 1. LOGIN ZALO
    // ============================================================
    // POST /api/cs/auth/login-zalo
    async loginZalo(req: Request, res: Response, next: NextFunction) {
        try {
            const { code } = req.body;
            if (!code) throw new BadRequestError("Vui lòng cung cấp mã xác thực Zalo (code)");

            // Gọi Service: Hàm này nằm trong Service bạn đã thêm ở bước Zalo
            const result = await customerAuthService.loginZalo(code);

            // 1. Lưu Refresh Token vào Cookie
            res.cookie(COOKIE_NAME, result.tokens.refreshToken, COOKIE_OPTIONS);

            // 2. Trả về Access Token + Info
            res.status(200).json({
                success: true,
                message: "Đăng nhập Zalo thành công",
                data: {
                    customer: result.customer,
                    accessToken: result.tokens.accessToken,
                    // Cờ này báo cho FE biết user này có cần cập nhật SĐT hay không
                    requirePhoneCheck: result.requirePhoneCheck 
                },
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            next(error);
        }
    }

    // ============================================================
    // 2. SOCIAL LOGIN (Google / Facebook)
    // ============================================================
    // POST /api/cs/auth/social-login
    async socialLogin(req: Request, res: Response, next: NextFunction) {
        try {
            // Frontend gửi thông tin user sau khi login Firebase/Google xong
            const { uid, email, name, avatar, provider } = req.body;

            if (!uid || !provider) throw new BadRequestError("Dữ liệu đăng nhập không hợp lệ");

            // Gọi Service: syncSocialAccount
            const result = await customerAuthService.syncSocialAccount({
                uid, email, name, avatar, provider
            });

            // 1. Lưu Refresh Token vào Cookie
            res.cookie(COOKIE_NAME, result.tokens.refreshToken, COOKIE_OPTIONS);

            // 2. Trả về kết quả
            res.status(200).json({
                success: true,
                message: `Đăng nhập ${provider} thành công`,
                data: {
                    customer: result.customer,
                    accessToken: result.tokens.accessToken,
                    requirePhoneCheck: result.requirePhoneCheck
                },
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            next(error);
        }
    }

    // ============================================================
    // 3. REFRESH TOKEN
    // ============================================================
    // POST /api/cs/auth/refresh-token
    async refreshToken(req: Request, res: Response, next: NextFunction) {
        try {
            // Lấy token từ Cookie (Thay vì Body)
            const refreshToken = req.cookies[COOKIE_NAME];

            if (!refreshToken) {
                throw new AuthenticationError('Phiên đăng nhập đã hết hạn hoặc không tồn tại');
            }

            // Gọi Service verify và cấp lại token
            const tokens = await customerAuthService.refreshAccessToken(refreshToken);

            // 1. Cập nhật Cookie mới (Token Rotation)
            res.cookie(COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);

            // 2. Trả về Access Token mới
            res.status(200).json({
                success: true,
                data: {
                    accessToken: tokens.accessToken,
                    expiresIn: 15 * 60, // 15 phút
                },
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            // Nếu lỗi (Hết hạn, token fake) -> Xóa cookie để logout hẳn
            res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });
            next(error);
        }
    }

    // ============================================================
    // 4. LOGOUT
    // ============================================================
    // POST /api/cs/auth/logout
    async logout(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // req.user có được nhờ middleware xác thực (AuthGuard)
            const userId = req.user?.id; 
            const accessToken = req.headers.authorization?.substring(7) || ''; 

            if (userId) {
                // Gọi Service để xóa session Redis
                await customerAuthService.logout(userId, accessToken);
            }

            // Xóa Cookie trình duyệt
            res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });

            res.status(200).json({
                success: true,
                message: "Đăng xuất thành công",
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            next(error);
        }
    }

    // ============================================================
    // 6. CHECK PHONE EXISTENCE (Dùng cho UI cập nhật SĐT)
    // ============================================================
    // POST /api/cs/auth/check-phone
    async checkPhone(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone } = req.body;
            if(!phone) throw new BadRequestError("Vui lòng nhập số điện thoại");

            const result = await customerAuthService.checkPhoneExistence(phone);

            res.status(200).json({
                success: true,
                data: result, // { exists: true/false }
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new CustomerAuthController();