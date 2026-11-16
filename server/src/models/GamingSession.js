import mongoose from 'mongoose';

const gamingSessionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    scheduledEndAt: {
      type: Date,
      required: true,
      index: true,
    },
    actualEndAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'ACTIVE',
        'EXTENDED',
        'TIME_EXPIRED',
        'AWAITING_RECEPTIONIST',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'ACTIVE',
      index: true,
    },
    lastReminderSent: {
      type: String, // '15_MIN', '5_MIN', '1_MIN', 'EXPIRED'
      default: null,
    },
    reminderHistory: [
      {
        thresholdMinutes: { type: Number, required: true },
        label: { type: String, required: true },
        sentAt: { type: Date, default: Date.now },
        channels: [{ type: String }],
      },
    ],
    extensionHistory: [
      {
        extensionId: { type: String },
        extendedDurationHours: { type: Number, required: true },
        previousEndAt: { type: Date, required: true },
        newEndAt: { type: Date, required: true },
        extendedAt: { type: Date, default: Date.now },
        extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        additionalAmountPaise: { type: Number, default: 0 },
        notes: { type: String, default: '' },
      },
    ],
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: calculate remaining seconds in real-time against server-side end timestamp
gamingSessionSchema.virtual('remainingSeconds').get(function () {
  if (this.status === 'COMPLETED' || this.status === 'CANCELLED') return 0;
  if (!this.scheduledEndAt) return 0;
  const now = Date.now();
  const end = new Date(this.scheduledEndAt).getTime();
  return Math.max(0, Math.floor((end - now) / 1000));
});

// Virtual: check if session has expired scheduled time and is awaiting checkout
gamingSessionSchema.virtual('isOverdue').get(function () {
  if (this.status === 'COMPLETED' || this.status === 'CANCELLED') return false;
  if (!this.scheduledEndAt) return false;
  return Date.now() >= new Date(this.scheduledEndAt).getTime();
});

// Compound indexes for high-frequency scheduler scanning
gamingSessionSchema.index({ status: 1, scheduledEndAt: 1 });
gamingSessionSchema.index({ customer: 1, status: 1 });
gamingSessionSchema.index({ device: 1, status: 1 });

const GamingSession = mongoose.model('GamingSession', gamingSessionSchema);
export default GamingSession;
