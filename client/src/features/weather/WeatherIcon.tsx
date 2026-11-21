import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  type LucideIcon,
  Snowflake,
  Sun,
} from 'lucide-react';
import type { WeatherCondition } from '@/lib/api-types';
import { cn } from '@/lib/utils';

const ICONS: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: Snowflake,
  fog: CloudFog,
  storm: CloudLightning,
};

// The prototype's round icon: accent on the accent's soft tint.
export function WeatherIcon({
  condition,
  className,
  iconClassName,
}: {
  condition: WeatherCondition;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = ICONS[condition];
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-full bg-accent-soft text-accent',
        className,
      )}
    >
      <Icon className={iconClassName} strokeWidth={1.8} aria-hidden />
    </span>
  );
}
