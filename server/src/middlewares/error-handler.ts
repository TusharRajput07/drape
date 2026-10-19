import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { fail } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';

// Last middleware: turns every error into the standard error envelope (02 §9).
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    fail(res, 400, 'VALIDATION_ERROR', 'Some fields need fixing.', details);
    return;
  }

  if (err instanceof AppError) {
    fail(res, err.status, err.code, err.message, err.details);
    return;
  }

  console.error(err);
  fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
};
