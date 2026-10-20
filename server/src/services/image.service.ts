import { randomUUID } from 'node:crypto';
import { cloudinary } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import type { ImageKind, Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { fromPrismaError } from '../utils/prisma-errors.js';

// Cloudinary: signing browser uploads, verifying them, copying wishlist photos, deleting files
// (02 §8.12). Every file lives under wardrobe/<userId>/<kind>/<uuid>.

export type UploadKind = 'item' | 'look' | 'avatar' | 'cover';

export type UploadedFile = {
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string;
};

const ALLOWED_FORMATS = ['webp', 'png', 'jpg'];
const MAX_BYTES = 8 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const userFolder = (userId: string) => `wardrobe/${userId}`;
const kindFolder = (userId: string, kind: ImageKind) => `${userFolder(userId)}/${kind}`;

const uploadInvalid = (message = "That photo didn't upload properly. Try again.") =>
  new AppError('UPLOAD_INVALID', message, 400);

type Resource = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes: number;
  format: string;
  resource_type: string;
  type: string;
  asset_folder?: string;
};

// Step 2: the params the browser sends to Cloudinary unchanged. Cloudinary refuses a signature
// older than 1 hour; the folder and public_id it covers can't be changed by the browser.
export function signUpload(userId: string, kind: UploadKind) {
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    folder: kindFolder(userId, kind),
    public_id: randomUUID(),
    allowed_formats: ALLOWED_FORMATS.join(','),
  };
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp: params.timestamp,
    signature: cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET),
    folder: params.folder,
    publicId: params.public_id,
    allowedFormats: params.allowed_formats,
    maxBytes: MAX_BYTES,
  };
}

// Step 5: the file must exist in this user's folder for this kind, be an image within the
// limits, and not be used by another image row yet. Anything else → UPLOAD_INVALID.
export async function verifyUpload(
  userId: string,
  kind: UploadKind,
  publicId: string,
): Promise<UploadedFile> {
  const folder = kindFolder(userId, kind);
  if (!new RegExp(`^${folder}/${UUID}$`).test(publicId)) throw uploadInvalid();

  let resource: Resource;
  try {
    resource = (await cloudinary.api.resource(publicId)) as Resource;
  } catch (err) {
    if ((err as { error?: { http_code?: number } }).error?.http_code === 404) throw uploadInvalid();
    console.error(err);
    throw new AppError('INTERNAL_ERROR', "Couldn't check that photo right now. Try again.", 500);
  }

  const fits =
    resource.resource_type === 'image' &&
    resource.type === 'upload' &&
    (resource.asset_folder === undefined || resource.asset_folder === folder) &&
    resource.bytes <= MAX_BYTES &&
    ALLOWED_FORMATS.includes(resource.format);
  if (!fits) throw uploadInvalid();

  if (await prisma.image.findUnique({ where: { publicId }, select: { id: true } })) {
    throw uploadInvalid('That photo is already saved.');
  }
  return toFile(resource);
}

const toFile = (r: Resource): UploadedFile => ({
  publicId: r.public_id,
  url: r.secure_url,
  width: r.width ?? null,
  height: r.height ?? null,
  bytes: r.bytes,
  format: r.format,
});

// The images row for a verified (or server-uploaded) file.
export function imageData(
  userId: string,
  kind: ImageKind,
  file: UploadedFile,
): Prisma.ImageUncheckedCreateInput {
  return {
    userId,
    kind,
    publicId: file.publicId,
    url: file.url,
    width: file.width,
    height: file.height,
    bytes: file.bytes,
    format: file.format.slice(0, 10),
  };
}

// Step 6: if saving fails after the file was verified, the file is deleted, unless the failure
// is that another row already uses it (then the file belongs to that row).
export async function saveWithFile<T>(file: UploadedFile, save: () => Promise<T>): Promise<T> {
  try {
    return await save();
  } catch (err) {
    if (fromPrismaError(err)?.code !== 'UPLOAD_INVALID') await deleteFiles([file.publicId]);
    throw err;
  }
}

// Wishlist photos: Cloudinary fetches the shop's image itself. Any failure → no photo.
export async function uploadFromUrl(userId: string, url: string): Promise<UploadedFile | null> {
  try {
    const r = (await cloudinary.uploader.upload(url, {
      folder: kindFolder(userId, 'wishlist'),
      public_id: randomUUID(),
      resource_type: 'image',
    })) as unknown as Resource;
    return toFile(r);
  } catch (err) {
    console.error(err);
    return null;
  }
}

// After a commit that removed images rows. A failure leaves an orphan file, not an error.
export async function deleteFiles(publicIds: string[]): Promise<void> {
  for (let i = 0; i < publicIds.length; i += 100) {
    try {
      await cloudinary.api.delete_resources(publicIds.slice(i, i + 100));
    } catch (err) {
      console.error(err);
    }
  }
}

// Account delete: everything under wardrobe/<userId>/, including abandoned uploads, then the
// empty folders. A failure is logged and the account is deleted anyway.
export async function deleteUserFolder(userId: string): Promise<void> {
  const prefix = `${userFolder(userId)}/`;
  try {
    let partial = true;
    for (let round = 0; partial && round < 50; round++) {
      const result = (await cloudinary.api.delete_resources_by_prefix(prefix)) as {
        partial?: boolean;
      };
      partial = result.partial === true;
    }
  } catch (err) {
    console.error(err);
    return;
  }
  try {
    await cloudinary.api.delete_folder(userFolder(userId));
  } catch (err) {
    // 404: the user never uploaded anything, so there's no folder.
    if ((err as { error?: { http_code?: number } }).error?.http_code !== 404) console.error(err);
  }
}
