import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CategorySlug, Item, ItemDetail, PageMeta, Success } from '@/lib/api-types';

// Items (02 §8.6). Lists live under ['items', filters]; one item under ['item', id].

export type ItemFilters = {
  category?: CategorySlug;
  subcategoryId?: string[];
  colorId?: string[];
  liked?: boolean;
  unused?: boolean;
  sort?: 'newest' | 'oldest';
};

type ItemPage = Success<Item[], PageMeta>;

const fetchItems = (params: ItemFilters & { cursor?: string; limit?: number }) =>
  api.get<unknown, ItemPage>('/items', { params });

export function useItems(filters: ItemFilters) {
  return useInfiniteQuery({
    queryKey: ['items', filters],
    queryFn: ({ pageParam }) => fetchItems({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

// How many items a tab has before filters ("5 of 23 items").
export function useItemTotal(category?: CategorySlug) {
  return useQuery({
    queryKey: ['items', 'total', category ?? 'all'],
    queryFn: () => fetchItems({ category, limit: 1 }).then((res) => res.meta?.total ?? 0),
  });
}

export function useItem(id: string | null) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => api.get<unknown, Success<ItemDetail>>(`/items/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

// After any change: lists, counts in the profile header, stats and subcategory item counts (03 §4.1).
function refreshWardrobe(queryClient: QueryClient) {
  for (const queryKey of [['items'], ['item'], ['me'], ['stats'], ['subcategories']]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

// Applies a change to an item wherever it's cached (every list page and its detail).
function patchCachedItem(queryClient: QueryClient, id: string, patch: Partial<Item>) {
  queryClient.setQueriesData<InfiniteData<ItemPage>>({ queryKey: ['items'] }, (data) =>
    data?.pages
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((it) => (it.id === id ? { ...it, ...patch } : it)),
          })),
        }
      : data,
  );
  queryClient.setQueryData<ItemDetail>(['item', id], (it) => (it ? { ...it, ...patch } : it));
}

type ItemPatch = { subcategoryId?: string; colorId?: string; isLiked?: boolean };

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ItemPatch & { id: string }) =>
      api.patch<unknown, Success<Item>>(`/items/${id}`, body).then((res) => res.data),
    // Hearts change at once and roll back on error (03 §4.1).
    onMutate: async ({ id, isLiked }) => {
      if (isLiked === undefined) return;
      await queryClient.cancelQueries({ queryKey: ['items'] });
      await queryClient.cancelQueries({ queryKey: ['item', id] });
      patchCachedItem(queryClient, id, { isLiked });
      return { id, wasLiked: !isLiked };
    },
    onSuccess: (item) => patchCachedItem(queryClient, item.id, item),
    onError: (_err, _vars, ctx) => {
      if (ctx) patchCachedItem(queryClient, ctx.id, { isLiked: ctx.wasLiked });
    },
    onSettled: () => refreshWardrobe(queryClient),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/items/${id}`),
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: ['item', id] });
      refreshWardrobe(queryClient);
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      publicId: string;
      categoryId: string;
      subcategoryId: string;
      colorId: string;
    }) => api.post<unknown, Success<Item>>('/items', body).then((res) => res.data),
    onSuccess: () => refreshWardrobe(queryClient),
  });
}

// For a NOT_FOUND answer: the item is gone, so the lists are out of date (03 §11).
export function useRefreshItems() {
  const queryClient = useQueryClient();
  return () => refreshWardrobe(queryClient);
}
