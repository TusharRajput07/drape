import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Outfit, PageMeta, Success } from '@/lib/api-types';

// Outfits (02 §8.7). Lists live under ['outfits', { favourite }]; one outfit under ['outfit', id].

type OutfitPage = Success<Outfit[], PageMeta>;

export type OutfitBody = {
  topId: string;
  bottomId: string;
  shoesId: string | null;
  accessoryIds: string[];
};

// `favourite` only goes into the key when set, so "all outfits" is always the same cache entry.
export function useOutfits(favourite?: boolean) {
  const params = favourite ? { favourite: true } : {};
  return useInfiniteQuery({
    queryKey: ['outfits', params],
    queryFn: ({ pageParam }) =>
      api.get<unknown, OutfitPage>('/outfits', { params: { ...params, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

export function useOutfit(id: string | null | undefined) {
  return useQuery({
    queryKey: ['outfit', id],
    queryFn: () => api.get<unknown, Success<Outfit>>(`/outfits/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

// After a save or delete: outfit lists, the profile counts, stats, and the items' usage
// ("in N outfits", the "not in any outfit" filter) (03 §4.1).
function refreshOutfits(queryClient: QueryClient) {
  for (const queryKey of [['outfits'], ['outfit'], ['me'], ['stats'], ['items'], ['item']]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

// Applies a change to an outfit wherever it's cached (every list page and its detail).
function patchCachedOutfit(queryClient: QueryClient, id: string, patch: Partial<Outfit>) {
  queryClient.setQueriesData<InfiniteData<OutfitPage>>({ queryKey: ['outfits'] }, (data) =>
    data?.pages
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((o) => (o.id === id ? { ...o, ...patch } : o)),
          })),
        }
      : data,
  );
  queryClient.setQueryData<Outfit>(['outfit', id], (o) => (o ? { ...o, ...patch } : o));
}

// POST for a new outfit, PUT (same id, new pieces) when editing.
export function useSaveOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: OutfitBody }) =>
      (id
        ? api.put<unknown, Success<Outfit>>(`/outfits/${id}`, body)
        : api.post<unknown, Success<Outfit>>('/outfits', body)
      ).then((res) => res.data),
    onSuccess: (outfit) => {
      queryClient.setQueryData(['outfit', outfit.id], outfit);
      refreshOutfits(queryClient);
    },
  });
}

export function useFavouriteOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavourite }: { id: string; isFavourite: boolean }) =>
      api
        .patch<unknown, Success<Outfit>>(`/outfits/${id}`, { isFavourite })
        .then((res) => res.data),
    // Hearts change at once and roll back on error (03 §4.1).
    onMutate: async ({ id, isFavourite }) => {
      await queryClient.cancelQueries({ queryKey: ['outfits'] });
      await queryClient.cancelQueries({ queryKey: ['outfit', id] });
      patchCachedOutfit(queryClient, id, { isFavourite });
      return { id, was: !isFavourite };
    },
    onSuccess: (outfit) => patchCachedOutfit(queryClient, outfit.id, outfit),
    onError: (_err, _vars, ctx) => {
      if (ctx) patchCachedOutfit(queryClient, ctx.id, { isFavourite: ctx.was });
    },
    // The favourites list and the "liked" count follow from the server. The detail too: a load the
    // optimistic update cancelled must run again.
    onSettled: (_outfit, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['outfits'] });
      void queryClient.invalidateQueries({ queryKey: ['outfit', id] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useDeleteOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/outfits/${id}`),
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: ['outfit', id] });
      refreshOutfits(queryClient);
    },
  });
}

// For a NOT_FOUND answer: the outfit is gone, so the lists are out of date (03 §11).
export function useRefreshOutfits() {
  const queryClient = useQueryClient();
  return () => refreshOutfits(queryClient);
}
