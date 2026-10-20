import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as userService from '../services/user.service.js';
import { ok } from '../utils/api-response.js';
import type { UpdateMeInput, UpdateSettingsInput } from '../validators/me.schema.js';

export const getMe: RequestHandler = async (req, res) => {
  ok(res, await userService.getMe(currentUserId(req)));
};

export const updateMe: RequestHandler = async (req, res) => {
  ok(res, await userService.updateProfile(currentUserId(req), req.body as UpdateMeInput));
};

export const updateSettings: RequestHandler = async (req, res) => {
  ok(res, await userService.updateSettings(currentUserId(req), req.body as UpdateSettingsInput));
};
