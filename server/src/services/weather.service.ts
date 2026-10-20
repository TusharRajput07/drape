import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/app-error.js';
import { conditionFor, weatherMessage, type Condition } from '../utils/weather-message.js';
import type { WeatherQuery } from '../validators/weather.schema.js';

// Open-Meteo (free, no key): geocoding for the saved city, and the current weather.

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;
const CACHE_MS = 15 * 60 * 1000;

export type Place = { name: string; lat: number; lon: number };

export type Weather = {
  tempC: number;
  condition: Condition;
  message: string;
  place: string | null;
};

type GeocodingResponse = {
  results?: { name: string; latitude: number; longitude: number }[];
};

type ForecastResponse = { current?: { temperature_2m?: number; weather_code?: number } };

const round5 = (n: number) => Math.round(n * 1e5) / 1e5; // numeric(8,5)
const round2 = (n: number) => Math.round(n * 100) / 100;

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

// In memory, per location rounded to 2 decimals (about 1 km), for 15 minutes.
const cache = new Map<string, { expires: number; tempC: number; condition: Condition }>();

async function current(lat: number, lon: number) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    temperature_unit: 'celsius',
  });
  let body: ForecastResponse;
  try {
    const res = await fetch(`${FORECAST_URL}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Open-Meteo forecast answered ${res.status}`);
    body = (await res.json()) as ForecastResponse;
    if (typeof body.current?.temperature_2m !== 'number') {
      throw new Error('Open-Meteo forecast had no current temperature');
    }
  } catch (err) {
    console.error(err);
    throw new AppError('INTERNAL_ERROR', "Couldn't load the weather right now. Try again.", 500);
  }

  for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  const entry = {
    expires: now + CACHE_MS,
    tempC: body.current.temperature_2m,
    condition: conditionFor(body.current.weather_code ?? 0),
  };
  cache.set(key, entry);
  return entry;
}

// The browser's location when given, otherwise the saved city. Always Celsius (02 §8.11).
export async function getWeather(userId: string, query: WeatherQuery): Promise<Weather> {
  let lat: number;
  let lon: number;
  let place: string | null = null;

  if (query.lat !== undefined && query.lon !== undefined) {
    lat = round2(query.lat);
    lon = round2(query.lon);
  } else {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.cityName || settings.cityLat === null || settings.cityLon === null) {
      throw new AppError('VALIDATION_ERROR', 'Add your city in Settings.', 400);
    }
    lat = round2(settings.cityLat.toNumber());
    lon = round2(settings.cityLon.toNumber());
    place = settings.cityName;
  }

  const { tempC, condition } = await current(lat, lon);
  return { tempC, condition, message: weatherMessage(condition, tempC), place };
}
