import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['customer', 'receptionist', 'admin', 'all_staff'],
      default: 'customer',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'BOOKING_CONFIRMED',
        'UPCOMING_BOOKING',
        'SESSION_STARTED',
        'SESSION_WARNING',
        'SESSION_EXPIRED',
        'SESSION_COMPLETED',
        'SESSION_EXTENDED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_FAILED',
        'PAYMENT_PENDING',
        'MEMBERSHIP_ACTIVATED',
        'MEMBERSHIP_EXPIRING',
        'MEMBERSHIP_EXPIRED',
        'MEMBERSHIP_RENEWED',
        'DEVICE_MAINTENANCE',
        'REVENUE_SUMMARY',
        'SYSTEM',
      ],
      required: true,
      index: true,
    },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    relatedSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GamingSession',
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deliveryChannels: {
      type: [String],
      default: ['IN_APP'],
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true, // Prevents duplicate notifications for the same trigger event
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

// Indexes for fast user inbox retrieval
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
