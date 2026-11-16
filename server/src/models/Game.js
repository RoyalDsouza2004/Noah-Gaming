import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Game name is required'],
      trim: true,
      maxlength: [100, 'Game name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameCategory',
      required: [true, 'Game category is required'],
      index: true,
    },
    compatibleDevices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
      },
    ],
    minPlayers: {
      type: Number,
      required: [true, 'Minimum player count is required'],
      min: [1, 'Minimum players must be at least 1'],
      default: 1,
    },
    maxPlayers: {
      type: Number,
      required: [true, 'Maximum player count is required'],
      min: [1, 'Maximum players must be at least 1'],
      default: 4,
      validate: {
        validator: function (val) {
          return val >= (this.minPlayers || 1);
        },
        message: 'Maximum players must be greater than or equal to minimum players',
      },
    },
    bookingMode: {
      type: String,
      enum: {
        values: ['SHARED', 'PRIVATE_ONLY', 'BOTH'],
        message: 'Booking mode must be SHARED, PRIVATE_ONLY, or BOTH',
      },
      default: 'BOTH',
      index: true,
    },
    isExclusive: {
      type: Boolean,
      default: false,
      index: true,
    },
    pricing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pricing',
      default: null,
    },
    advancePaymentRequired: {
      type: Boolean,
      default: false,
    },
    minimumAdvancePayment: {
      type: Number,
      default: 0, // Stored in paise (e.g. ₹75 = 7500 paise)
      min: [0, 'Advance payment cannot be negative'],
    },
    minimumDuration: {
      type: Number,
      default: 60, // in minutes
      min: [30, 'Minimum duration must be at least 30 minutes'],
    },
    maximumDuration: {
      type: Number,
      default: 240, // in minutes
      max: [720, 'Maximum duration cannot exceed 720 minutes (12 hours)'],
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
  }
);

const Game = mongoose.model('Game', gameSchema);
export default Game;
