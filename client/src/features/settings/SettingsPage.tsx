import type { ReactNode } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/auth.api';
import { ManageSubcategories } from '@/features/subcategories/ManageSubcategories';
import { toastError } from '@/lib/errors';
import { AccentPicker } from './AccentPicker';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ProfileSettings } from './ProfileSettings';
import { WeatherSettings } from './WeatherSettings';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3.5 rounded-[18px] border border-border px-4">
      <h2 className="pt-3.5 text-xs font-semibold tracking-[.08em] text-muted uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

// Profile, appearance, weather, subcategories and account, in the spec's order (03 §6.11).
export function SettingsPage() {
  const logout = useLogout();
  return (
    <section className="wrap">
      <PageHeader title="Settings" back="/" />
      <div className="mt-2">
        <Group title="Profile">
          <ProfileSettings />
        </Group>
        <Group title="Appearance">
          <AccentPicker />
        </Group>
        <Group title="Weather">
          <WeatherSettings />
        </Group>
        <Group title="Subcategories">
          <ManageSubcategories />
        </Group>
        <Group title="Account">
          <div className="border-b border-border py-3.5">
            <Button
              variant="ghost"
              disabled={logout.isPending}
              onClick={() => logout.mutate(undefined, { onError: toastError })}
            >
              Log out
            </Button>
          </div>
          <div className="py-3.5">
            <DeleteAccountDialog />
          </div>
        </Group>
      </div>
    </section>
  );
}
