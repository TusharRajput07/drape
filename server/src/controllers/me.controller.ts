import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as userService from '../services/user.service.js';
import { ok } from '../utils/api-response.js';
import type {
  DeleteAccountInput,
  ProfileImageInput,
  UpdateMeInput,
  UpdateSettingsInput,
} from '../validators/me.schema.js';
import { clearRefreshCookie } from './auth.controller.js';

export const getMe: RequestHandler = async (req, res) => {
  ok(res, await userService.getMe(currentUserId(req)));
};

export const updateMe: RequestHandler = async (req, res) => {
  ok(res, await userService.updateProfile(currentUserId(req), req.body as UpdateMeInput));
};

export const updateSettings: RequestHandler = async (req, res) => {
  ok(res, await userService.updateSettings(currentUserId(req), req.body as UpdateSettingsInput));
};

const setImage =
  (slot: userService.ProfileSlot): RequestHandler =>
  async (req, res) => {
    const { publicId } = req.body as ProfileImageInput;
    ok(res, await userService.setProfileImage(currentUserId(req), slot, publicId));
  };

const removeImage =
  (slot: userService.ProfileSlot): RequestHandler =>
  async (req, res) => {
    ok(res, await userService.removeProfileImage(currentUserId(req), slot));
  };

export const setAvatar = setImage('avatar');
export const removeAvatar = removeImage('avatar');
export const setCover = setImage('cover');
export const removeCover = removeImage('cover');

export const deleteAccount: RequestHandler = async (req, res) => {
  const { confirm } = req.body as DeleteAccountInput;
  await userService.deleteAccount(currentUserId(req), confirm);
  clearRefreshCookie(res);
  ok(res, { deleted: true });
};
