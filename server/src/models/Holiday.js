import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday / closure name is required'],
      trim: true,
      maxlength: [100, 'Holiday name cannot exceed 100 characters'],
    },
    startDate: {
      type: String, // 'YYYY-MM-DD' in Asia/Kolkata
      required: [true, 'Start date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'],
      index: true,
    },
    endDate: {
      type: String, // 'YYYY-MM-DD' in Asia/Kolkata (inclusive)
      required: [true, 'End date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'],
      index: true,
    },
    closureType: {
      type: String,
      enum: ['FULL_DAY', 'PARTIAL'],
      default: 'FULL_DAY',
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    notifyCustomers: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    partialClosure: {
      openTime: {
        type: String, // 'HH:mm' e.g. '14:00'
        default: null,
      },
      closeTime: {
        type: String, // 'HH:mm' e.g. '22:00'
        default: null,
      },
      closedIntervals: [
        {
          startTime: { type: String, required: true }, // e.g. '14:00'
          endTime: { type: String, required: true }, // e.g. '17:00'
          reason: { type: String, default: 'Temporary Closure' },
        },
      ],
    },
    affectedBookingsCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active holidays within a date range
holidaySchema.index({ startDate: 1, endDate: 1, status: 1 });
holidaySchema.index({ closureType: 1, status: 1 });

const Holiday = mongoose.model('Holiday', holidaySchema);
export default Holiday;
