import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import type { RefreshToken } from '../services/token.service.js';
import { ok } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';
import type { LoginInput, SignupInput } from '../validators/auth.schema.js';

// The refresh token lives in an httpOnly cookie that's only sent to /api/v1/auth (02 §6).
const COOKIE = 'rt';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/v1/auth',
};

const setRefreshCookie = (res: Response, { token, expiresAt }: RefreshToken) =>
  res.cookie(COOKIE, token, { ...cookieOptions, expires: expiresAt });

const clearRefreshCookie = (res: Response) => res.clearCookie(COOKIE, cookieOptions);

const userAgent = (req: Request) => req.get('user-agent') ?? null;
const refreshCookie = (req: Request): string | undefined => req.cookies?.[COOKIE];

export const signup: RequestHandler = async (req, res) => {
  const session = await authService.signup(req.body as SignupInput, userAgent(req));
  setRefreshCookie(res, session.refresh);
  ok(res, { accessToken: session.accessToken, user: session.user }, undefined, 201);
};

export const login: RequestHandler = async (req, res) => {
  const session = await authService.login(req.body as LoginInput, userAgent(req));
  setRefreshCookie(res, session.refresh);
  ok(res, { accessToken: session.accessToken, user: session.user });
};

export const refresh: RequestHandler = async (req, res) => {
  const token = refreshCookie(req);
  try {
    if (!token) {
      throw new AppError('SESSION_EXPIRED', 'Your session has ended. Please log in again.', 401);
    }
    const result = await authService.refresh(token, userAgent(req));
    setRefreshCookie(res, result.refresh);
    ok(res, { accessToken: result.accessToken });
  } catch (err) {
    if (err instanceof AppError && err.code === 'SESSION_EXPIRED') clearRefreshCookie(res);
    throw err;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(refreshCookie(req));
  clearRefreshCookie(res);
  ok(res, { loggedOut: true });
};
