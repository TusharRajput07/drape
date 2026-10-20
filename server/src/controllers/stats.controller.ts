import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as statsService from '../services/stats.service.js';
import { ok } from '../utils/api-response.js';
import type { StatsQuery } from '../validators/stats.schema.js';

export const get: RequestHandler = async (req, res) => {
  ok(res, await statsService.get(currentUserId(req), req.query as unknown as StatsQuery));
};
