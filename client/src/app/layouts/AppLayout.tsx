import { Outlet, useNavigate } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { showTab } from '@/features/closet/filters.store';
import { UploadFlow } from '@/features/upload/UploadFlow';
import { startUpload } from '@/features/upload/upload.store';

// A page plus the fixed bottom nav; the padding keeps the last row clear of the nav.
// The upload flow lives here so it can open from any page and land on Home afterwards.
export function AppLayout() {
  const navigate = useNavigate();
  return (
    <>
      <main className="pb-[calc(var(--nav-h)+24px+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
      <BottomNav onUpload={() => startUpload()} />
      <UploadFlow
        onSaved={(category) => {
          showTab(category);
          navigate('/');
        }}
      />
    </>
  );
}
