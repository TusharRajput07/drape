import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Subcategory, Success } from '@/lib/api-types';

// All of the user's subcategories with item counts (02 §8.5); screens pick their category's ones.
export function useSubcategories() {
  return useQuery({
    queryKey: ['subcategories'],
    queryFn: () =>
      api.get<unknown, Success<Subcategory[]>>('/subcategories').then((res) => res.data),
  });
}

export function useCreateSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { categoryId: string; name: string }) =>
      api.post<unknown, Success<Subcategory>>('/subcategories', body).then((res) => res.data),
    onSuccess: (created) => {
      queryClient.setQueryData<Subcategory[]>(['subcategories'], (list) =>
        list ? [...list, { ...created, itemCount: 0 }] : list,
      );
      void queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    },
  });
}

// A rename shows on every item, outfit and look that uses it; a delete only changes the lists.
function refreshAfterChange(queryClient: QueryClient) {
  for (const queryKey of [
    ['subcategories'],
    ['items'],
    ['item'],
    ['outfits'],
    ['outfit'],
    ['looks'],
    ['look'],
    ['stats'],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function useRenameSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api
        .patch<unknown, Success<Subcategory>>(`/subcategories/${id}`, { name })
        .then((res) => res.data),
    onSuccess: () => refreshAfterChange(queryClient),
  });
}

// Refused with SUBCATEGORY_IN_USE while items still use it (02 §8.5).
export function useDeleteSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/subcategories/${id}`),
    onSuccess: () => refreshAfterChange(queryClient),
    // Refused or already gone: the item counts shown were out of date.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['subcategories'] }),
  });
}
