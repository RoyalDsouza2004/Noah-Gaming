import Game from '../models/Game.js';
import Device from '../models/Device.js';
import GameCategory from '../models/GameCategory.js';
import ActivityLog from '../models/ActivityLog.js';
import { gameMetadataService } from '../services/gameMetadata/gameMetadataService.js';

export const getAllGames = async (req, res) => {
  try {
    const { category, status, isExclusive, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (isExclusive !== undefined) filter.isExclusive = isExclusive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } },
      ];
    }

    const games = await Game.find(filter)
      .populate('category', 'name status')
      .populate('compatibleDevices', 'name deviceCode deviceType status capacity')
      .populate('pricing')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: { games, total: games.length },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve games',
      error: err.message,
    });
  }
};

export const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('category', 'name status')
      .populate('compatibleDevices', 'name deviceCode deviceType status capacity')
      .populate('pricing');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { game },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching game',
      error: err.message,
    });
  }
};

export const createGame = async (req, res) => {
  try {
    const {
      name,
      description,
      thumbnail,
      imageUrl,
      coverImage,
      backgroundImage,
      gallery = [],
      category,
      compatibleDevices = [],
      minPlayers = 1,
      maxPlayers = 4,
      localPlayersSupported,
      bookingMode = 'BOTH',
      isExclusive = false,
      pricing = null,
      advancePaymentRequired = false,
      minimumAdvancePayment = 0,
      minimumDuration = 60,
      maximumDuration = 240,
      status = 'ACTIVE',
      genre = [],
      developer = '',
      publisher = '',
      releaseDate = '',
      ageRating = '',
      platforms = ['PlayStation 5'],
      multiplayer = {},
      ratings = {},
      trailers = [],
      screenshots = [],
      externalSync = {},
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Game name is required' });
    }

    const parsedMinPlayers = parseInt(minPlayers, 10) || 1;
    let parsedMaxPlayers = parseInt(maxPlayers, 10) || 4;
    let parsedLocalPlayers = localPlayersSupported !== undefined ? parseInt(localPlayersSupported, 10) : parsedMaxPlayers;

    if (parsedMinPlayers < 1) {
      return res.status(400).json({ success: false, message: 'Minimum players must be at least 1' });
    }
    if (parsedMaxPlayers < parsedMinPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Maximum players must be greater than or equal to minimum players',
      });
    }

    const validModes = ['SHARED', 'PRIVATE_ONLY', 'BOTH'];
    const effectiveBookingMode = validModes.includes(bookingMode) ? bookingMode : 'BOTH';

    // Exclusive games cannot be configured as Select at Venue
    if (isExclusive && req.body.isVenueSelectionEligible) {
      return res.status(400).json({
        success: false,
        message: 'Exclusive games cannot be configured as Select at Venue.',
      });
    }

    // PS5 games cannot exceed 4 players
    if (Array.isArray(compatibleDevices) && compatibleDevices.length > 0) {
      const ps5Devices = await Device.find({ _id: { $in: compatibleDevices }, deviceType: 'PS5' });
      if (ps5Devices.length > 0) {
        if (parsedMaxPlayers > 4 || parsedLocalPlayers > 4) {
          return res.status(400).json({
            success: false,
            message: 'For PS5 games, maximum player capacity cannot exceed 4.',
          });
        }
      }
    }

    // Normalize images
    const finalCoverUrl = coverImage?.url || imageUrl || thumbnail || '';
    const finalCoverObj = {
      url: finalCoverUrl,
      publicId: coverImage?.publicId || '',
    };
    const finalBackgroundObj = {
      url: backgroundImage?.url || '',
      publicId: backgroundImage?.publicId || '',
    };

    const game = new Game({
      name: name.trim(),
      description: description ? description.trim() : '',
      thumbnail: finalCoverUrl,
      imageUrl: finalCoverUrl,
      coverImage: finalCoverObj,
      backgroundImage: finalBackgroundObj,
      gallery,
      category,
      compatibleDevices,
      minPlayers: parsedMinPlayers,
      maxPlayers: parsedMaxPlayers,
      localPlayersSupported: parsedLocalPlayers || parsedMaxPlayers,
      bookingMode: effectiveBookingMode,
      isExclusive: Boolean(isExclusive),
      pricing,
      advancePaymentRequired: Boolean(advancePaymentRequired || isExclusive),
      minimumAdvancePayment: parseInt(minimumAdvancePayment) || 0,
      minimumDuration: parseInt(minimumDuration) || 60,
      maximumDuration: parseInt(maximumDuration) || 240,
      status,
      genre: Array.isArray(genre) ? genre : (genre ? [genre] : []),
      developer,
      publisher,
      releaseDate,
      ageRating,
      platforms: Array.isArray(platforms) ? platforms : ['PlayStation 5'],
      multiplayer,
      ratings,
      trailers,
      screenshots,
      externalSync,
    });

    await game.save();

    // If compatible devices were specified, add this game to those devices' supportedGames list
    if (compatibleDevices.length > 0) {
      await Device.updateMany(
        { _id: { $in: compatibleDevices } },
        { $addToSet: { supportedGames: game._id } }
      );
    }

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE_GAME',
      category: 'DEVICE',
      details: {
        gameId: game._id,
        name: game.name,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        localPlayersSupported: game.localPlayersSupported,
        bookingMode: game.bookingMode,
        isExclusive: game.isExclusive,
        status: game.status,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Game '${game.name}' created successfully.`,
      data: { game },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create game',
      error: err.message,
    });
  }
};

export const updateGame = async (req, res) => {
  try {
    const {
      name,
      description,
      thumbnail,
      imageUrl,
      coverImage,
      backgroundImage,
      gallery,
      category,
      compatibleDevices,
      minPlayers,
      maxPlayers,
      localPlayersSupported,
      bookingMode,
      isExclusive,
      pricing,
      advancePaymentRequired,
      minimumAdvancePayment,
      minimumDuration,
      maximumDuration,
      status,
      genre,
      developer,
      publisher,
      releaseDate,
      ageRating,
      platforms,
      multiplayer,
      ratings,
      trailers,
      screenshots,
    } = req.body;

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    const manuallyEdited = new Set(game.externalSync?.manuallyEditedFields || []);

    if (name) {
      game.name = name.trim();
      manuallyEdited.add('name');
    }
    if (typeof description === 'string') {
      game.description = description.trim();
      manuallyEdited.add('description');
    }
    if (category) game.category = category;

    // Cover image handling
    if (coverImage && coverImage.url) {
      game.coverImage = {
        url: coverImage.url,
        publicId: coverImage.publicId || '',
      };
      game.thumbnail = coverImage.url;
      game.imageUrl = coverImage.url;
      manuallyEdited.add('coverImage');
    } else if (imageUrl) {
      game.thumbnail = imageUrl;
      game.imageUrl = imageUrl;
      game.coverImage = { url: imageUrl, publicId: '' };
      manuallyEdited.add('coverImage');
    } else if (thumbnail) {
      game.thumbnail = thumbnail;
      game.imageUrl = thumbnail;
      game.coverImage = { url: thumbnail, publicId: '' };
      manuallyEdited.add('coverImage');
    }

    // Background image handling
    if (backgroundImage) {
      game.backgroundImage = {
        url: backgroundImage.url || '',
        publicId: backgroundImage.publicId || '',
      };
      manuallyEdited.add('backgroundImage');
    }

    if (Array.isArray(gallery)) {
      game.gallery = gallery;
      manuallyEdited.add('gallery');
    }

    const newMin = minPlayers !== undefined ? parseInt(minPlayers, 10) : game.minPlayers;
    const newMax = maxPlayers !== undefined ? parseInt(maxPlayers, 10) : game.maxPlayers;

    if (minPlayers !== undefined) {
      if (isNaN(newMin) || newMin < 1) {
        return res.status(400).json({ success: false, message: 'Minimum players must be at least 1' });
      }
      game.minPlayers = newMin;
    }

    if (maxPlayers !== undefined) {
      if (isNaN(newMax) || newMax < newMin) {
        return res.status(400).json({
          success: false,
          message: 'Maximum players must be greater than or equal to minimum players',
        });
      }
      game.maxPlayers = newMax;
    }

    if (localPlayersSupported !== undefined) {
      const parsedLocal = parseInt(localPlayersSupported, 10);
      if (isNaN(parsedLocal) || parsedLocal < 1) {
        return res.status(400).json({ success: false, message: 'Local players supported must be at least 1' });
      }
      game.localPlayersSupported = Math.min(parsedLocal, 4); // Clamp to max 4 on PS5
      manuallyEdited.add('localPlayersSupported');
    }

    if (bookingMode !== undefined) {
      const validModes = ['SHARED', 'PRIVATE_ONLY', 'BOTH'];
      if (!validModes.includes(bookingMode)) {
        return res.status(400).json({ success: false, message: 'Invalid booking mode specified' });
      }
      game.bookingMode = bookingMode;
    }

    const devicesToCheck = Array.isArray(compatibleDevices) ? compatibleDevices : game.compatibleDevices;
    if (devicesToCheck && devicesToCheck.length > 0) {
      const ps5Devices = await Device.find({ _id: { $in: devicesToCheck }, deviceType: 'PS5' });
      if (ps5Devices.length > 0 && (game.maxPlayers > 4 || game.localPlayersSupported > 4)) {
        return res.status(400).json({
          success: false,
          message: 'For PS5 games, maximum player capacity cannot exceed 4.',
        });
      }
    }

    if (typeof isExclusive === 'boolean') {
      if (isExclusive && req.body.isVenueSelectionEligible) {
        return res.status(400).json({
          success: false,
          message: 'Exclusive games cannot be configured as Select at Venue.',
        });
      }
      game.isExclusive = isExclusive;
    }
    if (pricing !== undefined) game.pricing = pricing;
    if (typeof advancePaymentRequired === 'boolean') game.advancePaymentRequired = advancePaymentRequired;
    if (minimumAdvancePayment !== undefined) game.minimumAdvancePayment = parseInt(minimumAdvancePayment);
    if (minimumDuration !== undefined) game.minimumDuration = parseInt(minimumDuration);
    if (maximumDuration !== undefined) game.maximumDuration = parseInt(maximumDuration);
    if (status) game.status = status;

    if (genre !== undefined) {
      game.genre = Array.isArray(genre) ? genre : [genre];
      manuallyEdited.add('genre');
    }
    if (developer !== undefined) {
      game.developer = developer;
      manuallyEdited.add('developer');
    }
    if (publisher !== undefined) {
      game.publisher = publisher;
      manuallyEdited.add('publisher');
    }
    if (releaseDate !== undefined) {
      game.releaseDate = releaseDate;
      manuallyEdited.add('releaseDate');
    }
    if (ageRating !== undefined) {
      game.ageRating = ageRating;
      manuallyEdited.add('ageRating');
    }
    if (platforms !== undefined) {
      game.platforms = Array.isArray(platforms) ? platforms : [platforms];
      manuallyEdited.add('platforms');
    }
    if (multiplayer !== undefined) {
      game.multiplayer = { ...game.multiplayer?.toObject?.() || {}, ...multiplayer };
      manuallyEdited.add('multiplayer');
    }
    if (ratings !== undefined) {
      game.ratings = { ...game.ratings?.toObject?.() || {}, ...ratings };
      manuallyEdited.add('ratings');
    }
    if (Array.isArray(trailers)) {
      game.trailers = trailers;
      manuallyEdited.add('trailers');
    }
    if (Array.isArray(screenshots)) {
      game.screenshots = screenshots;
      manuallyEdited.add('screenshots');
    }

    if (!game.externalSync) {
      game.externalSync = {};
    }
    game.externalSync.manuallyEditedFields = Array.from(manuallyEdited);

    if (Array.isArray(compatibleDevices)) {
      // Sync device references
      const oldDevices = (game.compatibleDevices || []).map((id) => id.toString());
      const newDevices = compatibleDevices.map((id) => id.toString());

      const removed = oldDevices.filter((id) => !newDevices.includes(id));
      const added = newDevices.filter((id) => !oldDevices.includes(id));

      if (removed.length > 0) {
        await Device.updateMany({ _id: { $in: removed } }, { $pull: { supportedGames: game._id } });
      }
      if (added.length > 0) {
        await Device.updateMany({ _id: { $in: added } }, { $addToSet: { supportedGames: game._id } });
      }

      game.compatibleDevices = compatibleDevices;
    }

    await game.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_GAME',
      category: 'DEVICE',
      details: {
        gameId: game._id,
        name: game.name,
        status: game.status,
        isExclusive: game.isExclusive,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        localPlayersSupported: game.localPlayersSupported,
        bookingMode: game.bookingMode,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Game '${game.name}' updated successfully.`,
      data: { game },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update game',
      error: err.message,
    });
  }
};

