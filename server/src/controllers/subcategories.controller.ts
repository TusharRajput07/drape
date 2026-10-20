import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as subcategoryService from '../services/subcategory.service.js';
import { ok } from '../utils/api-response.js';
import type { IdParams } from '../validators/common.schema.js';
import type {
  CreateSubcategoryInput,
  ListSubcategoriesQuery,
  RenameSubcategoryInput,
} from '../validators/subcategories.schema.js';

export const list: RequestHandler = async (req, res) => {
  const query = req.query as unknown as ListSubcategoriesQuery;
  ok(res, await subcategoryService.list(currentUserId(req), query));
};

export const create: RequestHandler = async (req, res) => {
  const input = req.body as CreateSubcategoryInput;
  ok(res, await subcategoryService.create(currentUserId(req), input), undefined, 201);
};

export const rename: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(
    res,
    await subcategoryService.rename(currentUserId(req), id, req.body as RenameSubcategoryInput),
  );
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  await subcategoryService.remove(currentUserId(req), id);
  ok(res, { deleted: true });
};
