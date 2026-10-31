// The response envelope and error codes (02 §5).

export type PageMeta = {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

export type Success<T, M = undefined> = { success: true; data: T; meta?: M };

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UPLOAD_INVALID'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'SUBCATEGORY_EXISTS'
  | 'SUBCATEGORY_IN_USE'
  | 'ITEM_IN_USE'
  | 'OUTFIT_DUPLICATE'
  | 'WISHLIST_DUPLICATE'
  | 'OUTFIT_INVALID'
  | 'CONFIRMATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type FieldError = { field: string; message: string };

export type Failure = {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
};

// What every failed call rejects with. `status` is 0 when the server couldn't be reached.
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork() {
    return this.status === 0;
  }
}

export type Image = { url: string; width: number | null; height: number | null };

export type Accent = 'black' | 'sage' | 'blue' | 'clay' | 'plum';

export type Me = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar: Image | null;
  cover: Image | null;
  settings: {
    accent: Accent;
    tempUnit: 'C' | 'F';
    useLocation: boolean;
    cityName: string | null;
  };
  counts: { items: number; outfits: number; looks: number; liked: number; wishlist: number };
};

// Shapes from 02 §8.1.

export type CategorySlug = 'top' | 'bottom' | 'shoes' | 'accessory';

export type Category = { id: string; slug: CategorySlug; name: string };

export type Subcategory = { id: string; categoryId: string; name: string; itemCount?: number };

export type Color = { id: string; slug: string; name: string; hex: string; isNeutral?: boolean };

export type Item = {
  id: string;
  category: Category;
  subcategory: Subcategory;
  color: Color;
  image: Image;
  isLiked: boolean;
};

export type ItemDetail = Item & { usage: { outfits: number; looks: number } };

export type UploadKind = 'item' | 'look' | 'avatar' | 'cover';

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  allowedFormats: string;
  maxBytes: number;
};

// Only the parts of GET /stats the closet uses; the stats page (phase 9) adds the rest.
export type Stats = {
  composition: { total: number; byColor: { color: Color; count: number; percent: number }[] };
};
