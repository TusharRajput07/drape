import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as weatherService from '../services/weather.service.js';
import { ok } from '../utils/api-response.js';
import type { WeatherQuery } from '../validators/weather.schema.js';

export const get: RequestHandler = async (req, res) => {
  ok(
    res,
    await weatherService.getWeather(currentUserId(req), req.query as unknown as WeatherQuery),
  );
};
