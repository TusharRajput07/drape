import type { Request, RequestHandler } from 'express';
import { verifyAccessToken } from '../services/token.service.js';
import { AppError } from '../utils/app-error.js';

const unauthenticated = () => new AppError('UNAUTHENTICATED', 'Please log in.', 401);

// Requires "Authorization: Bearer <accessToken>" and sets req.user. No database call (02 §6).
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw unauthenticated();
  req.user = { id: verifyAccessToken(token) };
  next();
};

// The logged-in user's id, for controllers behind `authenticate`.
export function currentUserId(req: Request): string {
  if (!req.user) throw unauthenticated();
  return req.user.id;
}
