import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Not found.', 404));
};
