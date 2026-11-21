import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Segmented } from '@/components/Segmented';
import { SwitchRow } from '@/components/SwitchRow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type SettingsBody, useMe, useUpdateSettings } from '@/features/profile/me.api';
import type { Me } from '@/lib/api-types';
import { fieldErrors, toastError } from '@/lib/errors';

// Settings → Weather: location switch, backup city, °C/°F (03 §6.11, §8).
export function WeatherSettings() {
  const me = useMe().data;
  if (!me) return <div className="my-3.5 h-28 animate-pulse rounded-xl bg-soft" />;
  return <WeatherForm settings={me.settings} />;
}

function WeatherForm({ settings }: { settings: Me['settings'] }) {
  const update = useUpdateSettings();
  // Its own mutation, so a switch tap while a city is being looked up doesn't block either.
  const saveCityMutation = useUpdateSettings();
  // A city that wasn't found isn't looked up again on every blur; its message comes back instead.
  const [notFound, setNotFound] = useState({ city: '', message: '' });
  const saved = settings.cityName ?? '';
  const [city, setCity] = useState(saved);
  const [error, setError] = useState('');
  // Follow the saved spelling ("pune" → "Pune") once the server has answered.
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setCity(saved);
  }

  const change = (body: SettingsBody) => update.mutate(body, { onError: toastError });

  // Saved with Enter or when the field loses focus; an empty field clears the city.
  const saveCity = (e?: FormEvent) => {
    e?.preventDefault();
    const clean = city.trim().replace(/\s+/g, ' ');
    if (clean === saved || saveCityMutation.isPending) return;
    if (clean && clean === notFound.city) return setError(notFound.message);
    setError('');
    saveCityMutation.mutate(
      { cityName: clean || null },
      {
        onSuccess: (me) => {
          setCity(me.settings.cityName ?? '');
          toast(me.settings.cityName ? `City set to ${me.settings.cityName}` : 'City cleared');
        },
        onError: (err) => {
          const message = fieldErrors(err).cityName;
          if (message) {
            const shown = message === 'City not found.' ? 'City not found' : message;
            setNotFound({ city: clean, message: shown });
            setError(shown);
          } else toastError(err);
        },
      },
    );
  };

  return (
    <>
      <div className="border-b border-border py-3.5">
        <SwitchRow
          className="border-0 py-0"
          checked={settings.useLocation}
          onChange={(useLocation) => change({ useLocation })}
          label="Use my location"
        />
        <small className="mt-1.5 block text-[12.5px] text-muted">
          The app asks your browser for your location once. If you say no, it uses the city below.
        </small>
      </div>

      <form className="border-b border-border py-3.5" onSubmit={saveCity} noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="settings-city">City</Label>
          <Input
            id="settings-city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setError('');
            }}
            onBlur={() => saveCity()}
            placeholder="e.g. Jaipur"
            maxLength={80}
            autoComplete="address-level2"
            enterKeyHint="done"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'settings-city-error' : undefined}
          />
          {error && (
            <p id="settings-city-error" className="text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
        <small className="mt-1.5 block text-[12.5px] text-muted">
          {saveCityMutation.isPending
            ? 'Looking up that city…'
            : 'Used when location is off or not allowed. Press Enter to save.'}
        </small>
      </form>

      <div className="py-3.5">
        <div className="mb-2 text-[13px] font-medium">Temperature</div>
        <Segmented
          label="Temperature unit"
          value={settings.tempUnit}
          onChange={(tempUnit) => tempUnit !== settings.tempUnit && change({ tempUnit })}
          options={[
            { value: 'C', label: '°C' },
            { value: 'F', label: '°F' },
          ]}
        />
      </div>
    </>
  );
}
