import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
