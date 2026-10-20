import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

// One configured Cloudinary client. Only services/image.service.ts uses it.
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
