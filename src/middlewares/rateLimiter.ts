import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RateLimitError } from '@utils/errors';
import { Request, Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';

class MemoryStore {
  prefix: string;
  windowMs: number;
  private store = new Map<string, { hits: number; resetTime: number }>();

  constructor(windowMs: number, prefix: string = 'rate-limit') {
    this.prefix = prefix;
    this.windowMs = windowMs;

    // Periodic cleanup of expired entries
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now > data.resetTime) {
        this.store.delete(key);
      }
    }
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const fullKey = `${this.prefix}:${key}`;
    const now = Date.now();
    
    let data = this.store.get(fullKey);
    if (!data || now > data.resetTime) {
      data = { hits: 1, resetTime: now + this.windowMs };
    } else {
      data.hits += 1;
    }
    
    this.store.set(fullKey, data);

    return {
      totalHits: data.hits,
      resetTime: new Date(data.resetTime),
    };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    const data = this.store.get(fullKey);
    if (data && data.hits > 0) {
      data.hits -= 1;
      this.store.set(fullKey, data);
    }
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    this.store.delete(fullKey);
  }
}

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Quá nhiều yêu cầu, vui lòng chậm lại');
  },
  skip: () => true,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Quá nhiều lần đăng nhập, tài khoản tạm thời bị khóa');
  },
});

export const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  message: 'Đã vượt quá giới hạn tốc độ API',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) return req.user.id.toString();
    return ipKeyGenerator(req);
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Quá nhiều yêu cầu API từ người dùng này');
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Quá nhiều lần tải lên file',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) return req.user.id.toString();
    return ipKeyGenerator(req);
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Quá nhiều lần tải lên file');
  },
});

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Quá nhiều yêu cầu',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => ipKeyGenerator(req as any)),
    handler: (_req: Request, _res: Response) => {
      throw new RateLimitError(options.message || 'Quá nhiều yêu cầu');
    },
  });
};

export const createMemoryRateLimiter = (options: {
  windowMs: number;
  max: number;
  prefix?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  const store = new MemoryStore(options.windowMs, options.prefix);

  return async (req: AuthRequest, res: Response, next: Function) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : req.user?.id?.toString() || ipKeyGenerator(req as any);

    try {
      const { totalHits, resetTime } = await store.increment(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - totalHits).toString());
      if (resetTime) {
        res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
      }

      if (totalHits > options.max) {
        throw new RateLimitError('Quá nhiều yêu cầu');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
