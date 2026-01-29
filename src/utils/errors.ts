import { ErrorCode } from '@custom-types/common.type';
export class AppError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: any;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code: ErrorCode, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 401, ErrorCode.AUTHENTICATION_ERROR, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, ErrorCode.AUTHORIZATION_ERROR);
  }
}

export class SendEmailOutLimitError extends AppError {
  constructor(message: string = 'Không được gửi email quá 3 lần!') {
    super(message, 403, ErrorCode.AUTHORIZATION_ERROR);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, ErrorCode.CONFLICT, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Quá nhiều yêu cầu') {
    super(message, 429, ErrorCode.RATE_LIMIT_ERROR);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, 500, ErrorCode.DATABASE_ERROR, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    // Sử dụng ErrorCode.BAD_REQUEST vừa thêm
    super(message, 400, ErrorCode.BAD_REQUEST, details);
  }
}
