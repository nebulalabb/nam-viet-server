import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticationError } from '@utils/errors';

/**
 * Custom CSRF Protection Middleware
 *
 * Implements Double Submit Cookie pattern
 * Tokens are temporarily stored in memory.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_TTL = 60 * 60; // 1 hour

// Memory Map for CSRF tokens
const csrfTokensMap = new Map<string, { token: string, expiry: number }>();

// Simple cleanup function
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of csrfTokensMap.entries()) {
    if (now > data.expiry) {
      csrfTokensMap.delete(key);
    }
  }
}, 60000);

/**
 * Generate CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Store CSRF token in memory Map
 */
async function storeCsrfToken(token: string, userId?: number): Promise<void> {
  const key = userId ? `csrf:user:${userId}` : `csrf:${token}`;
  
  csrfTokensMap.set(key, {
    token,
    expiry: Date.now() + CSRF_TOKEN_TTL * 1000
  });
}

/**
 * Verify CSRF token
 */
async function verifyCsrfToken(token: string, userId?: number): Promise<boolean> {
  if (!token) return false;

  const key = userId ? `csrf:user:${userId}` : `csrf:${token}`;
  
  const data = csrfTokensMap.get(key);
  if (!data || Date.now() > data.expiry) {
    if (data) csrfTokensMap.delete(key);
    return false;
  }
  
  return data.token === token;
}

/**
 * CSRF Token Generation Middleware
 * Generates and attaches CSRF token to response
 */
export async function csrfTokenGenerator(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = generateCsrfToken();
    const userId = (req as any).user?.id;

    // Store token in memory
    await storeCsrfToken(token, userId);

    // Attach token to response
    res.locals.csrfToken = token;

    // Set CSRF token in cookie (httpOnly for security)
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Allow JavaScript to read for sending in headers
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_TTL * 1000,
    });

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * CSRF Protection Middleware
 * Validates CSRF token from request
 */
export async function csrfProtection(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  try {
    // Get token from header or body
    const token =
      req.headers['x-csrf-token'] as string ||
      req.headers['x-xsrf-token'] as string ||
      req.body?.csrfToken ||
      req.query.csrfToken as string;

    if (!token) {
      throw new AuthenticationError('CSRF token missing');
    }

    const userId = (req as any).user?.id;
    const isValid = await verifyCsrfToken(token, userId);

    if (!isValid) {
      throw new AuthenticationError('Invalid CSRF token');
    }

    // Regenerate token after successful validation
    const newToken = generateCsrfToken();
    await storeCsrfToken(newToken, userId);
    res.locals.csrfToken = newToken;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(403).json({
        success: false,
        message: error.message,
        error: 'CSRF_TOKEN_INVALID',
      });
    } else {
      next(error);
    }
  }
}

/**
 * Get CSRF Token Endpoint Handler
 * Returns current CSRF token for client
 */
export async function getCsrfToken(req: Request, res: Response): Promise<void> {
  const token = res.locals.csrfToken || generateCsrfToken();
  const userId = (req as any).user?.id;

  await storeCsrfToken(token, userId);

  res.json({
    success: true,
    data: {
      csrfToken: token,
    },
  });
}

export default {
  csrfTokenGenerator,
  csrfProtection,
  getCsrfToken,
};
