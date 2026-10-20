import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as imageService from '../services/image.service.js';
import { ok } from '../utils/api-response.js';
import type { SignatureInput } from '../validators/uploads.schema.js';

export const signature: RequestHandler = (req, res) => {
  const { kind } = req.body as SignatureInput;
  ok(res, imageService.signUpload(currentUserId(req), kind));
};
