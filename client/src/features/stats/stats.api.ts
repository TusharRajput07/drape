import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CategorySlug, Stats, Success } from '@/lib/api-types';

// GET /stats, for the whole closet or one category (02 §8.10).
// `keepPrevious` shows the last answer while another category loads (the stats page's chips).
export function useStats(category?: CategorySlug, { keepPrevious = false } = {}) {
  return useQuery({
    queryKey: ['stats', category ?? 'all'],
    queryFn: () =>
      api.get<unknown, Success<Stats>>('/stats', { params: { category } }).then((res) => res.data),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}
