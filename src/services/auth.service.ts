import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '@utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/jwt';
import { AuthenticationError, NotFoundError, ValidationError } from '@utils/errors';
import { JwtPayload } from '@custom-types/common.type';
import { logActivity } from '@utils/logger';
import emailService from './email.service';

const prisma = new PrismaClient();

// Local Memory Maps for Rate Limiting and Token Blacklisting
const loginAttemptsMap = new Map<string, { attempts: number; expiry: number }>();
const tokenBlacklist = new Set<string>();

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 15 * 60;

class AuthService {
  // Login user
  async login(email: string, password: string, ipAddress?: string) {
    const loginAttempts = this.getLoginAttempts(email);
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockData = loginAttemptsMap.get(email);
      const lockTimeRemaining = lockData ? Math.ceil((lockData.expiry - Date.now()) / 1000) : 0;
      const minutesLeft = Math.ceil(lockTimeRemaining / 60);
      throw new AuthenticationError(
        `Tài khoản bị khóa do đăng nhập không thành công quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          select: {
            id: true,
            roleKey: true,
            roleName: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
    });

    if (!user) {
      this.incrementLoginAttempts(email);
      throw new AuthenticationError('Email hoặc mật khẩu không đúng');
    }

    if (user.status === 'locked') {
      throw new AuthenticationError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên');
    }

    if (user.status === 'inactive') {
      throw new AuthenticationError(
        'Tài khoản của bạn đang không hoạt động. Vui lòng liên hệ quản trị viên'
      );
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      this.incrementLoginAttempts(email);
      throw new AuthenticationError('Email hoặc mật khẩu không đúng');
    }

    this.clearLoginAttempts(email);

    // Create OTP code and send via email
    const { code, expiresIn } = await this.createOTPCode(user.id, user.email, ipAddress);

    // Send OTP via email
    const emailSent = await emailService.sendEmail({
      to: user.email,
      subject: 'Mã xác thực đăng nhập - Công Ty Nam Việt',
      html: this.getOTPEmailTemplate(user.fullName, code),
      text: `Xin chào ${user.fullName},\n\nMã xác thực đăng nhập của bạn là: ${code}\n\nMã này sẽ hết hạn sau 5 phút.\n\nTrân trọng,\nCông Ty Nam Việt`,
    });

    logActivity('login_otp_sent', user.id, 'auth', {
      ipAddress,
      emailSent,
    });

    // Return OTP required response
    return {
      requireOTP: true,
      email: user.email,
      expiresIn,
      // For development only - return code if email not configured
      code: process.env.NODE_ENV === 'development' && !emailSent ? code : undefined,
    };
  }

  // Logout user
  async logout(userId: number, accessToken: string) {
    tokenBlacklist.add(accessToken);
    // Auto cleanup logic could be added here, but for simplicity we rely on JWT maxAge


    logActivity('logout', userId, 'auth');

    return { message: 'Đăng xuất thành công' };
  }

  // Refresh access token
  async refreshToken(refreshToken: string) {
    // 1. JWT verification will throw if token is invalid or expired
    const decoded = verifyRefreshToken(refreshToken);



    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        employeeCode: true,
        roleId: true,
        warehouseId: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundError('Người dùng không tồn tại');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Tài khoản người dùng không hoạt động');
    }

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId || undefined,
      employeeCode: user.employeeCode,
    };

    const newAccessToken = generateAccessToken(payload);

    return {
      accessToken: newAccessToken,
      expiresIn: 15 * 60,
    };
  }

  // Change password
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('Người dùng không tồn tại');
    }

    const isOldPasswordValid = await comparePassword(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new ValidationError('Mật khẩu hiện tại không đúng');
    }

    const isSamePassword = await comparePassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new ValidationError('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    logActivity('update', userId, 'users', {
      recordId: userId,
      action: 'change_password',
    });

    // Send notification email
    await emailService.sendPasswordChangedEmail(user.email, user.fullName);

    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại' };
  }

  // Forgot password - Send reset token
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });

    if (!user) {
      return {
        message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi',
      };
    }

    if (user.status !== 'active') {
      return {
        message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi',
      };
    }

    const resetToken = this.generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    

    await prisma.verificationCode.create({
      data: {
        userId: user.id,
        email: user.email,
        code: resetToken,
        type: 'forgot_password' as any,
        expiresAt,
      },
    });

    // Send email with reset link
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      user.fullName,
      resetToken
    );

    // Log activity
    logActivity('forgot_password', user.id, 'auth', {
      email: user.email,
      emailSent,
    });

    return {
      message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi',
      // For development only - return token if email not configured or in dev mode
      resetToken: process.env.NODE_ENV === 'development' || !emailSent ? resetToken : undefined,
    };
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string) {
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        code: token,
        type: 'forgot_password' as any,
        isUsed: false,
      },
    });

    if (!verificationCode || new Date() > verificationCode.expiresAt) {
      throw new AuthenticationError('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    const userId = verificationCode.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('Người dùng không tồn tại');
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    logActivity('update', userId, 'users', {
      recordId: userId,
      action: 'reset_password',
    });

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới' };
  }

  // Get current user details
  async getCurrentUser(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            id: true,
            roleKey: true,
            roleName: true,
            description: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            address: true,
            city: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Người dùng không tồn tại');
    }

    // Get user permissions (Role + Direct)
    const permissions = await this.getUserPermissions(user.id, user.roleId);

    const { passwordHash, createdBy, updatedBy, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      permissions,
    };
  }

  // Helper methods
  // Update last login timestamp
  private async updateLastLogin(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }

  // Get login attempts count
  private getLoginAttempts(email: string): number {
    const data = loginAttemptsMap.get(email);
    if (!data) return 0;
    if (Date.now() > data.expiry) {
      loginAttemptsMap.delete(email);
      return 0;
    }
    return data.attempts;
  }

  // Increment login attempts
  private incrementLoginAttempts(email: string) {
    const data = loginAttemptsMap.get(email);
    if (data && Date.now() <= data.expiry) {
      data.attempts += 1;
    } else {
      loginAttemptsMap.set(email, {
        attempts: 1,
        expiry: Date.now() + LOGIN_LOCK_TIME * 1000,
      });
    }
  }

  // Clear login attempts
  private clearLoginAttempts(email: string) {
    loginAttemptsMap.delete(email);
  }

  // Generate reset token
  private generateResetToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate 6-digit OTP code
  private generateOTPCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Create and save OTP verification code
  async createOTPCode(
    userId: number,
    email: string,
    ipAddress?: string
  ): Promise<{ code: string; expiresIn: number }> {
    // Delete any existing unused OTP codes for this user
    await prisma.verificationCode.deleteMany({
      where: {
        userId,
        type: 'login_otp',
        isUsed: false,
      },
    });

    const code = this.generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.verificationCode.create({
      data: {
        userId,
        email,
        code,
        type: 'login_otp',
        expiresAt,
        ipAddress,
      },
    });

    return {
      code,
      expiresIn: 5 * 60, // 5 minutes in seconds
    };
  }

  // Helper method to get user permissions (Role + Direct)
  private async getUserPermissions(userId: number, roleId: number): Promise<string[]> {
    // 1. Get permissions from Role
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: {
          select: {
            permissionKey: true,
          },
        },
      },
    });

    const permissionsSet = new Set(rolePermissions.map((rp) => rp.permission.permissionKey));

    // 2. Get direct user permissions (Grant/Revoke)
    const userPermissions = await prisma.userPermission.findMany({
      where: { userId },
      include: {
        permission: {
          select: {
            permissionKey: true,
          },
        },
      },
    });

    // 3. Apply overrides
    for (const up of userPermissions) {
      if (up.grantType === 'grant') {
        permissionsSet.add(up.permission.permissionKey);
      } else if (up.grantType === 'revoke') {
        permissionsSet.delete(up.permission.permissionKey);
      }
    }

    return Array.from(permissionsSet);
  }

  // Verify OTP code and complete login
  async verifyOTPAndLogin(email: string, code: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          select: {
            id: true,
            roleKey: true,
            roleName: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
    });

    if (!user) {
      throw new AuthenticationError('Mã xác thực không hợp lệ');
    }

    // Find the OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        email,
        code,
        type: 'login_otp',
        isUsed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verificationCode) {
      throw new AuthenticationError('Mã xác thực không hợp lệ');
    }

    // Check if code is expired
    if (new Date() > verificationCode.expiresAt) {
      throw new AuthenticationError('Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới');
    }

    // Check max attempts (5 attempts)
    if (verificationCode.attempts >= 5) {
      throw new AuthenticationError('Quá nhiều lần nhập sai. Vui lòng yêu cầu mã mới');
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        attempts: verificationCode.attempts + 1,
      },
    });

    // Generate tokens
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId || undefined,
      employeeCode: user.employeeCode,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);


    // JWT signature handles the secure validation.

    await this.updateLastLogin(user.id);

    logActivity('login', user.id, 'auth', {
      ipAddress,
      userAgent: 'unknown',
      method: '2FA_OTP',
    });

    // Get user permissions (Role + Direct)
    const permissions = await this.getUserPermissions(user.id, user.roleId);

    // Prepare response
    const { passwordHash, createdBy, updatedBy, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        permissions,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
      },
    };
  }

  // Resend OTP code
  async resendOTPCode(email: string, ipAddress?: string): Promise<{ expiresIn: number }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });

    if (!user || user.status !== 'active') {
      throw new AuthenticationError('Yêu cầu không hợp lệ');
    }

    const { code, expiresIn } = await this.createOTPCode(user.id, user.email, ipAddress);

    // Send OTP via email
    await emailService.sendEmail({
      to: user.email,
      subject: 'Mã xác thực đăng nhập - Công Ty Nam Việt',
      html: this.getOTPEmailTemplate(user.fullName, code),
      text: `Xin chào ${user.fullName},\n\nMã xác thực đăng nhập của bạn là: ${code}\n\nMã này sẽ hết hạn sau 5 phút.\n\nTrân trọng,\nCông Ty Nam Việt`,
    });

    return { expiresIn };
  }

  // OTP Email Template
  private getOTPEmailTemplate(fullName: string, code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực đăng nhập</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Mã Xác Thực Đăng Nhập</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Xin chào <strong>${fullName}</strong>,</p>

    <p style="font-size: 14px; margin-bottom: 20px;">
      Bạn đã yêu cầu đăng nhập vào hệ thống <strong>Quản Lý Bán Hàng - Công Ty Nam Việt</strong>.
    </p>

    <div style="background: white; padding: 25px; border-radius: 10px; text-align: center; margin: 30px 0; border: 2px solid #16a34a;">
      <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Mã xác thực của bạn là:</p>
      <div style="font-size: 36px; font-weight: bold; color: #16a34a; letter-spacing: 8px; font-family: 'Courier New', monospace;">
        ${code}
      </div>
    </div>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⚠️ <strong>Lưu ý:</strong> Mã này chỉ có hiệu lực trong <strong>5 phút</strong>.
      </p>
    </div>

    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #721c24;">
        🚨 <strong>Bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      Trân trọng,<br>
      <strong>Công Ty Cổ Phần Hóa Sinh Nam Việt</strong>
    </p>
  </div>
</body>
</html>
    `;
  }
}

// Export token blacklist for middleware to use
export { tokenBlacklist };

export default new AuthService();
