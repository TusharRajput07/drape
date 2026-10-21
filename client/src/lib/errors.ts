import { toast } from 'sonner';
import { ApiError, type FieldError } from './api-types';

// Error code → what the user sees (03 §11). Codes shown inside a sheet or under a field are handled by
// the screen that owns them; everything else ends up here as a toast.

const GENERIC = 'Something went wrong. Try again.';

export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError) || err.isNetwork) return GENERIC;
  switch (err.code) {
    case 'UPLOAD_INVALID':
      return 'Upload failed. Try again.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Try again in a few minutes.';
    case 'NOT_FOUND':
      return "That's no longer here.";
    case 'INTERNAL_ERROR':
      return GENERIC;
    default:
      return err.message;
  }
}

export function toastError(err: unknown) {
  toast(errorMessage(err));
}

// `VALIDATION_ERROR` details as { field: message }, for showing under the matching inputs.
export function fieldErrors(err: unknown): Record<string, string> {
  if (
    !(err instanceof ApiError) ||
    err.code !== 'VALIDATION_ERROR' ||
    !Array.isArray(err.details)
  ) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const d of err.details as FieldError[]) {
    if (d?.field && !out[d.field]) out[d.field] = d.message;
  }
  return out;
}
