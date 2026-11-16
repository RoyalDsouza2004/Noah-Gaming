import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    membershipPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      index: true,
    },
    membershipSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipSubscription',
      index: true,
    },
    paymentPurpose: {
      type: String,
      enum: [
        'BOOKING_FULL',
        'GTA6_ADVANCE',
        'BOOKING_BALANCE',
        'MEMBERSHIP_NEW',
        'MEMBERSHIP_RENEWAL',
        'MEMBERSHIP_UPGRADE',
        'WALKIN_OFFLINE',
      ],
      default: 'BOOKING_FULL',
      required: true,
    },
    paymentGateway: {
      type: String,
      enum: ['RAZORPAY', 'OFFLINE_CASH', 'OFFLINE_COUNTER_UPI', 'MANUAL_ADJUSTMENT'],
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'CASH', 'COUNTER_UPI', 'OTHER'],
      default: 'UPI',
    },
    gatewayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    gatewayPaymentId: {
      type: String,
      index: true,
      sparse: true,
    },
    gatewaySignatureVerified: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount in paise is required'],
      min: [0, 'Amount cannot be negative'], // In paise (e.g. ₹150 = 15000 paise)
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        'PENDING',
        'PROCESSING',
        'PAID',
        'PARTIALLY_PAID',
        'FAILED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
      ],
      default: 'PENDING',
      index: true,
    },
    transactionReference: {
      type: String,
      default: '',
      trim: true,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Staff/receptionist for offline collections
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    refundedAmount: {
      type: Number,
      default: 0, // In paise
      min: 0,
    },
    refundReference: {
      type: String,
      default: '',
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    auditTrail: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for rupee conversion
paymentSchema.virtual('amountInRupees').get(function () {
  return this.amount ? this.amount / 100 : 0;
});

paymentSchema.virtual('refundedAmountInRupees').get(function () {
  return this.refundedAmount ? this.refundedAmount / 100 : 0;
});

// Indexes for reporting and search
paymentSchema.index({ customer: 1, paymentStatus: 1 });
paymentSchema.index({ booking: 1, paymentStatus: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
