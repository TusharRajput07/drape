import type { Response } from 'express';
import type { ErrorCode } from './app-error.js';

export type Meta = Record<string, unknown>;

export type ApiSuccess<T> = { success: true; data: T; meta?: Meta };

export type ApiFailure = {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
};

// `meta` is only included when there is something to say (pagination, counts).
export function ok<T>(res: Response, data: T, meta?: Meta, status = 200): void {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  res.status(status).json(body);
}

export function fail(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): void {
  const body: ApiFailure = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  res.status(status).json(body);
}
