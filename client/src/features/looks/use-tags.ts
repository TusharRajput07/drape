import { useState } from 'react';
import { useAllItems } from '@/features/closet/items.api';
import { MAX_TAGS } from './looks.api';

// The picks for one look, kept by item id. Picks of items deleted since are dropped, and `ready`
// says the closet has loaded, so what's saved is always what's shown.
export function useTags(initial: string[]) {
  const all = useAllItems({});
  const [picked, setPicked] = useState(initial);
  const list = all.data ?? [];
  const ids = picked.filter((id) => list.some((it) => it.id === id));
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return { all, ids, toggle, full: ids.length >= MAX_TAGS, ready: all.isSuccess };
}

export type Tags = ReturnType<typeof useTags>;

export const saveLabel = (n: number) => (n ? `Save with ${n} tagged` : 'Save look');
