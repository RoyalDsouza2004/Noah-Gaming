import mongoose from 'mongoose';

const membershipUpgradeSchema = new mongoose.Schema(
  {
    upgradeTransactionId: {
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
      required: true,
      index: true,
    },
    previousSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipSubscription',
      required: true,
    },
    previousPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: true,
    },
    newPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: true,
    },
    originalMembershipAmount: {
      type: Number,
      required: true, // in paise
      min: 0,
    },
    remainingEligibleDays: {
      type: Number,
      required: true,
      min: 0,
    },
    totalValidityDays: {
      type: Number,
      required: true,
      min: 1,
    },
    calculatedUnusedCredit: {
      type: Number,
      required: true, // in paise
      min: 0,
    },
    newMembershipPrice: {
      type: Number,
      required: true, // in paise
      min: 0,
    },
    finalAmountPayable: {
      type: Number,
      required: true, // in paise
      min: 0,
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
    upgradeStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const MembershipUpgrade = mongoose.model('MembershipUpgrade', membershipUpgradeSchema);
export default MembershipUpgrade;
