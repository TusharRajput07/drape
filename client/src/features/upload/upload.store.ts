import { create } from 'zustand';
import type { CategorySlug } from '@/lib/api-types';

// Whether the upload flow is open and the category it starts on (from an empty tab's "Add clothes").
// `session` changes on every opening, so each one starts fresh.
type UploadState = { open: boolean; category: CategorySlug | null; session: number };

export const useUploadStore = create<UploadState>()(() => ({
  open: false,
  category: null,
  session: 0,
}));

export function startUpload(category?: CategorySlug) {
  useUploadStore.setState((s) => ({
    open: true,
    category: category ?? null,
    session: s.session + 1,
  }));
}

export function closeUpload() {
  useUploadStore.setState({ open: false });
}
