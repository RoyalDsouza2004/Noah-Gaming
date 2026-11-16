import React, { useState, useRef } from 'react';
import { Camera, Trash2, Upload, AlertCircle, CheckCircle2, Loader2, User } from 'lucide-react';
import { cloudinaryApi } from '../../api/cloudinary.js';
import { userProfileApi } from '../../api/userProfile.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProfilePictureUpload({ initialPicture, onUploadSuccess }) {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const currentPicture = user?.profilePicture || initialPicture;
  const userName = user?.name || 'Gamer';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size (5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError('Image file size exceeds the 5MB limit. Please choose a smaller photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setUploading(true);
      setProgress(10);

      // Direct secure signed upload to Cloudinary
      const result = await cloudinaryApi.uploadDirect(file, 'noah-gaming/profiles', (percent) => {
        setProgress(percent);
      });

      // Update backend user profile
      const updateRes = await userProfileApi.updateProfilePicture({
        profilePicture: result.secure_url,
        profilePicturePublicId: result.public_id,
      });

      if (updateRes.success) {
        // Immediately update AuthContext state
        updateUser({
          profilePicture: updateRes.data?.user?.profilePicture || result.secure_url,
          profilePicturePublicId: updateRes.data?.user?.profilePicturePublicId || result.public_id,
        });

        setSuccessMsg('Profile picture updated successfully!');
        if (onUploadSuccess) {
          onUploadSuccess(result.secure_url);
        }
      } else {
        throw new Error(updateRes.message || 'Failed to update user profile record.');
      }
    } catch (err) {
      console.error('Profile photo upload error:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!currentPicture) return;
    if (!window.confirm('Are you sure you want to remove your profile picture? This will restore the default avatar.')) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      setRemoving(true);
      const res = await userProfileApi.removeProfilePicture();
      if (res.success) {
        updateUser({
          profilePicture: '',
          profilePicturePublicId: '',
        });
        setSuccessMsg('Profile photo removed. Default avatar restored.');
        if (onUploadSuccess) onUploadSuccess('');
      } else {
        throw new Error(res.message || 'Failed to remove profile picture.');
      }
    } catch (err) {
      setError(err.message || 'Failed to remove photo.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar Display */}
        <div className="relative group flex-shrink-0">
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-[#D7FF00]/40 shadow-lg shadow-[#D7FF00]/10 bg-slate-950 flex items-center justify-center relative">
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/50 to-slate-900 text-[#D7FF00] font-heading font-black text-2xl tracking-wider">
              {userInitials || <User className="w-10 h-10 text-slate-500" />}
            </div>
            {currentPicture && (
              <img
                src={currentPicture}
                alt={userName}
                className="w-full h-full object-cover rounded-full absolute inset-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Quick upload overlay badge */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
            className="absolute bottom-0 right-0 p-2.5 rounded-full bg-[#D7FF00] text-slate-950 hover:bg-[#c8ee00] transition-transform hover:scale-110 shadow-md disabled:opacity-50"
            title="Upload new photo"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Controls & Description */}
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center justify-center sm:justify-start gap-2">
              Profile Photo
              {currentPicture && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Custom Avatar
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Upload a clear photo to personalize your NOAH GAMING pass. Supports JPEG, PNG, or WebP up to 5MB.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || removing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-slate-950 font-bold font-heading text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading ({progress}%)
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  {currentPicture ? 'Replace Photo' : 'Upload Photo'}
                </>
              )}
            </button>

            {currentPicture && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading || removing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 font-semibold text-xs transition-all disabled:opacity-50"
              >
                {removing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Photo
                  </>
                )}
              </button>
            )}
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="w-full max-w-sm space-y-1">
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#D7FF00] h-1.5 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Uploading to Cloudinary CDN: {progress}%
              </p>
            </div>
          )}

          {/* Status Feedback Messages */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
