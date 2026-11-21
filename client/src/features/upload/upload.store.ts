import { create } from 'zustand';
import type { CategorySlug } from '@/lib/api-types';
import { onSessionEnd } from '@/lib/session-reset';

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

// A session that ends with the flow open (it expired meanwhile) doesn't reopen it for the next login.
onSessionEnd(() => useUploadStore.setState({ open: false, category: null }));
