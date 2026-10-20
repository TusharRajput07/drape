import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as lookService from '../services/look.service.js';
import { ok } from '../utils/api-response.js';
import type { IdParams, PageQuery } from '../validators/common.schema.js';
import type { CreateLookInput, LookItemsInput } from '../validators/looks.schema.js';

export const list: RequestHandler = async (req, res) => {
  const query = req.query as unknown as PageQuery;
  const { looks, meta } = await lookService.list(currentUserId(req), query);
  ok(res, looks, meta);
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await lookService.get(currentUserId(req), id));
};

export const create: RequestHandler = async (req, res) => {
  const input = req.body as CreateLookInput;
  ok(res, await lookService.create(currentUserId(req), input), undefined, 201);
};

export const setItems: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await lookService.setItems(currentUserId(req), id, req.body as LookItemsInput));
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  await lookService.remove(currentUserId(req), id);
  ok(res, { deleted: true });
};
