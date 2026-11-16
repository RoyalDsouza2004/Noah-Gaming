import mongoose from 'mongoose';

const deviceMaintenanceSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Maintenance reason is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    startDate: {
      type: Date,
      required: [true, 'Maintenance start date is required'],
      default: Date.now,
    },
    expectedEndDate: {
      type: Date,
      default: null,
    },
    actualEndDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const DeviceMaintenance = mongoose.model('DeviceMaintenance', deviceMaintenanceSchema);
export default DeviceMaintenance;
