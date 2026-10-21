import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/auth.api';
import { toastError } from '@/lib/errors';

// Phase 5 has only Account → Log out; the other groups come in phase 9.
export function SettingsPage() {
  const logout = useLogout();
  return (
    <section className="wrap">
      <PageHeader title="Settings" back="/" />
      <div className="mt-2 rounded-[18px] border border-border px-4">
        <h2 className="pt-3.5 text-xs font-semibold tracking-[.08em] text-muted uppercase">
          Account
        </h2>
        <div className="py-3.5">
          <Button
            variant="ghost"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onError: toastError })}
          >
            Log out
          </Button>
        </div>
      </div>
    </section>
  );
}
