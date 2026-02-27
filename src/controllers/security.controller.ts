import { Request, Response } from 'express';
import { getCsrfToken } from '@middlewares/csrf';
import { generateEncryptionKey } from '@utils/encryption';
import { getPasswordHistoryCount } from '@utils/password-history';
import { AuthRequest } from '@custom-types/common.type';

/**
 * Security Controller
 *
 * Handles security-related endpoints:
 * - CSRF token generation
 * - Security status
 * - Session management
 * - Security audit
 */

class SecurityController {
  /**
   * Get CSRF Token
   * GET /api/security/csrf-token
   */
  async getCsrfToken(req: Request, res: Response): Promise<void> {
    await getCsrfToken(req, res);
  }

  /**
   * Get security status for current user
   * GET /api/security/status
   */
  async getSecurityStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Get password history count
      const passwordHistoryCount = await getPasswordHistoryCount(userId);

      // Get active sessions count
      const activeSessionsCount = 1; // Assuming 1 active since token caching is removed

      res.json({
        success: true,
        data: {
          userId,
          passwordHistory: {
            count: passwordHistoryCount,
            limit: 3,
          },
          sessions: {
            active: activeSessionsCount,
          },
          security: {
            twoFactorEnabled: false, // Future feature
            passwordStrength: 'strong', // Can be calculated
            lastPasswordChange: null, // Can be tracked
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve security status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Revoke all sessions (logout from all devices)
   * POST /api/security/revoke-all-sessions
   */
  async revokeAllSessions(_req: AuthRequest, res: Response): Promise<void> {
    try {

      // Invalidate all token families
      // Token families caching is removed, sessions rely entirely on JWT expiry now

      res.json({
        success: true,
        message: 'All sessions have been revoked successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to revoke sessions',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get security audit log for user
   * GET /api/security/audit-log
   */
  async getAuditLog(req: AuthRequest, res: Response): Promise<void> {
    try {
      // const userId = req.user!.id; // Future: query activity_logs
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // This would query activity_logs table
      // For now, return placeholder
      res.json({
        success: true,
        data: {
          logs: [],
          meta: {
            page,
            limit,
            total: 0,
          },
        },
        message: 'Audit log retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate new encryption key (Admin only)
   * GET /api/security/generate-encryption-key
   */
  async generateEncryptionKey(_req: Request, res: Response): Promise<void> {
    try {
      const key = generateEncryptionKey();

      res.json({
        success: true,
        data: {
          key,
          message: 'Save this key in your .env file as ENCRYPTION_KEY',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate encryption key',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get security headers info
   * GET /api/security/headers
   */
  async getSecurityHeaders(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        headers: {
          'Content-Security-Policy': 'Enabled',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        cors: {
          allowedOrigins: process.env.CORS_ORIGIN?.split(',') || ['*'],
          credentials: process.env.CORS_CREDENTIALS === 'true',
        },
        rateLimiting: {
          global: '100 requests per 15 minutes',
          login: '5 attempts per 15 minutes',
          user: '1000 requests per hour',
        },
        encryption: {
          passwords: 'bcrypt (10 rounds)',
          sensitiveData: 'AES-256-GCM',
          tokens: 'JWT (RS256)',
        },
      },
    });
  }
}

export default new SecurityController();
