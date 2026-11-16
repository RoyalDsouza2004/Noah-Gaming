import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      maxlength: [100, 'Device name cannot exceed 100 characters'],
    },
    deviceCode: {
      type: String,
      required: [true, 'Unique device code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Device code cannot exceed 20 characters'],
      index: true,
    },
    deviceType: {
      type: String,
      enum: ['PS5', 'POOL', 'EXCLUSIVE', 'VR', 'PC', 'OTHER'],
      required: [true, 'Device type is required'],
      default: 'PS5',
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    capacity: {
      type: Number,
      required: [true, 'Maximum player capacity is required'],
      min: [1, 'Capacity must be at least 1 player'],
      max: [16, 'Capacity cannot exceed 16 players'],
      default: 4,
    },
    supportedGames: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Device = mongoose.model('Device', deviceSchema);
export default Device;
