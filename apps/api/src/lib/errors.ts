/**
 * Every error response uses the shared envelope: { error: { code, message, details? } }
 * (docs/planning/04-sprint-1-detailed-plan.md, API contract).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = "UNAUTHORIZED", message = "Unauthorized") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(429, "RATE_LIMITED", message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable, please try again shortly", cause?: unknown) {
    super(503, "SERVICE_UNAVAILABLE", message, undefined, cause);
  }
}

export function errorBody(err: AppError) {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  };
}
