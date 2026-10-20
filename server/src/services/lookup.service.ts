import { prisma } from '../db/prisma.js';

// The shared, seeded lookups (02 §8.4).

export type Category = { id: string; slug: string; name: string };
export type Color = { id: string; slug: string; name: string; hex: string };

export const categorySelect = { id: true, slug: true, name: true } as const;
export const colorSelect = { id: true, slug: true, name: true, hex: true } as const;

export function listCategories(): Promise<Category[]> {
  return prisma.category.findMany({ select: categorySelect, orderBy: { sortOrder: 'asc' } });
}

export function listColors(): Promise<(Color & { isNeutral: boolean })[]> {
  return prisma.color.findMany({
    select: { ...colorSelect, isNeutral: true },
    orderBy: { sortOrder: 'asc' },
  });
}
