import mongoose from 'mongoose';
import crypto from 'crypto';

const otpVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    purpose: {
      type: String,
      required: true,
      enum: ['LOGIN_2FA', 'GUEST_CONVERSION', 'EMAIL_VERIFICATION', 'PASSWORD_RESET'],
      index: true,
    },
    challengeId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    resendAvailableAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically prune historical OTP records after 1 hour
// Enforced programmatically at 5 minutes on the backend as well
otpVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

/**
 * Generate a cryptographically secure random 6-digit numeric OTP string
 */
otpVerificationSchema.statics.generateNumericOtp = function () {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash an OTP using SHA-256
 */
otpVerificationSchema.statics.hashOtp = function (otp) {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
};

/**
 * Verify an input OTP against stored hash using constant-time comparison
 */
otpVerificationSchema.methods.verifyOtp = function (candidateOtp) {
  if (!candidateOtp) return false;
  const candidateHash = crypto
    .createHash('sha256')
    .update(String(candidateOtp).trim())
    .digest('hex');

  const storedBuffer = Buffer.from(this.otpHash, 'hex');
  const candidateBuffer = Buffer.from(candidateHash, 'hex');

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, candidateBuffer);
};

const OtpVerification = mongoose.model('OtpVerification', otpVerificationSchema);
export default OtpVerification;
