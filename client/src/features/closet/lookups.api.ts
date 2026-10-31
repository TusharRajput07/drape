import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Category, Color, Success } from '@/lib/api-types';

// Fixed lookups (02 §8.4), fetched once per session.

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<unknown, Success<Category[]>>('/categories').then((res) => res.data),
    staleTime: Infinity,
  });
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => api.get<unknown, Success<Color[]>>('/colors').then((res) => res.data),
    staleTime: Infinity,
  });
}
