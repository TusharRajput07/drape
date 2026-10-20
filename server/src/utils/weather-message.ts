// What to wear, from the condition and the temperature: the prototype's rules (02 §8.11).

export type Condition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';

export function weatherMessage(condition: Condition, tempC: number): string {
  if (condition === 'rain' || condition === 'storm') {
    return 'Rain on the way. Skip suede and light bottoms today.';
  }
  if (tempC <= 10) return 'Cold out. Layer up with a hoodie or jacket.';
  if (tempC <= 18) return 'Cool and easy. Full sleeves or a light layer.';
  if (tempC <= 26) return 'Perfect weather. Tee and jeans territory.';
  if (tempC <= 33) return 'Warm one. Breathable cotton, lighter colours.';
  return 'Scorching. Linen, shorts, nothing dark.';
}

// WMO weather codes, as Open-Meteo reports them.
export function conditionFor(code: number): Condition {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51 && code <= 82) return 'rain'; // drizzle, rain, freezing rain, showers
  return 'cloudy';
}
