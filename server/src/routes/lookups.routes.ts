import { Router } from 'express';
import * as lookups from '../controllers/lookups.controller.js';

export const lookupsRouter = Router();

lookupsRouter.get('/categories', lookups.categories);
lookupsRouter.get('/colors', lookups.colors);
