import { useQuery } from '@tanstack/react-query';
import { useIsAuthed } from '@/features/auth/auth.api';
import { api } from '@/lib/api';
import type { Me, Success } from '@/lib/api-types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<unknown, Success<Me>>('/me').then((res) => res.data),
    enabled: useIsAuthed(),
  });
}
