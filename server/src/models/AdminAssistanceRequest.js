import mongoose from 'mongoose';

const adminAssistanceRequestSchema = new mongoose.Schema(
  {
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
    challengeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    requestType: {
      type: String,
      enum: ['REGISTRATION', 'LOGIN_2FA', 'GUEST_CONVERSION'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONSUMED'],
      default: 'PENDING',
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
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    approvalToken: {
      type: String,
      default: null,
      index: true,
    },
    adminDecision: {
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
      },
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      adminName: {
        type: String,
        default: '',
      },
      decidedAt: {
        type: Date,
        default: null,
      },
      reason: {
        type: String,
        default: '',
      },
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

// TTL index to automatically prune historical assistance records after 2 hours
adminAssistanceRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

const AdminAssistanceRequest = mongoose.model(
  'AdminAssistanceRequest',
  adminAssistanceRequestSchema
);

export default AdminAssistanceRequest;
