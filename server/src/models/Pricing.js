import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Pricing plan name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    deviceType: {
      type: String,
      enum: ['PS5', 'POOL', 'EXCLUSIVE', 'GENERAL'],
      default: 'GENERAL',
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
    },
    billingType: {
      type: String,
      enum: ['PER_PLAYER_HOURLY', 'PER_DEVICE_HOURLY', 'FIXED_SESSION'],
      required: [true, 'Billing type is required'],
      default: 'PER_PLAYER_HOURLY',
    },
    amount: {
      type: Number,
      required: [true, 'Amount in paise is required'],
      min: [0, 'Amount cannot be negative'],
      // Stored in paise: ₹60 = 6000 paise, ₹160 = 16000 paise, ₹150 = 15000 paise
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    minimumDuration: {
      type: Number,
      default: 60, // in minutes
    },
    maximumDuration: {
      type: Number,
      default: 240, // in minutes
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

// Virtual for rupee representation
pricingSchema.virtual('amountInRupees').get(function () {
  return this.amount ? this.amount / 100 : 0;
});

const Pricing = mongoose.model('Pricing', pricingSchema);
export default Pricing;
