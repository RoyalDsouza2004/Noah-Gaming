import mongoose from 'mongoose';

const automationLogSchema = new mongoose.Schema(
  {
    jobType: {
      type: String,
      enum: [
        'SESSION_TIMERS',
        'SESSION_EXPIRATION',
        'BOOKING_REMINDERS',
        'MEMBERSHIP_ALERTS',
        'MASTER_AUTOMATION_CYCLE',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'WARNING', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    executedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

automationLogSchema.index({ executedAt: -1 });

const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);
export default AutomationLog;
