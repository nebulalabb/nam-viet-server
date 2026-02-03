import { PrismaClient, AuthProvider, CustomerType } from '@prisma/client';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@utils/errors';
import CustomerRedisService from './cs-redis.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/cs-jwt';
import customerService from './cs-customer.service';
import axios from 'axios';
import qs from 'qs';

const prisma = new PrismaClient();
const csRedis = CustomerRedisService.getInstance();

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    phone = phone.trim();
    if (phone.startsWith('+84')) return phone.substring(1);
    if (phone.startsWith('0')) return '84' + phone.substring(1);
    if (!phone.startsWith('84') && phone.length < 10) return '84' + phone;
    return phone;
}

class CustomerAuthService {

    private async createSession(account: any) {
        const payload = { customerId: account.customerId, role: 'customer' as const };
        
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        await csRedis.setSessionRefreshToken(account.id, refreshToken);

        await prisma.customerAccount.update({
            where: { id: account.id },
            data: { lastLogin: new Date() }
        });

        return { accessToken, refreshToken };
    }

    // =================================================================
    // 1. LOGIN ZALO
    // =================================================================
    async loginZalo(code: string) {
        if (!code) throw new BadRequestError("Thiếu mã xác thực Zalo (Code)");

        console.log("🚀 [Service] Đang xử lý Login Zalo với code:", code);

        const tokenUrl = "https://oauth.zalo.me/v4/access_token";
        const secretKey = process.env.ZALO_SECRET_KEY;
        const appId = process.env.ZALO_APP_ID;

        const tokenBody = {
            app_id: appId,
            code: code,
            grant_type: "authorization_code",
        };

        const tokenConfig = {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                secret_key: secretKey
            }
        };

        let accessToken = "";
        try {
            const { data } = await axios.post(tokenUrl, qs.stringify(tokenBody), tokenConfig);
            if (data.error) {
                console.error("❌ Lỗi Token Zalo:", data);
                throw new Error(data.error_name + ": " + data.error_description);
            }
            accessToken = data.access_token;
        } catch (error: any) {
            console.error("❌ Lỗi kết nối Zalo:", error.message);
            throw new BadRequestError("Không thể xác thực với Zalo. Vui lòng thử lại.");
        }

        let zaloProfile;
        try {
            const { data } = await axios.get("https://graph.zalo.me/v2.0/me", {
                params: {
                    access_token: accessToken,
                    fields: "id,name,picture"
                }
            });
            zaloProfile = data;
        } catch (error: any) {
             throw new BadRequestError("Lỗi khi lấy thông tin người dùng Zalo");
        }

        const socialPayload = {
            uid: zaloProfile.id,      
            email: undefined,
            name: zaloProfile.name,
            avatar: zaloProfile.picture?.data?.url || "",
            provider: AuthProvider.ZALO
        };

        return await this.syncSocialAccount(socialPayload);
    }

    // =================================================================
    // 2. SYNC SOCIAL ACCOUNT
    // =================================================================
    async syncSocialAccount(payload: { uid: string; email?: string; name: string; avatar?: string; provider: AuthProvider }) {
        let account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: payload.uid },
            include: { customer: true }
        });

        if (!account) {
             let customer = null;
             
             if (payload.email) {
                 customer = await prisma.customer.findFirst({ where: { email: payload.email } });
             }

             if (!customer) {
                 customer = await prisma.customer.create({
                    data: {
                        customerCode: `KH-${Date.now()}`,
                        customerName: payload.name || 'Khách hàng mới',
                        email: payload.email,
                        avatarUrl: payload.avatar,
                        customerType: CustomerType.individual,
                        contactPerson: payload.name,
                        phone: null, 
                    }
                 });
             }

             account = await prisma.customerAccount.create({
                data: {
                    customerId: customer.id,
                    accountIdentifier: payload.uid,
                    authProvider: payload.provider,
                    isVerified: true,
                    isActive: true,
                    lastLogin: new Date()
                },
                include: { customer: true }
             });
        }

        if (!account.isActive) throw new AuthorizationError('Tài khoản đã bị khóa');

        const tokens = await this.createSession(account);

        const requirePhoneCheck = customerService.checkIfNeedPhoneVerification(
            account.customer,
            account.authProvider
        );

        return {
            customer: account.customer,
            tokens,
            requirePasswordSet: false,
            requirePhoneCheck
        };
    }

    // =================================================================
    // 3. REFRESH TOKEN
    // =================================================================
    async refreshAccessToken(refreshTokenInput: string) {
        const decoded = verifyRefreshToken(refreshTokenInput);

        const account = await prisma.customerAccount.findUnique({
            where: { customerId: decoded.customerId },
        });

        if (!account || !account.isActive) {
            throw new AuthenticationError('Account not found or inactive');
        }

        const storedToken = await csRedis.getSessionRefreshToken(account.id);

        if (!storedToken || storedToken !== refreshTokenInput) {
            await csRedis.clearSession(account.id);
            throw new AuthenticationError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
        }

        const tokens = await this.createSession(account);
        return tokens;
    }

    // =================================================================
    // 4. LOGOUT
    // =================================================================
    async logout(customerId: number, accessToken: string) {
        const account = await prisma.customerAccount.findUnique({ where: { customerId } });
        
        if (account) {
            await csRedis.clearSession(account.id);
        }
        await csRedis.blacklistToken(accessToken);
        return { message: 'Đăng xuất thành công' };
    }

    // =================================================================
    // 5. CHECK PHONE EXISTENCE
    // =================================================================
    async checkPhoneExistence(phoneInput: string) {
        const phone = normalizePhone(phoneInput);
        if(!phone) return { exists: false };

        const customer = await prisma.customer.findFirst({
            where: { phone },
        });

        return { exists: !!customer };
    }

    // =================================================================
    // 6. GET ACCOUNT
    // =================================================================
    async getAccountByCustomerId(customerId: number) {
        const cacheKey = `c_cache:account:${customerId}`; 
        
        const cached = await csRedis.get(cacheKey);
        if (cached) return cached;

        const account = await prisma.customerAccount.findUnique({
            where: { customerId },
            include: { customer: true }
        });

        if (!account) throw new NotFoundError('Tài khoản không tồn tại');

        await csRedis.set(cacheKey, account, 3600); 
        return account;
    }
}

export default new CustomerAuthService();