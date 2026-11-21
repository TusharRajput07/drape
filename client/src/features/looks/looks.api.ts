import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Look, PageMeta, Success } from '@/lib/api-types';
import { fieldErrors } from '@/lib/errors';

// Looks (02 §8.8). The list lives under ['looks']; one look under ['look', id].

type LookPage = Success<Look[], PageMeta>;

// The server's limit on tags per look (02 §8.8).
export const MAX_TAGS = 20;

export function useLooks() {
  return useInfiniteQuery({
    queryKey: ['looks'],
    queryFn: ({ pageParam }) =>
      api.get<unknown, LookPage>('/looks', { params: { cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

export function useLook(id: string | null | undefined) {
  return useQuery({
    queryKey: ['look', id],
    queryFn: () => api.get<unknown, Success<Look>>(`/looks/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

// After any change: the looks, the profile counts, stats, and the items' usage ("in N looks") (03 §4.1).
function refreshLooks(queryClient: QueryClient) {
  for (const queryKey of [['looks'], ['look'], ['me'], ['stats'], ['items'], ['item']]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

// A tagged piece was deleted meanwhile (VALIDATION_ERROR on `itemIds`): reload the closet so the
// picker drops it and a retry can succeed.
function refreshClosetOnTagError(queryClient: QueryClient, err: unknown) {
  if (fieldErrors(err).itemIds) void queryClient.invalidateQueries({ queryKey: ['items'] });
}

export function useCreateLook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { publicId: string; itemIds: string[] }) =>
      api.post<unknown, Success<Look>>('/looks', body).then((res) => res.data),
    onSuccess: (look) => {
      queryClient.setQueryData(['look', look.id], look);
      refreshLooks(queryClient);
    },
    onError: (err) => refreshClosetOnTagError(queryClient, err),
  });
}

// Replaces the look's tags.
export function useSetLookItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemIds }: { id: string; itemIds: string[] }) =>
      api.put<unknown, Success<Look>>(`/looks/${id}/items`, { itemIds }).then((res) => res.data),
    onSuccess: (look) => {
      queryClient.setQueryData(['look', look.id], look);
      refreshLooks(queryClient);
    },
    onError: (err) => refreshClosetOnTagError(queryClient, err),
  });
}

export function useDeleteLook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/looks/${id}`),
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: ['look', id] });
      refreshLooks(queryClient);
    },
  });
}

// For a NOT_FOUND answer: the look is gone, so the list is out of date (03 §11).
export function useRefreshLooks() {
  const queryClient = useQueryClient();
  return () => refreshLooks(queryClient);
}
