import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: [true, 'Payment reference is required'],
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Refund amount in paise is required'],
      min: [1, 'Refund amount must be greater than zero'], // in paise
    },
    currency: {
      type: String,
      default: 'INR',
    },
    reason: {
      type: String,
      required: [true, 'Reason for refund is mandatory'],
      trim: true,
    },
    refundType: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE',
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED',
      index: true,
    },
    gatewayRefundId: {
      type: String,
      default: null,
      sparse: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member initiating refund is required'],
    },
    notes: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

refundSchema.virtual('amountInRupees').get(function () {
  return this.amount ? this.amount / 100 : 0;
});

const Refund = mongoose.model('Refund', refundSchema);
export default Refund;
