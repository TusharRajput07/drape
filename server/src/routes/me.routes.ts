import { Router } from 'express';
import * as me from '../controllers/me.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  deleteAccountSchema,
  profileImageSchema,
  updateMeSchema,
  updateSettingsSchema,
} from '../validators/me.schema.js';

export const meRouter = Router();

meRouter.get('/', me.getMe);
meRouter.patch('/', validate({ body: updateMeSchema }), me.updateMe);
meRouter.delete('/', validate({ body: deleteAccountSchema }), me.deleteAccount);
meRouter.put('/avatar', validate({ body: profileImageSchema }), me.setAvatar);
meRouter.delete('/avatar', me.removeAvatar);
meRouter.put('/cover', validate({ body: profileImageSchema }), me.setCover);
meRouter.delete('/cover', me.removeCover);
meRouter.patch('/settings', validate({ body: updateSettingsSchema }), me.updateSettings);
