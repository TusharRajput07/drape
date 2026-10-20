import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import type { UpdateMeInput, UpdateSettingsInput } from '../validators/me.schema.js';
import { geocodeCity } from './weather.service.js';

export type Image = { url: string; width: number | null; height: number | null };

export type Me = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar: Image | null;
  cover: Image | null;
  settings: {
    accent: string;
    tempUnit: 'C' | 'F';
    useLocation: boolean;
    cityName: string | null;
  };
  counts: { items: number; outfits: number; looks: number; liked: number; wishlist: number };
};

const toImage = (image: { url: string; width: number | null; height: number | null } | null) =>
  image ? { url: image.url, width: image.width, height: image.height } : null;

export async function getMe(userId: string): Promise<Me> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { avatar: true, cover: true, settings: true },
  });
  if (!user?.settings) throw new AppError('NOT_FOUND', 'Not found.', 404);

  // "liked" = liked clothes + favourite outfits: the two tabs of the Liked page.
  const [items, outfits, looks, likedItems, favouriteOutfits, wishlist] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.outfit.count({ where: { userId } }),
    prisma.look.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isLiked: true } }),
    prisma.outfit.count({ where: { userId, isFavourite: true } }),
    prisma.wishlistItem.count({ where: { userId } }),
  ]);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    avatar: toImage(user.avatar),
    cover: toImage(user.cover),
    settings: {
      accent: user.settings.accent,
      tempUnit: user.settings.tempUnit === 'F' ? 'F' : 'C',
      useLocation: user.settings.useLocation,
      cityName: user.settings.cityName,
    },
    counts: { items, outfits, looks, liked: likedItems + favouriteOutfits, wishlist },
  };
}

export async function updateProfile(userId: string, input: UpdateMeInput): Promise<Me> {
  await prisma.user.update({ where: { id: userId }, data: input });
  return getMe(userId);
}

// Saving a city geocodes it once and stores the coordinates; null clears all three (01 §3.2).
export async function updateSettings(userId: string, input: UpdateSettingsInput): Promise<Me> {
  const { cityName, ...rest } = input;
  const data: Prisma.UserSettingsUpdateInput = rest;

  if (cityName === null) {
    Object.assign(data, { cityName: null, cityLat: null, cityLon: null });
  } else if (cityName !== undefined) {
    const place = await geocodeCity(cityName);
    Object.assign(data, { cityName: place.name, cityLat: place.lat, cityLon: place.lon });
  }

  await prisma.userSettings.update({ where: { userId }, data });
  return getMe(userId);
}
