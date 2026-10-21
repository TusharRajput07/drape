import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/use-online';

// Drape needs the internet for everything (03 §10), so offline it only says so.
export function OfflineScreen() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background px-6 text-center">
      <div className="grid justify-items-center gap-2">
        <span className="mb-2 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <WifiOff className="size-6" strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="text-xl">You're offline</h1>
        <p className="text-muted">
          Drape needs the internet. It will carry on when you're back online.
        </p>
      </div>
    </div>
  );
}
