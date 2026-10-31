import type { CategorySlug } from './api-types';

// The four fixed categories (01 §6) in tab order, with their labels.
export const CATEGORY_SLUGS: CategorySlug[] = ['top', 'bottom', 'shoes', 'accessory'];

export const LABEL: Record<CategorySlug, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  shoes: 'Shoes',
  accessory: 'Accessories',
};

export const ONE: Record<CategorySlug, string> = {
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  accessory: 'Accessory',
};
