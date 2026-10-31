import { create } from 'zustand';
import type { CategorySlug } from '@/lib/api-types';

// Home's tab and filters (03 §4.2). Not persisted.

export type ClosetTab = 'all' | CategorySlug;
export type Sort = 'newest' | 'oldest';

type Filters = {
  subcategoryIds: string[];
  colorIds: string[];
  liked: boolean;
  unused: boolean;
  sort: Sort;
};

type FiltersState = Filters & {
  tab: ClosetTab;
  // Subcategories belong to one category, so changing tab drops that filter (as in the prototype).
  setTab: (tab: ClosetTab) => void;
  toggleSubcategory: (id: string) => void;
  toggleColor: (id: string) => void;
  setLiked: (on: boolean) => void;
  setUnused: (on: boolean) => void;
  setSort: (sort: Sort) => void;
  clear: () => void;
};

const NONE: Filters = {
  subcategoryIds: [],
  colorIds: [],
  liked: false,
  unused: false,
  sort: 'newest',
};

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export const useFiltersStore = create<FiltersState>()((set) => ({
  tab: 'all',
  ...NONE,
  setTab: (tab) => set({ tab, subcategoryIds: [] }),
  toggleSubcategory: (id) => set((s) => ({ subcategoryIds: toggle(s.subcategoryIds, id) })),
  toggleColor: (id) => set((s) => ({ colorIds: toggle(s.colorIds, id) })),
  setLiked: (liked) => set({ liked }),
  setUnused: (unused) => set({ unused }),
  setSort: (sort) => set({ sort }),
  clear: () => set(NONE),
}));

// Shows Home on a tab with no filters, so a just-added item is in view.
export function showTab(tab: ClosetTab) {
  useFiltersStore.setState({ tab, ...NONE });
}

export function activeFilterCount(f: Filters) {
  return (
    f.subcategoryIds.length +
    f.colorIds.length +
    (f.liked ? 1 : 0) +
    (f.unused ? 1 : 0) +
    (f.sort === 'oldest' ? 1 : 0)
  );
}
