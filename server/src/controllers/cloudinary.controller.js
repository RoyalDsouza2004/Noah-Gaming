import {
  generateUploadSignature,
  deleteCloudinaryAsset,
  PERMITTED_FOLDERS,
  validateFolderPermission,
} from '../services/cloudinary.service.js';
import User from '../models/User.js';

/**
 * Generate a signed upload signature for direct client-to-Cloudinary upload
 */
export const getUploadSignature = async (req, res, next) => {
  try {
    const { folder = PERMITTED_FOLDERS.PROFILES } = req.body;

    // Validate folder permissions according to user role
    if (!validateFolderPermission(folder, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Your role (${req.user.role}) is not authorized to upload to folder '${folder}'.`,
      });
    }

    const signatureData = generateUploadSignature({
      folder,
      userRole: req.user.role,
    });

    res.json({
      success: true,
      data: signatureData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Safely delete a Cloudinary asset with ownership and authorization checks
 */
export const deleteAsset = async (req, res, next) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'publicId is required to delete an asset.',
      });
    }

    // Security check: Profile pictures can only be deleted by the owner or an admin
    if (publicId.startsWith('noah-gaming/profiles/')) {
      if (req.user.role !== 'admin') {
        const user = await User.findById(req.user._id);
        if (user.profilePicturePublicId !== publicId) {
          return res.status(403).json({
            success: false,
            message: 'You are only authorized to delete your own profile photo.',
          });
        }
      }
    } else if (publicId.startsWith('noah-gaming/games/')) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can delete game artwork.',
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized asset deletion request.',
      });
    }

    const result = await deleteCloudinaryAsset(publicId);
    res.json({
      success: true,
      message: 'Cloudinary asset deleted successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
