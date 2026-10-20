import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import type { UpdateMeInput, UpdateSettingsInput } from '../validators/me.schema.js';
import {
  deleteFiles,
  deleteUserFolder,
  imageData,
  saveWithFile,
  verifyUpload,
} from './image.service.js';
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

export type ProfileSlot = 'avatar' | 'cover';

const slotColumn = { avatar: 'avatarImageId', cover: 'coverImageId' } as const;

// New image row → point the user at it → delete the old row; the old file goes after commit (01 §7).
export async function setProfileImage(
  userId: string,
  slot: ProfileSlot,
  publicId: string,
): Promise<Me> {
  const file = await verifyUpload(userId, slot, publicId);
  const old = await saveWithFile(file, () =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { avatar: true, cover: true },
      });
      const image = await tx.image.create({ data: imageData(userId, slot, file) });
      await tx.user.update({ where: { id: userId }, data: { [slotColumn[slot]]: image.id } });
      const previous = user[slot];
      if (previous) await tx.image.delete({ where: { id: previous.id } });
      return previous;
    }),
  );
  if (old) await deleteFiles([old.publicId]);
  return getMe(userId);
}

// The profile falls back to initials (avatar) or the plain cover.
export async function removeProfileImage(userId: string, slot: ProfileSlot): Promise<Me> {
  const old = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { avatar: true, cover: true },
    });
    const previous = user[slot];
    if (previous) await tx.image.delete({ where: { id: previous.id } }); // SET NULL on users
    return previous;
  });
  if (old) await deleteFiles([old.publicId]);
  return getMe(userId);
}

// Typed confirmation, then the user's whole Cloudinary folder, then the user row: everything
// else cascades (01 §7). A Cloudinary failure doesn't stop the delete.
export async function deleteAccount(userId: string, confirm: unknown): Promise<void> {
  if (confirm !== 'DELETE') {
    throw new AppError('CONFIRMATION_REQUIRED', 'Type DELETE to confirm.', 422, [
      { field: 'confirm', message: 'Type DELETE to confirm.' },
    ]);
  }
  await deleteUserFolder(userId);
  await prisma.user.delete({ where: { id: userId } });
}
