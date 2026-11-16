import { apiRequest } from './client.js';

export const cloudinaryApi = {
  getUploadSignature: (folder) =>
    apiRequest('/cloudinary/sign', {
      method: 'POST',
      body: { folder },
    }),

  deleteAsset: (publicId) =>
    apiRequest('/cloudinary/asset', {
      method: 'DELETE',
      body: { publicId },
    }),

  /**
   * Uploads an image file directly to Cloudinary using signed parameters.
   * Never exposes CLOUDINARY_API_SECRET on the frontend.
   *
   * @param {File} file
   * @param {string} folder - 'noah-gaming/profiles' or 'noah-gaming/games/covers', etc.
   * @param {Function} [onProgress] - optional (percent) => void
   * @returns {Promise<{ secure_url: string, public_id: string, format: string, width: number, height: number }>}
   */
  uploadDirect: async (file, folder = 'noah-gaming/profiles', onProgress) => {
    // 1. Client-side pre-validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, and WebP images are supported.');
    }

    const isProfile = folder.includes('profiles');
    const maxSize = isProfile ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for profile, 10MB for artwork
    if (file.size > maxSize) {
      throw new Error(`Image size exceeds the maximum limit of ${maxSize / (1024 * 1024)}MB.`);
    }

    // 2. Request secure signature from backend
    const signResponse = await cloudinaryApi.getUploadSignature(folder);
    if (!signResponse?.success || !signResponse?.data) {
      throw new Error(signResponse?.message || 'Failed to acquire Cloudinary upload signature.');
    }

    const { signature, timestamp, apiKey, cloudName, folder: targetFolder } = signResponse.data;

    // 3. Assemble multipart payload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', targetFolder);

    // 4. Direct upload using XMLHttpRequest to track accurate progress
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              secure_url: res.secure_url,
              public_id: res.public_id,
              format: res.format,
              width: res.width,
              height: res.height,
            });
          } else {
            reject(new Error(res.error?.message || `Cloudinary upload failed (HTTP ${xhr.status})`));
          }
        } catch (e) {
          reject(new Error('Invalid response from Cloudinary upload endpoint.'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred during direct Cloudinary upload.'));
      };

      xhr.send(formData);
    });
  },
};
