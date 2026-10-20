import { Router } from 'express';
import * as stats from '../controllers/stats.controller.js';
import { validate } from '../middlewares/validate.js';
import { statsQuery } from '../validators/stats.schema.js';

export const statsRouter = Router();

statsRouter.get('/', validate({ query: statsQuery }), stats.get);
