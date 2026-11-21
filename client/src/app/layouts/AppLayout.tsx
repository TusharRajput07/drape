import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { showTab } from '@/features/closet/filters.store';
import { startUpload, useUploadStore } from '@/features/upload/upload.store';
import { loadChunk } from '@/lib/load-chunk';

// The upload flow's code (and, from there, background removal's) loads the first time it opens.
const UploadFlow = lazy(() =>
  loadChunk(() => import('@/features/upload/UploadFlow')).then((m) => ({ default: m.UploadFlow })),
);

// The bottom-nav tabs and the upload flow, fetched in the background once the app is up, so switching tabs never waits.
const preloadTabs = () => {
  void import('@/features/closet/ClosetPage');
  void import('@/features/outfits/OutfitsPage');
  void import('@/features/liked/LikedPage');
  void import('@/features/wishlist/WishlistPage');
  void import('@/features/upload/UploadFlow');
};

// A page plus the fixed bottom nav; the padding keeps the last row clear of the nav.
// The upload flow lives here so it can open from any page and land on Home afterwards.
export function AppLayout() {
  const navigate = useNavigate();
  const uploadOpen = useUploadStore((s) => s.open);
  // Once opened it stays mounted, so the sheet can play its closing animation.
  const [uploadUsed, setUploadUsed] = useState(false);
  if (uploadOpen && !uploadUsed) setUploadUsed(true);

  useEffect(() => {
    const timer = setTimeout(preloadTabs, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <main className="pb-[calc(var(--nav-h)+24px+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
      <BottomNav onUpload={() => startUpload()} />
      {uploadUsed && (
        <Suspense fallback={null}>
          <UploadFlow
            onSaved={(category) => {
              showTab(category);
              navigate('/');
            }}
          />
        </Suspense>
      )}
    </>
  );
}
