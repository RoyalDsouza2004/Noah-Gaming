import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[0-9]{10}$/, 'Mobile number must be a valid 10-digit number'],
    },
    customerId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    profilePicturePublicId: {
      type: String,
      default: '',
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['GUEST', 'REGISTERED'],
      default: 'REGISTERED',
      index: true,
    },
    isGuest: {
      type: Boolean,
      default: false,
      index: true,
    },
    guestConvertedAt: {
      type: Date,
      default: null,
    },
    guestConvertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION'],
      default: 'ACTIVE',
      index: true,
      set: (v) => v ? v.toUpperCase() : 'ACTIVE',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    emailVerificationMethod: {
      type: String,
      enum: ['email_otp', 'admin_assisted', 'none'],
      default: 'none',
    },
    notes: {
      type: String,
      default: '',
    },
    conversionOtp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },
    passwordResetOtp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },
    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    mergedInto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    mergedAt: {
      type: Date,
      default: null,
    },
    password: {
      type: String,
      required: false,
      select: false, // Do not return password by default
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
      index: true,
    },
    membership: {
      status: {
        type: String,
        enum: ['none', 'active', 'expired', 'suspended', 'NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED'],
        default: 'NONE',
        set: (v) => v ? v.toUpperCase() : 'NONE',
      },
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MembershipPlan',
        default: null,
      },
      subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MembershipSubscription',
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      dailyUsageMinutesUsed: {
        type: Number,
        default: 0,
      },
      lastUsageDate: {
        type: String,
        default: '',
      },
      remainingHours: {
        type: Number,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: auto-assign customerId, sync isGuest flag, and hash password
userSchema.pre('save', async function (next) {
  if (this.accountType === 'GUEST') {
    this.isGuest = true;
  } else {
    this.isGuest = false;
  }

  if (!this.customerId && this.role === ROLES.CUSTOMER) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.customerId = `CUST-${dateStr}-${rand}`;
  }

  if (!this.password && this.isGuest) {
    // Generate an unusable internal random password for guests until they convert
    this.password = `GuestPass_${Math.random().toString(36).slice(2)}!${Date.now()}`;
  }

  if (!this.isModified('password') || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT Auth Token
userSchema.methods.generateAuthToken = function () {
  const payload = {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    accountType: this.accountType || 'REGISTERED',
    isGuest: !!this.isGuest,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'nexus_gaming_lounge_secret_fallback', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Generate secure, time-limited password reset token (hashed in DB)
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity
  return resetToken;
};

// Return safe user object without password or sensitive OTP tokens
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.conversionOtp;
  delete obj.passwordResetOtp;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
