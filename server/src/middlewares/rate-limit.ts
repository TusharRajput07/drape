import { rateLimit } from 'express-rate-limit';
import { fail } from '../utils/api-response.js';

// 10 failed attempts per 15 minutes per IP, counted separately for signup and login.
// Successful requests don't count (owner's decision, phase 3).
const authLimit = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      fail(res, 429, 'RATE_LIMITED', 'Too many attempts. Try again in a few minutes.');
    },
  });

export const signupLimit = authLimit();
export const loginLimit = authLimit();
