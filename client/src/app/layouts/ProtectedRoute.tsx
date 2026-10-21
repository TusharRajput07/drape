import { Navigate, Outlet } from 'react-router';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { useSessionStatus } from '@/features/auth/auth.api';
import { useAccent } from '@/features/profile/useAccent';

// Every page except login/signup (03 §5): wait for the session check, then show the page or go to /login.
export function ProtectedRoute() {
  const status = useSessionStatus();
  useAccent();
  if (status === 'unknown') return <FullScreenLoader />;
  if (status === 'guest') return <Navigate to="/login" replace />;
  return <Outlet />;
}
