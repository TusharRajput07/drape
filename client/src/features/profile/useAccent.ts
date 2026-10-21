import { useEffect } from 'react';
import { applyAccent } from '@/lib/accent';
import { useMe } from './me.api';

// Keeps the app's accent colour in step with the user's setting (03 §7).
export function useAccent() {
  const accent = useMe().data?.settings.accent;
  useEffect(() => {
    if (accent) applyAccent(accent);
  }, [accent]);
}
