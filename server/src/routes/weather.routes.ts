import { Router } from 'express';
import * as weather from '../controllers/weather.controller.js';
import { validate } from '../middlewares/validate.js';
import { weatherQuery } from '../validators/weather.schema.js';

export const weatherRouter = Router();

weatherRouter.get('/', validate({ query: weatherQuery }), weather.get);
