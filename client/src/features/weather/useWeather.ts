import { useQuery } from '@tanstack/react-query';
import { useMe } from '@/features/profile/me.api';
import { api } from '@/lib/api';
import type { Success, Weather } from '@/lib/api-types';

// Today's weather for the pill and the card (03 §8):
// 1. "Use my location" on → ask the browser once per session (5 s), then GET /weather?lat&lon.
// 2. Location off, refused or failed → GET /weather (the saved city).
// 3. No city either → nothing to show ('no-city').

type Coords = { lat: number; lon: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

// Resolves to null instead of failing, so a refusal simply falls back to the city. The extra timer
// covers a permission prompt that is never answered (the browser's own timeout starts after it).
function currentPosition(): Promise<Coords | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const guard = setTimeout(() => resolve(null), 15_000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(guard);
        resolve({ lat: round2(pos.coords.latitude), lon: round2(pos.coords.longitude) });
      },
      () => {
        clearTimeout(guard);
        resolve(null);
      },
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

export type WeatherState =
  | { status: 'loading' }
  | { status: 'no-city' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; weather: Weather; unit: 'C' | 'F' };

export function useWeather(): WeatherState {
  const settings = useMe().data?.settings;
  const useLocation = !!settings?.useLocation;

  // Asked once per session: the answer stays cached until logout clears the cache.
  const location = useQuery({
    queryKey: ['location'],
    queryFn: currentPosition,
    enabled: useLocation,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const coords = useLocation ? location.data : null;
  const locationSettled = !useLocation || location.isSuccess;
  const hasSource = !!coords || !!settings?.cityName;

  const weather = useQuery({
    // Keyed by where it's for: the coordinates, else the saved city (a new city fetches again).
    // °C/°F isn't in the key: the server always answers in Celsius.
    queryKey: ['weather', coords ?? { city: settings?.cityName ?? null }],
    queryFn: () =>
      api
        .get<unknown, Success<Weather>>('/weather', { params: coords ?? {} })
        .then((res) => res.data),
    enabled: !!settings && locationSettled && hasSource,
    staleTime: 15 * 60 * 1000,
  });

  if (!settings || !locationSettled) return { status: 'loading' };
  if (!hasSource) return { status: 'no-city' };
  if (weather.data) return { status: 'ready', weather: weather.data, unit: settings.tempUnit };
  if (weather.isError) return { status: 'error', retry: () => void weather.refetch() };
  return { status: 'loading' };
}

// The server always answers in Celsius; °F is worked out here (02 §8.11).
export function formatTemp(tempC: number, unit: 'C' | 'F') {
  return unit === 'F' ? `${Math.round((tempC * 9) / 5 + 32)}°F` : `${Math.round(tempC)}°C`;
}
