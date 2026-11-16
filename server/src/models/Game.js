import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Game name is required'],
      trim: true,
      maxlength: [100, 'Game name cannot exceed 100 characters'],
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // Legacy thumbnail field (preserved for backwards compatibility)
    thumbnail: {
      type: String,
      default: '',
    },
    // Cloudinary Cover Artwork (noah-gaming/games/covers)
    coverImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    // Cloudinary Hero / Background Artwork (noah-gaming/games/backgrounds)
    backgroundImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    // Cloudinary Gallery Screenshots (noah-gaming/games/gallery)
    gallery: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        caption: { type: String, default: '' },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameCategory',
      required: [true, 'Game category is required'],
      index: true,
    },
    genre: {
      type: [String],
      default: ['Action'],
      index: true,
    },
    developer: {
      type: String,
      default: '',
      trim: true,
    },
    publisher: {
      type: String,
      default: '',
      trim: true,
    },
    releaseDate: {
      type: String,
      default: '',
      trim: true,
    },
    ageRating: {
      type: String,
      default: '',
      trim: true,
    },
    compatibleDevices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
      },
    ],
    platforms: {
      type: [String],
      default: ['PlayStation 5'],
    },
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
    // Verified local couch multiplayer player count supported at NOAH GAMING
    localPlayersSupported: {
      type: Number,
      min: [1, 'Local players must be at least 1'],
      max: [4, 'Local couch players on PS5 cannot exceed physical station capacity of 4'],
      default: 1,
    },
    multiplayer: {
      localCoop: { type: Boolean, default: false },
      splitScreen: { type: Boolean, default: false },
      offlineMultiplayer: { type: Boolean, default: true },
      maxOfflineCoopPlayers: { type: Number, default: 1 },
      maxOfflineMultiplayerPlayers: { type: Number, default: 1 },
      onlineCoop: { type: Boolean, default: false },
      maxOnlinePlayers: { type: Number, default: 0 },
    },
    ratings: {
      rawg: {
        rating: { type: Number, default: null },
        ratingTop: { type: Number, default: null },
        ratingsCount: { type: Number, default: 0 },
        reviewsCount: { type: Number, default: 0 },
      },
      metacritic: {
        score: { type: Number, default: null },
        url: { type: String, default: '' },
      },
      igdb: {
        rating: { type: Number, default: null },
        ratingCount: { type: Number, default: 0 },
      },
      custom: {
        score: { type: Number, default: null },
        scale: { type: String, default: '10' },
        source: { type: String, default: '' },
        label: { type: String, default: '' },
      },
    },
    trailers: [
      {
        title: { type: String, default: '' },
        youtubeId: { type: String, default: '' },
        videoUrl: { type: String, default: '' },
        previewUrl: { type: String, default: '' },
      },
    ],
    screenshots: {
      type: [String],
      default: [],
    },
    externalSync: {
      provider: {
        type: String,
        enum: ['rawg', 'igdb', 'curated', 'manual'],
        default: 'manual',
      },
      externalId: { type: String, default: null, index: true },
      externalSlug: { type: String, default: null },
      lastSyncedAt: { type: Date, default: null },
      manuallyEditedFields: { type: [String], default: [] },
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
      default: 0, // Stored in paise
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

// Pre-save synchronization hook: ensure coverImage and legacy thumbnail remain in sync
gameSchema.pre('save', function (next) {
  if (this.coverImage?.url && !this.thumbnail) {
    this.thumbnail = this.coverImage.url;
  } else if (this.thumbnail && !this.coverImage?.url) {
    this.coverImage = { url: this.thumbnail, publicId: '' };
  }

  // Ensure localPlayersSupported is within 1..4
  if (!this.localPlayersSupported) {
    this.localPlayersSupported = Math.min(4, Math.max(1, this.maxPlayers || 1));
  }

  next();
});

const Game = mongoose.model('Game', gameSchema);
export default Game;
