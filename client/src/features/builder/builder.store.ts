import { create } from 'zustand';
import type { Outfit } from '@/lib/api-types';

// The outfit builder's picks (03 §4.2). Not persisted; cleared when the builder closes.

export type Row = 'top' | 'bottom' | 'shoes';

export const ROWS: Row[] = ['top', 'bottom', 'shoes'];

// The centred item of each row, by id (so it survives a row's list reloading or being filtered).
// `undefined` = not chosen yet (the row picks its first item); `null` = "No shoes".
type Picks = Record<Row, string | null | undefined>;

type BuilderState = {
  picked: Picks;
  locked: Record<Row, boolean>;
  // The subcategory each row is narrowed to; null = all.
  subcategory: Record<Row, string | null>;
  accessoryIds: string[];
  // The outfit being edited, once its pieces are pre-selected.
  editId: string | null;
  pick: (row: Row, id: string | null | undefined) => void;
  toggleLock: (row: Row) => void;
  setSubcategory: (row: Row, id: string | null) => void;
  toggleAccessory: (id: string) => void;
};

const EMPTY = {
  picked: { top: undefined, bottom: undefined, shoes: undefined } as Picks,
  locked: { top: false, bottom: false, shoes: false },
  subcategory: { top: null, bottom: null, shoes: null },
  accessoryIds: [] as string[],
  editId: null,
};

export const useBuilderStore = create<BuilderState>()((set) => ({
  ...EMPTY,
  pick: (row, id) => set((s) => ({ picked: { ...s.picked, [row]: id } })),
  toggleLock: (row) => set((s) => ({ locked: { ...s.locked, [row]: !s.locked[row] } })),
  setSubcategory: (row, id) => set((s) => ({ subcategory: { ...s.subcategory, [row]: id } })),
  toggleAccessory: (id) =>
    set((s) => ({
      accessoryIds: s.accessoryIds.includes(id)
        ? s.accessoryIds.filter((x) => x !== id)
        : [...s.accessoryIds, id],
    })),
}));

// Edit mode starts with the outfit's pieces and accessories selected (03 §6.6).
export function preselect(outfit: Outfit) {
  useBuilderStore.setState({
    ...EMPTY,
    picked: { top: outfit.top.id, bottom: outfit.bottom.id, shoes: outfit.shoes?.id ?? null },
    accessoryIds: outfit.accessories.map((a) => a.id),
    editId: outfit.id,
  });
}

export function resetBuilder() {
  useBuilderStore.setState(EMPTY);
}
