import axios from 'axios';
import { api } from './api';
import { ApiError, type Success, type UploadKind, type UploadSignature } from './api-types';

// Signed direct upload (02 §8.12): the server signs, the browser sends the file straight to Cloudinary.
// Resolves to the Cloudinary public id, which the resource endpoint (e.g. POST /items) then verifies.
export async function uploadImage(
  file: Blob,
  kind: UploadKind,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { data: sig } = await api.post<unknown, Success<UploadSignature>>('/uploads/signature', {
    kind,
  });

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('public_id', sig.publicId);
  form.append('allowed_formats', sig.allowedFormats);

  try {
    const res = await axios.post<{ public_id: string }>(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
      form,
      { onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total) },
    );
    return res.data.public_id;
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      throw new ApiError(0, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
    }
    throw new ApiError(400, 'UPLOAD_INVALID', 'Upload failed. Try again.');
  }
}
