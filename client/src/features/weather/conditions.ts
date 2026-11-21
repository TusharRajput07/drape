import type { WeatherCondition } from '@/lib/api-types';

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  snow: 'Snow',
  fog: 'Fog',
  storm: 'Storm',
};
