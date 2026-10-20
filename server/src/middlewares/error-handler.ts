import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { fail } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';
import { fromPrismaError } from '../utils/prisma-errors.js';

// Errors from express.json(): malformed JSON or a body over the 100 kb limit.
const BODY_ERRORS: Record<string, string> = {
  'entity.parse.failed': "That request body isn't valid JSON.",
  'entity.too.large': 'That request is too large.',
};

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

  const fromDb = fromPrismaError(err);
  if (fromDb) {
    fail(res, fromDb.status, fromDb.code, fromDb.message, fromDb.details);
    return;
  }

  const bodyError = BODY_ERRORS[(err as { type?: string }).type ?? ''];
  if (bodyError) {
    fail(res, 400, 'VALIDATION_ERROR', bodyError);
    return;
  }

  console.error(err);
  fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
};
