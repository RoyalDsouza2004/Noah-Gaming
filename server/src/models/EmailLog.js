import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailType: {
      type: String,
      required: true,
      default: 'TEST',
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    relatedId: {
      bookingId: { type: String, default: null, index: true },
      paymentId: { type: String, default: null, index: true },
      membershipId: { type: String, default: null, index: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    },
    // Deduplication key: prevents sending duplicate emails for the same business event (e.g. webhook retries)
    eventKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    resendEmailId: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['NOT_CONFIGURED', 'QUEUED', 'ACCEPTED', 'DELIVERED', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    hasAttachment: {
      type: Boolean,
      default: false,
    },
    attachmentName: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const EmailLog = mongoose.model('EmailLog', emailLogSchema);
export default EmailLog;
