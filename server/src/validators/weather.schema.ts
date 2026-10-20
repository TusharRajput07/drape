import { z } from 'zod';

// "?lat=" (empty) counts as not sent, instead of being read as 0.
const coordinate = (limit: number) =>
  z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().min(-limit).max(limit).optional(),
  );

// Both or neither: the browser's location. Without them the saved city is used.
export const weatherQuery = z
  .object({ lat: coordinate(90), lon: coordinate(180) })
  .refine((q) => (q.lat === undefined) === (q.lon === undefined), {
    message: 'Send both lat and lon, or neither.',
    path: ['lat'],
  });

export type WeatherQuery = z.infer<typeof weatherQuery>;
