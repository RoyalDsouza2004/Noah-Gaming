import mongoose from 'mongoose';

const membershipUsageSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipSubscription',
      required: [true, 'Subscription reference is required'],
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required'],
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
    },
    usageDate: {
      type: String, // YYYY-MM-DD in IST
      required: true,
      index: true,
    },
    startTime: {
      type: String, // e.g. "14:00"
      required: true,
    },
    endTime: {
      type: String, // e.g. "16:00"
      required: true,
    },
    duration: {
      type: Number, // In minutes (e.g. 60, 120)
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Composite indexes for daily quota validation
membershipUsageSchema.index({ customer: 1, usageDate: 1, status: 1 });
membershipUsageSchema.index({ subscription: 1, usageDate: 1, status: 1 });

const MembershipUsage = mongoose.model('MembershipUsage', membershipUsageSchema);
export default MembershipUsage;
