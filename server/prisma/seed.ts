// Seed data from spec/01-database.md §6. Safe to re-run: every row is upserted
// (categories and colours by slug, subcategory templates by category + name).
// Run: npm run db:seed
import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const CATEGORIES = [
  { slug: 'top', name: 'Tops', sortOrder: 1, outfitMin: 1, outfitMax: 1 },
  { slug: 'bottom', name: 'Bottoms', sortOrder: 2, outfitMin: 1, outfitMax: 1 },
  { slug: 'shoes', name: 'Shoes', sortOrder: 3, outfitMin: 0, outfitMax: 1 },
  { slug: 'accessory', name: 'Accessories', sortOrder: 4, outfitMin: 0, outfitMax: null },
];

const COLORS = [
  { slug: 'black', name: 'Black', hex: '#1F1F1F', isNeutral: true },
  { slug: 'white', name: 'White', hex: '#F4F3EF', isNeutral: true },
  { slug: 'grey', name: 'Grey', hex: '#9A9C9F', isNeutral: true },
  { slug: 'beige', name: 'Beige', hex: '#D6C6A5', isNeutral: true },
  { slug: 'brown', name: 'Brown', hex: '#6B4A33', isNeutral: true },
  { slug: 'navy', name: 'Navy', hex: '#2B3A57', isNeutral: true },
  { slug: 'blue', name: 'Blue', hex: '#3F6FA8', isNeutral: false },
  { slug: 'lightblue', name: 'Light blue', hex: '#A9C3DB', isNeutral: false },
  { slug: 'green', name: 'Green', hex: '#5E7A4E', isNeutral: false },
  { slug: 'olive', name: 'Olive', hex: '#6B7350', isNeutral: false },
  { slug: 'red', name: 'Red', hex: '#B33A3A', isNeutral: false },
  { slug: 'maroon', name: 'Maroon', hex: '#6E2B33', isNeutral: false },
  { slug: 'pink', name: 'Pink', hex: '#E3A6B4', isNeutral: false },
  { slug: 'yellow', name: 'Yellow', hex: '#E2C044', isNeutral: false },
  { slug: 'orange', name: 'Orange', hex: '#D9783A', isNeutral: false },
  { slug: 'purple', name: 'Purple', hex: '#6E4C8C', isNeutral: false },
];

const TEMPLATES: Record<string, string[]> = {
  top: ['T-shirts', 'Shirts', 'Polos', 'Hoodies', 'Sweaters', 'Jackets'],
  bottom: ['Jeans', 'Trousers', 'Chinos', 'Shorts', 'Joggers'],
  shoes: ['Sneakers', 'Boots', 'Loafers', 'Formal shoes', 'Sandals'],
  accessory: ['Watches', 'Caps', 'Bags', 'Sunglasses', 'Belts'],
};

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error('DIRECT_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const { slug, ...data } of CATEGORIES) {
      await tx.category.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    }

    for (const [i, { slug, ...data }] of COLORS.entries()) {
      const row = { ...data, sortOrder: i + 1 };
      await tx.color.upsert({ where: { slug }, create: { slug, ...row }, update: row });
    }

    for (const [slug, names] of Object.entries(TEMPLATES)) {
      const category = await tx.category.findUniqueOrThrow({ where: { slug } });
      for (const [i, name] of names.entries()) {
        await tx.subcategoryTemplate.upsert({
          where: { categoryId_name: { categoryId: category.id, name } },
          create: { categoryId: category.id, name, sortOrder: i + 1 },
          update: { sortOrder: i + 1 },
        });
      }
    }
  });
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
