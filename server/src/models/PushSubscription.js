import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
        trim: true,
      },
      auth: {
        type: String,
        required: true,
        trim: true,
      },
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
      index: true,
    },
    browser: {
      type: String,
      default: '',
      trim: true,
    },
    os: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSuccessAt: {
      type: Date,
      default: null,
    },
    lastFailureAt: {
      type: Date,
      default: null,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding user subscriptions
pushSubscriptionSchema.index({ user: 1, isActive: 1, updatedAt: -1 });

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
export default PushSubscription;
