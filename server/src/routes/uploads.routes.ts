import { Router } from 'express';
import * as uploads from '../controllers/uploads.controller.js';
import { validate } from '../middlewares/validate.js';
import { signatureSchema } from '../validators/uploads.schema.js';

export const uploadsRouter = Router();

uploadsRouter.post('/signature', validate({ body: signatureSchema }), uploads.signature);
