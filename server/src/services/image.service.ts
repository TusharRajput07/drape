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
// A file uploaded longer ago than this can't be saved any more: the clean-up job deletes files with
// no images row after 24 hours (02 §11), so it must never meet one that is about to get a row.
const MAX_UPLOAD_AGE_MS = 12 * 60 * 60 * 1000;
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
  created_at: string;
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
// limits, uploaded in the last 12 hours, and not be used by another image row yet. Anything else → UPLOAD_INVALID.
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
    !(Date.now() - Date.parse(resource.created_at) > MAX_UPLOAD_AGE_MS) &&
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

// Weekly clean-up job (02 §11): files under wardrobe/ with no images row, older than 24 hours.
// That's an upload that was signed and sent to Cloudinary but never saved (verifyUpload refuses files
// older than 12 hours, so none of these can still be saved), or a file whose delete failed earlier.
// Listing costs one Admin API call per 500 files (shared 500 calls/hour limit, 02 §12), so a run looks at
// MAX_PAGES pages at most.
//
// It deletes real photos if it's wrong, so it only ever deletes what it is sure about:
// - only names this app makes (wardrobe/<userId>/<kind>/<uuid>), of users that exist in this database
//   (a database that doesn't own these files matches no one; a deleted account's files are left alone);
// - nothing at all if a listing or a database query fails, or if the leftovers look like too many
//   (more than MAX_ORPHAN_SHARE of the old files and more than ORPHAN_ALARM files): that smells like a
//   wrong or emptied database, so it stops and says so.
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_PAGES = 20;
const MAX_ORPHAN_SHARE = 0.5;
const ORPHAN_ALARM = 20;
const APP_FILE = new RegExp(`^wardrobe/(${UUID})/(?:item|look|avatar|cover|wishlist)/${UUID}$`);

type Listing = {
  resources: { public_id: string; created_at: string }[];
  next_cursor?: string;
};

export async function deleteOrphanUploads(now = new Date()): Promise<number> {
  const cutoff = now.getTime() - ORPHAN_AGE_MS;
  const old: { publicId: string; userId: string }[] = [];
  let cursor: string | undefined;

  // 1. Every old file this app made (a failed listing throws: nothing is deleted on a partial picture).
  for (let page = 0; page < MAX_PAGES; page++) {
    const listing = (await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix: 'wardrobe/',
      max_results: 500,
      ...(cursor ? { next_cursor: cursor } : {}),
    })) as Listing;

    for (const r of listing.resources) {
      const userId = APP_FILE.exec(r.public_id)?.[1];
      const created = Date.parse(r.created_at);
      if (userId && Number.isFinite(created) && created < cutoff) {
        old.push({ publicId: r.public_id, userId });
      }
    }

    cursor = listing.next_cursor;
    if (!cursor) break;
  }
  if (!old.length) return 0;

  // 2. Keep those of unknown users and those with an images row.
  const users = new Set<string>();
  const saved = new Set<string>();
  const userIds = [...new Set(old.map((f) => f.userId))];
  for (let i = 0; i < userIds.length; i += 500) {
    const found = await prisma.user.findMany({
      where: { id: { in: userIds.slice(i, i + 500) } },
      select: { id: true },
    });
    found.forEach((u) => users.add(u.id));
  }
  const ofUsers = old.filter((f) => users.has(f.userId));
  for (let i = 0; i < ofUsers.length; i += 500) {
    const rows = await prisma.image.findMany({
      where: { publicId: { in: ofUsers.slice(i, i + 500).map((f) => f.publicId) } },
      select: { publicId: true },
    });
    rows.forEach((r) => saved.add(r.publicId));
  }
  const orphans = ofUsers.filter((f) => !saved.has(f.publicId)).map((f) => f.publicId);

  // 3. The sanity check, then delete.
  if (orphans.length > ORPHAN_ALARM && orphans.length > ofUsers.length * MAX_ORPHAN_SHARE) {
    throw new Error(
      `Orphan uploads: ${orphans.length} of ${ofUsers.length} old files have no images row. ` +
        'That looks like the wrong database, so nothing was deleted.',
    );
  }
  await deleteFiles(orphans);
  return orphans.length;
}
