import type { RequestHandler } from 'express';
import * as lookupService from '../services/lookup.service.js';
import { ok } from '../utils/api-response.js';

export const categories: RequestHandler = async (_req, res) => {
  ok(res, await lookupService.listCategories());
};

export const colors: RequestHandler = async (_req, res) => {
  ok(res, await lookupService.listColors());
};
