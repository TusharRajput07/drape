import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-types';

// TanStack Query defaults (03 §4.1): 30 s fresh, one retry, never for 4xx.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, err) => {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});
