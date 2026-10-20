import { Router } from 'express';
import * as me from '../controllers/me.controller.js';
import { validate } from '../middlewares/validate.js';
import { updateMeSchema, updateSettingsSchema } from '../validators/me.schema.js';

export const meRouter = Router();

meRouter.get('/', me.getMe);
meRouter.patch('/', validate({ body: updateMeSchema }), me.updateMe);
meRouter.patch('/settings', validate({ body: updateSettingsSchema }), me.updateSettings);
