import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PageMeta, Success, WishlistItem } from '@/lib/api-types';

// Wishlist (02 §8.9). The list lives under ['wishlist'].

type WishlistPage = Success<WishlistItem[], PageMeta>;

const ADD_KEY = ['wishlist', 'add'];

export function useWishlist() {
  return useInfiniteQuery({
    queryKey: ['wishlist'],
    queryFn: ({ pageParam }) =>
      api.get<unknown, WishlistPage>('/wishlist', { params: { cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

// After any change: the list, the profile count and the stats' wishlist summary (03 §4.1).
// Resolves once the list has reloaded, so a pending card or a removed one never leaves a gap.
function refreshWishlist(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['me'] });
  void queryClient.invalidateQueries({ queryKey: ['stats'] });
  return queryClient.invalidateQueries({ queryKey: ['wishlist'] });
}

// The server fetches the shop's page, so this can take a few seconds.
export function useAddToWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ADD_KEY,
    mutationFn: (url: string) =>
      api.post<unknown, Success<WishlistItem>>('/wishlist', { url }).then((res) => res.data),
    onSuccess: () => refreshWishlist(queryClient),
  });
}

// The links being added right now, for the "Getting details…" cards. Several can run at once.
export function usePendingLinks() {
  return useMutationState({
    filters: { mutationKey: ADD_KEY, status: 'pending' },
    select: (m) => ({ id: m.mutationId, url: m.state.variables as string }),
  });
}

export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/wishlist/${id}`),
    onSuccess: () => refreshWishlist(queryClient),
  });
}

// For a NOT_FOUND answer: the item is gone, so the list is out of date (03 §11).
export function useRefreshWishlist() {
  const queryClient = useQueryClient();
  return () => refreshWishlist(queryClient);
}
