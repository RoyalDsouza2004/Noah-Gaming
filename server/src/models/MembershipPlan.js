import mongoose from 'mongoose';

const membershipPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Membership plan name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Membership price is required'],
      min: [0, 'Price cannot be negative'],
      // Stored in paise (e.g. ₹999 = 99900 paise)
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    validityDuration: {
      type: Number,
      required: [true, 'Validity duration number is required'],
      min: [1, 'Validity duration must be at least 1'],
      default: 30,
    },
    validityUnit: {
      type: String,
      enum: ['DAYS', 'MONTHS', 'YEARS'],
      default: 'DAYS',
      uppercase: true,
    },
    eligibleDevices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
      },
    ],
    eligibleGames: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
      },
    ],
    includedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GameCategory',
      },
    ],
    isUnlimited: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Fair-use parameters for unlimited / daily plans
    dailyUsageLimit: {
      type: Number,
      default: 120, // In minutes (e.g. 120 = 2 hours/day). 0 = unlimited hours
    },
    maximumSessionDuration: {
      type: Number,
      default: 120, // In minutes (continuous session cap, e.g. 2 hours)
    },
    maximumBookingsPerDay: {
      type: Number,
      default: 2, // Maximum bookings per day
    },
    advanceBookingLimit: {
      type: Number,
      default: 7, // Days in advance a member can reserve
    },
    peakHourRestrictions: {
      enabled: { type: Boolean, default: false },
      restrictedHours: [{ type: String }], // e.g. ['18:00', '19:00', '20:00']
    },
    privateBookingAllowed: {
      type: Boolean,
      default: false, // Unlimited membership covers shared stations by default
    },
    sharedBookingAllowed: {
      type: Boolean,
      default: true,
    },
    includesExclusiveGames: {
      type: Boolean,
      default: false, // GTA 6 requires separate explicit eligibility!
    },
    discountPercentage: {
      type: Number,
      default: 100, // 100% means fully covered, 50 means 50% discount on standard rates
      min: 0,
      max: 100,
    },
    renewalEnabled: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

membershipPlanSchema.virtual('priceInRupees').get(function () {
  return this.price ? this.price / 100 : 0;
});

const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);
export default MembershipPlan;
