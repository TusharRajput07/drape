import { AppError } from '../utils/app-error.js';

// Open-Meteo (free, no key). Phase 3 needs only geocoding; the forecast comes in a later phase.

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 8000;

export type Place = { name: string; lat: number; lon: number };

type GeocodingResponse = {
  results?: { name: string; latitude: number; longitude: number }[];
};

const round5 = (n: number) => Math.round(n * 1e5) / 1e5; // numeric(8,5)

// First match wins (02 §8.3). Stores the geocoder's spelling, e.g. "pune" → "Pune".
export async function geocodeCity(name: string): Promise<Place> {
  const url = `${GEOCODING_URL}?${new URLSearchParams({ name, count: '1', language: 'en', format: 'json' })}`;

  let body: GeocodingResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Open-Meteo geocoding answered ${res.status}`);
    body = (await res.json()) as GeocodingResponse;
  } catch (err) {
    console.error(err);
    throw new AppError('INTERNAL_ERROR', "Couldn't look up that city right now. Try again.", 500);
  }

  const place = body.results?.[0];
  if (!place) {
    throw new AppError('VALIDATION_ERROR', 'City not found.', 400, [
      { field: 'cityName', message: 'City not found.' },
    ]);
  }
  return {
    name: place.name.slice(0, 80),
    lat: round5(place.latitude),
    lon: round5(place.longitude),
  };
}
