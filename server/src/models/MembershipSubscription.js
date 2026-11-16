import mongoose from 'mongoose';

const membershipSubscriptionSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    membershipPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: [true, 'Membership plan reference is required'],
      index: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    startDate: {
      type: Date,
      required: true,
    },
    expirationDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'UPGRADED'],
      default: 'PENDING',
      index: true,
    },
    upgradedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipSubscription',
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    paymentReference: {
      type: String,
      default: '',
    },
    renewalHistory: [
      {
        renewedAt: { type: Date, default: Date.now },
        previousExpirationDate: Date,
        newExpirationDate: Date,
        payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
        renewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: String,
      },
    ],
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to check if subscription is currently active
membershipSubscriptionSchema.virtual('isCurrentlyValid').get(function () {
  return this.status === 'ACTIVE' && new Date() <= this.expirationDate;
});

const MembershipSubscription = mongoose.model(
  'MembershipSubscription',
  membershipSubscriptionSchema
);
export default MembershipSubscription;
