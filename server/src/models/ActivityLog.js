import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userName: {
      type: String,
      default: 'System/Guest',
    },
    userRole: {
      type: String,
      default: 'guest',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['AUTH', 'BOOKING', 'DEVICE', 'PAYMENT', 'MEMBERSHIP', 'SYSTEM', 'RECEPTIONIST', 'USER_MANAGEMENT'],
      default: 'SYSTEM',
      index: true,
    },
    bookingId: {
      type: String,
      default: '',
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    paymentReference: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'WARNING'],
      default: 'SUCCESS',
    },
  },
  {
    timestamps: true,
  }
);

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
