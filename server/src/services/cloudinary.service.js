import { v2 as cloudinary } from 'cloudinary';

// Permitted Cloudinary upload folders to prevent arbitrary storage abuse
export const PERMITTED_FOLDERS = {
  PROFILES: 'noah-gaming/profiles',
  GAME_COVERS: 'noah-gaming/games/covers',
  GAME_BACKGROUNDS: 'noah-gaming/games/backgrounds',
  GAME_GALLERY: 'noah-gaming/games/gallery',
};

/**
 * Configure Cloudinary SDK dynamically
 */
export function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return true;
  }
  return false;
}

// Initial configuration attempt
configureCloudinary();

/**
 * Check if Cloudinary credentials are fully configured
 */
export function isCloudinaryConfigured() {
  const conf = cloudinary.config();
  return Boolean(conf.cloud_name && conf.api_key && conf.api_secret);
}

/**
 * Validates whether the requested folder is permitted for the given user role
 */
export function validateFolderPermission(folder, userRole) {
  if (!folder) return false;

  const validFolders = Object.values(PERMITTED_FOLDERS);
  if (!validFolders.includes(folder)) {
    return false;
  }

  // Profile pictures can be uploaded by any authenticated user
  if (folder === PERMITTED_FOLDERS.PROFILES) {
    return true;
  }

  // All game artwork folders strictly require administrator privileges
  if (
    folder === PERMITTED_FOLDERS.GAME_COVERS ||
    folder === PERMITTED_FOLDERS.GAME_BACKGROUNDS ||
    folder === PERMITTED_FOLDERS.GAME_GALLERY
  ) {
    return userRole === 'admin';
  }

  return false;
}

/**
 * Generates a cryptographic signature for direct client-to-Cloudinary upload
 */
export function generateUploadSignature({ folder, userRole, customParams = {} }) {
  if (!isCloudinaryConfigured()) {
    configureCloudinary();
    if (!isCloudinaryConfigured()) {
      const err = new Error(
        'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
      );
      err.status = 503;
      throw err;
    }
  }

  if (!validateFolderPermission(folder, userRole)) {
    const err = new Error(`Unauthorized or invalid upload folder: '${folder}' for role '${userRole}'`);
    err.status = 403;
    throw err;
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const conf = cloudinary.config();

  // Signed parameters that the client must match during upload
  const paramsToSign = {
    folder,
    timestamp,
    ...customParams,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, conf.api_secret);

  return {
    signature,
    timestamp,
    apiKey: conf.api_key,
    cloudName: conf.cloud_name,
    folder,
  };
}

/**
 * Safely destroys an asset in Cloudinary by its public ID
 */
export async function deleteCloudinaryAsset(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured()) {
    return { result: 'skipped' };
  }

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return res;
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete asset '${publicId}':`, err.message);
    return { result: 'error', error: err.message };
  }
}

/**
 * Generates transformed responsive image URLs
 */
export function getOptimizedImageUrl(publicId, type = 'avatar') {
  if (!publicId || !isCloudinaryConfigured()) return '';

  const transformations = {
    avatar: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }, { quality: 'auto', fetch_format: 'auto' }],
    cover: [{ width: 600, height: 800, crop: 'fill' }, { quality: 'auto', fetch_format: 'auto' }],
    background: [{ width: 1920, height: 1080, crop: 'fill' }, { quality: 'auto', fetch_format: 'auto' }],
    gallery: [{ width: 1280, height: 720, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
  };

  return cloudinary.url(publicId, {
    transformation: transformations[type] || [{ quality: 'auto', fetch_format: 'auto' }],
    secure: true,
  });
}
