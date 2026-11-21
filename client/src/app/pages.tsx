import { type ComponentType, lazy, type ReactNode, Suspense } from 'react';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PageSkeleton } from '@/components/PageSkeleton';
import { loadChunk } from '@/lib/load-chunk';

// Every page is its own chunk, downloaded when first opened, so the app starts with only the shell
// (layouts, nav, API client). AppLayout fetches the main tabs in the background soon after.

const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  loadChunk(load).then((m) => ({ default: m[name] }));

const Login = lazy(() => named(() => import('@/features/auth/LoginPage'), 'LoginPage'));
const Signup = lazy(() => named(() => import('@/features/auth/SignupPage'), 'SignupPage'));
const Closet = lazy(() => named(() => import('@/features/closet/ClosetPage'), 'ClosetPage'));
const Outfits = lazy(() => named(() => import('@/features/outfits/OutfitsPage'), 'OutfitsPage'));
const Liked = lazy(() => named(() => import('@/features/liked/LikedPage'), 'LikedPage'));
const Wishlist = lazy(() =>
  named(() => import('@/features/wishlist/WishlistPage'), 'WishlistPage'),
);
const Lookbooks = lazy(() =>
  named(() => import('@/features/looks/LookbooksPage'), 'LookbooksPage'),
);
const Stats = lazy(() => named(() => import('@/features/stats/StatsPage'), 'StatsPage'));
const Settings = lazy(() =>
  named(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
);
const Builder = lazy(() => named(() => import('@/features/builder/BuilderPage'), 'BuilderPage'));

// A page inside the app layout waits on a skeleton (the bottom nav stays).
function InApp({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

// Login and signup load inside the auth card.
function InAuthCard({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid h-64 place-items-center" role="status" aria-label="Loading">
          <span className="size-[22px] animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const LoginPage = () => (
  <InAuthCard>
    <Login />
  </InAuthCard>
);
export const SignupPage = () => (
  <InAuthCard>
    <Signup />
  </InAuthCard>
);
export const ClosetPage = () => (
  <InApp>
    <Closet />
  </InApp>
);
export const OutfitsPage = () => (
  <InApp>
    <Outfits />
  </InApp>
);
export const LikedPage = () => (
  <InApp>
    <Liked />
  </InApp>
);
export const WishlistPage = () => (
  <InApp>
    <Wishlist />
  </InApp>
);
export const LookbooksPage = () => (
  <InApp>
    <Lookbooks />
  </InApp>
);
export const StatsPage = () => (
  <InApp>
    <Stats />
  </InApp>
);
export const SettingsPage = () => (
  <InApp>
    <Settings />
  </InApp>
);
// Full screen (no bottom nav), so it waits on the full-screen spinner.
export const BuilderPage = () => (
  <Suspense fallback={<FullScreenLoader />}>
    <Builder />
  </Suspense>
);
