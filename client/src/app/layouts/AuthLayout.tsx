import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { useSessionStatus } from '@/features/auth/auth.api';
import { applyAccent } from '@/lib/accent';

// Centred card for login and signup. Someone already logged in goes straight to the closet.
export function AuthLayout() {
  const status = useSessionStatus();
  useEffect(() => applyAccent('plum'), []);
  if (status === 'unknown') return <FullScreenLoader />;
  if (status === 'authed') return <Navigate to="/" replace />;
  return (
    <main className="wrap grid min-h-dvh place-items-center py-10">
      <div className="w-full max-w-[400px]">
        <p className="mb-5 text-center text-[28px] font-semibold tracking-[-0.015em]">Drape</p>
        <div className="rounded-[20px] border border-border p-5 shadow-[0_1px_2px_rgba(22,22,22,.05),0_10px_28px_rgba(22,22,22,.08)]">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
