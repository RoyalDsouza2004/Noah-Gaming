import mongoose from 'mongoose';

const otpAuditLogSchema = new mongoose.Schema(
  {
    challengeId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ['REGISTRATION', 'LOGIN_2FA', 'GUEST_CONVERSION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'],
      index: true,
    },
    emailDeliveryStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'NOT_CONFIGURED'],
      default: 'PENDING',
      index: true,
    },
    emailDeliveryError: {
      type: String,
      default: '',
    },
    assistanceRequested: {
      type: Boolean,
      default: false,
      index: true,
    },
    assistanceRequestedAt: {
      type: Date,
      default: null,
    },
    resolution: {
      type: String,
      required: true,
      enum: ['EMAIL_OTP_VERIFIED', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'EXPIRED_UNUSED'],
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    adminName: {
      type: String,
      default: '',
      trim: true,
    },
    decisionTimestamp: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    requestTimestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: '',
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

otpAuditLogSchema.index({ createdAt: -1 });
otpAuditLogSchema.index({ email: 1, createdAt: -1 });
otpAuditLogSchema.index({ phone: 1, createdAt: -1 });

const OtpAuditLog = mongoose.model('OtpAuditLog', otpAuditLogSchema);

export default OtpAuditLog;
