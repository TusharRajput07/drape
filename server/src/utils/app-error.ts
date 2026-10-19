// Every error code the API can return (02 §5.1). The frontend branches on these.
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UPLOAD_INVALID',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'INVALID_CREDENTIALS',
  'SESSION_EXPIRED',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'SUBCATEGORY_EXISTS',
  'SUBCATEGORY_IN_USE',
  'ITEM_IN_USE',
  'OUTFIT_DUPLICATE',
  'WISHLIST_DUPLICATE',
  'OUTFIT_INVALID',
  'CONFIRMATION_REQUIRED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

// Thrown by services for expected failures; the error handler sends it as-is.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
