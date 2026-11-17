import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required'],
      index: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
      index: true,
    },
    isVenueSelection: {
      type: Boolean,
      default: false,
      index: true,
    },
    gameClassification: {
      type: String,
      enum: ['NON_EXCLUSIVE', 'EXCLUSIVE', 'NONE'],
      default: 'NON_EXCLUSIVE',
      index: true,
    },
    gameTitle: {
      type: String,
      default: null,
    },
    bookingType: {
      type: String,
      enum: ['SHARED', 'PRIVATE'],
      required: [true, 'Booking type is required (SHARED or PRIVATE)'],
      default: 'SHARED',
      index: true,
    },
    bookingDate: {
      type: String, // Stored in YYYY-MM-DD IST string for fast querying
      required: [true, 'Booking date is required'],
      index: true,
    },
    startTime: {
      type: String, // e.g. "14:00"
      required: [true, 'Start time is required'],
      get: function (v) {
        if (this.startAt) {
          try {
            return new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(this.startAt);
          } catch {
            return v;
          }
        }
        return v;
      },
    },
    endTime: {
      type: String, // e.g. "16:00"
      required: [true, 'End time is required'],
      get: function (v) {
        if (this.endAt) {
          try {
            return new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(this.endAt);
          } catch {
            return v;
          }
        }
        return v;
      },
    },
    startAt: {
      type: Date, // UTC timestamp corresponding to IST start time
      required: [true, 'Exact start timestamp is required'],
      index: true,
    },
    endAt: {
      type: Date, // UTC timestamp corresponding to IST end time
      required: [true, 'Exact end timestamp is required'],
      index: true,
    },
    duration: {
      type: Number, // Duration in hours (e.g. 1, 2, 3)
      required: true,
      min: [0.5, 'Duration must be at least 30 minutes'],
    },
    numberOfPlayers: {
      type: Number,
      required: true,
      min: [1, 'At least 1 player is required'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
      // Stored in paise (e.g. ₹120 = 12000 paise)
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0, // In paise
    },
    balanceRemaining: {
      type: Number,
      default: 0,
      min: 0, // In paise
    },
    advanceRequired: {
      type: Boolean,
      default: false,
    },
    advanceAmount: {
      type: Number,
      default: 0, // In paise
    },
    isAdvancePaid: {
      type: Boolean,
      default: false,
    },
    paymentExpiresAt: {
      type: Date, // Temporary hold expiry (e.g. 15 mins for online payment)
      default: null,
      index: true,
    },
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
      },
    ],
    membershipApplied: {
      type: Boolean,
      default: false,
    },
    membershipSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipSubscription',
      default: null,
    },
    membershipDiscount: {
      type: Number,
      default: 0, // In paise
    },
    membershipUsage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipUsage',
      default: null,
    },
    membershipEntitlement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipEntitlement',
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
    },
    pricePerPlayer: {
      type: Number,
      default: 0, // In paise
    },
    pricingSnapshot: {
      pricingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pricing' },
      planName: String,
      billingType: String,
      ratePerUnitPaise: Number,
      ratePerUnitRupees: Number,
      currency: { type: String, default: 'INR' },
      advanceRequired: Boolean,
      minimumAdvancePaise: Number,
    },
    playerSlots: [
      {
        slotNumber: Number,
        playerName: String,
        isHost: { type: Boolean, default: false },
      },
    ],
    bookingStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
      default: 'CONFIRMED',
      index: true,
    },
    checkInStatus: {
      type: String,
      enum: ['NOT_CHECKED_IN', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED'],
      default: 'NOT_CHECKED_IN',
      index: true,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sessionStatus: {
      type: String,
      enum: ['SCHEDULED', 'ACTIVE', 'EXTENDED', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    sessionStartedAt: {
      type: Date,
      default: null,
    },
    sessionStartedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sessionCompletedAt: {
      type: Date,
      default: null,
    },
    sessionCompletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actualDurationMinutes: {
      type: Number,
      default: null,
    },
    extensions: [
      {
        extensionId: { type: String, required: true },
        extendedDurationHours: { type: Number, required: true },
        previousEndTime: { type: String, required: true },
        newEndTime: { type: String, required: true },
        previousEndAt: { type: Date, required: true },
        newEndAt: { type: Date, required: true },
        additionalAmountPaise: { type: Number, required: true },
        extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        extendedAt: { type: Date, default: Date.now },
        notes: { type: String, default: '' },
      },
    ],
    extensionTotalAmountPaise: {
      type: Number,
      default: 0,
    },
    isWalkIn: {
      type: Boolean,
      default: false,
      index: true,
    },
    walkInCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: [
        'UNPAID',
        'PENDING',
        'PROCESSING',
        'PAID',
        'PARTIALLY_PAID',
        'FAILED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
      ],
      default: 'UNPAID',
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// Virtual for rupee representation
bookingSchema.virtual('totalAmountInRupees').get(function () {
  return this.totalAmount ? this.totalAmount / 100 : 0;
});

bookingSchema.virtual('amountPaidInRupees').get(function () {
  return this.amountPaid ? this.amountPaid / 100 : 0;
});

bookingSchema.virtual('balanceRemainingInRupees').get(function () {
  return this.balanceRemaining ? this.balanceRemaining / 100 : 0;
});

// Composite indexes for efficient availability and overlap querying
bookingSchema.index({ device: 1, startAt: 1, endAt: 1, bookingStatus: 1 });
bookingSchema.index({ device: 1, bookingDate: 1, bookingStatus: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
