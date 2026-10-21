import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';

// A page plus the fixed bottom nav; the padding keeps the last row clear of the nav.
export function AppLayout() {
  return (
    <>
      <main className="pb-[calc(var(--nav-h)+24px+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
      <BottomNav />
    </>
  );
}
