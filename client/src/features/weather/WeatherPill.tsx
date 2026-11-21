import { CONDITION_LABEL } from './conditions';
import { formatTemp, useWeather } from './useWeather';
import { WeatherIcon } from './WeatherIcon';

// Icon + temperature only, top-left on the cover (03 §6.2). Hidden until there's weather to show.
export function WeatherPill() {
  const state = useWeather();
  if (state.status !== 'ready') return null;
  const { weather, unit } = state;
  const temp = formatTemp(weather.tempC, unit);
  return (
    <div
      className="absolute top-2.5 left-2.5 z-[1] flex max-w-[calc(100%-124px)] items-center gap-1.5 rounded-full bg-background/90 py-1 pr-2.5 pl-1 text-xs leading-tight shadow-[0_2px_10px_rgba(22,22,22,.1)] backdrop-blur-sm"
      role="img"
      aria-label={`${CONDITION_LABEL[weather.condition]}, ${temp}`}
    >
      <WeatherIcon condition={weather.condition} className="size-7" iconClassName="size-[17px]" />
      <span className="font-semibold tabular-nums">{temp}</span>
    </div>
  );
}