export const deleteGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Remove reference from devices
    await Device.updateMany(
      { supportedGames: game._id },
      { $pull: { supportedGames: game._id } }
    );

    await Game.findByIdAndDelete(game._id);

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_GAME',
      category: 'DEVICE',
      details: { gameId: game._id, name: game.name },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Game '${game.name}' deleted successfully.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete game',
      error: err.message,
    });
  }
};

/**
 * Search external game metadata providers (RAWG, IGDB, Curated)
 */
export const searchExternalGames = async (req, res) => {
  try {
    const { q, provider } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }
    const results = await gameMetadataService.searchGames(q, provider);
    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'External game search failed',
      error: err.message,
    });
  }
};

/**
 * Get status of configured metadata providers
 */
export const getProvidersStatus = async (req, res) => {
  try {
    const status = gameMetadataService.getProvidersStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve providers status',
      error: err.message,
    });
  }
};

/**
 * Import a game from an external provider into MongoDB Game collection
 */
export const importGame = async (req, res) => {
  try {
    const { externalId, provider, overrides = {} } = req.body;
    if (!externalId) {
      return res.status(400).json({ success: false, message: 'externalId is required to import game' });
    }

    const metadata = await gameMetadataService.getGameDetails(externalId, provider);
    if (!metadata) {
      return res.status(404).json({ success: false, message: 'Game metadata could not be found' });
    }

    const gameName = (overrides.name || metadata.name || '').trim();
    if (!gameName) {
      return res.status(400).json({ success: false, message: 'Game name is missing' });
    }

    // Check for duplicate game by name or externalId
    const existing = await Game.findOne({
      $or: [
        { name: { $regex: `^${gameName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { 'externalSync.externalId': String(externalId) },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Game '${gameName}' already exists in your library.`,
        data: { gameId: existing._id },
      });
    }

    // Associate with existing PS5 stations without creating any new hardware devices
    const ps5Devices = await Device.find({ deviceType: 'PS5', status: { $ne: 'RETIRED' } });
    const compatibleDeviceIds = ps5Devices.map((d) => d._id);

    // Compute local players capacity (must be <= 4 for PS5)
    let localPlayers = Number(overrides.localPlayersSupported || metadata.localPlayersSupported || 1);
    if (isNaN(localPlayers) || localPlayers < 1) localPlayers = 1;
    if (localPlayers > 4) localPlayers = 4; // Strict PS5 couch limit

    // Find or assign default Category if not provided
    let categoryId = overrides.category || null;
    if (!categoryId) {
      const defaultCategory =
        (await GameCategory.findOne({ name: 'PlayStation 5' })) ||
        (await GameCategory.findOne({ status: 'ACTIVE' })) ||
        (await GameCategory.findOne());
      if (defaultCategory) {
        categoryId = defaultCategory._id;
      }
    }

    const coverUrl = overrides.coverUrl || metadata.coverUrl || metadata.backgroundImage || '';
    const backgroundUrl = overrides.backgroundUrl || metadata.backgroundUrl || '';

    const newGame = new Game({
      name: gameName,
      description: overrides.description || metadata.description || '',
      thumbnail: coverUrl,
      imageUrl: coverUrl,
      coverImage: {
        url: coverUrl,
        publicId: overrides.coverImagePublicId || '',
      },
      backgroundImage: {
        url: backgroundUrl,
        publicId: overrides.backgroundImagePublicId || '',
      },
      gallery: (metadata.screenshots || []).map((url) => ({ url, publicId: '', caption: '' })),
      category: categoryId,
      compatibleDevices: compatibleDeviceIds,
      minPlayers: 1,
      maxPlayers: localPlayers,
      localPlayersSupported: localPlayers,
      bookingMode: 'BOTH',
      isExclusive: false,
      advancePaymentRequired: false,
      minimumAdvancePayment: 0,
      minimumDuration: 60,
      maximumDuration: 240,
      status: 'ACTIVE',
      genre: overrides.genres || metadata.genres || [],
      developer: overrides.developer || metadata.developer || '',
      publisher: overrides.publisher || metadata.publisher || '',
      releaseDate: overrides.releaseDate || metadata.releaseDate || '',
      ageRating: overrides.ageRating || metadata.ageRating || '',
      platforms: overrides.platforms || metadata.platforms || ['PlayStation 5'],
      multiplayer: metadata.multiplayer || {
        localCoop: localPlayers > 1,
        splitScreen: false,
        offlineMultiplayer: localPlayers > 1,
        maxOfflineCoopPlayers: localPlayers,
        maxOfflineMultiplayerPlayers: localPlayers,
        onlineCoop: false,
        maxOnlinePlayers: 1,
      },
      ratings: metadata.ratings || {},
      trailers: metadata.trailers || [],
      screenshots: metadata.screenshots || [],
      externalSync: {
        provider: metadata.provider || provider || 'curated',
        externalId: String(externalId),
        externalSlug: metadata.slug || '',
        lastSyncedAt: new Date(),
        manuallyEditedFields: overrides.manuallyEditedFields || [],
      },
    });

    await newGame.save();

    // Link game to existing PS5 stations
    if (compatibleDeviceIds.length > 0) {
      await Device.updateMany(
        { _id: { $in: compatibleDeviceIds } },
        { $addToSet: { supportedGames: newGame._id } }
      );
    }

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'IMPORT_GAME',
      category: 'DEVICE',
      details: {
        gameId: newGame._id,
        name: newGame.name,
        provider: newGame.externalSync.provider,
        externalId: String(externalId),
        localPlayersSupported: newGame.localPlayersSupported,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Game '${newGame.name}' successfully imported.`,
      data: { game: newGame },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to import game',
      error: err.message,
    });
  }
};

/**
 * Refresh game metadata from its linked external provider
 */
export const refreshGameMetadata = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found' });
    }

    const externalId = game.externalSync?.externalId;
    const provider = game.externalSync?.provider;

    if (!externalId) {
      return res.status(400).json({
        success: false,
        message: 'This game has no linked external metadata provider to refresh from.',
      });
    }

    const freshDetails = await gameMetadataService.getGameDetails(externalId, provider);
    gameMetadataService.applyMetadataUpdate(game, freshDetails);

    await game.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'REFRESH_GAME_METADATA',
      category: 'DEVICE',
      details: {
        gameId: game._id,
        name: game.name,
        provider: game.externalSync.provider,
        lastSyncedAt: game.externalSync.lastSyncedAt,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Metadata for '${game.name}' refreshed successfully.`,
      data: { game },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to refresh game metadata',
      error: err.message,
    });
  }
};
