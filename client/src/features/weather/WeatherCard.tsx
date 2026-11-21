import { Cloud } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CONDITION_LABEL } from './conditions';
import { formatTemp, useWeather } from './useWeather';
import { WeatherIcon } from './WeatherIcon';

const linkClass = 'font-medium text-accent underline underline-offset-2';

function Card({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft px-3.5 py-3 text-sm leading-snug">
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const PlainIcon = () => (
  <span className="grid size-10 flex-none place-items-center rounded-full bg-background text-accent">
    <Cloud className="size-[22px]" strokeWidth={1.8} aria-hidden />
  </span>
);

// Under the Outfits header: icon, temperature, condition, place and what to wear (03 §6.5).
export function WeatherCard() {
  const state = useWeather();

  if (state.status === 'loading') {
    return (
      <Card icon={<PlainIcon />}>
        <span className="text-muted">Getting today's weather…</span>
      </Card>
    );
  }

  if (state.status === 'no-city') {
    return (
      <Card icon={<PlainIcon />}>
        Add your city in{' '}
        <Link to="/settings" className={linkClass}>
          Settings
        </Link>{' '}
        to see today's weather here.
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card icon={<PlainIcon />}>
        Couldn't load the weather right now.{' '}
        <button type="button" className={linkClass} onClick={state.retry}>
          Try again
        </button>
      </Card>
    );
  }

  const { weather, unit } = state;
  return (
    <Card
      icon={
        <WeatherIcon
          condition={weather.condition}
          className="size-10 bg-background"
          iconClassName="size-[22px]"
        />
      }
    >
      <span className="font-semibold tabular-nums">{formatTemp(weather.tempC, unit)}</span>{' '}
      <span className="text-muted">
        {CONDITION_LABEL[weather.condition]}
        {weather.place && ` · ${weather.place}`}
      </span>
      <span className="block">{weather.message}</span>
    </Card>
  );
}
