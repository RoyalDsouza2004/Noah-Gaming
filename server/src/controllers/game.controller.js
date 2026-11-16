import Game from '../models/Game.js';
import Device from '../models/Device.js';
import ActivityLog from '../models/ActivityLog.js';

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
      category,
      compatibleDevices = [],
      minPlayers = 1,
      maxPlayers = 4,
      bookingMode = 'BOTH',
      isExclusive = false,
      pricing = null,
      advancePaymentRequired = false,
      minimumAdvancePayment = 0,
      minimumDuration = 60,
      maximumDuration = 240,
      status = 'ACTIVE',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Game name is required' });
    }

    const parsedMinPlayers = parseInt(minPlayers, 10) || 1;
    const parsedMaxPlayers = parseInt(maxPlayers, 10) || 4;

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

    // PS5 games cannot exceed 4 players
    if (Array.isArray(compatibleDevices) && compatibleDevices.length > 0) {
      const ps5Devices = await Device.find({ _id: { $in: compatibleDevices }, deviceType: 'PS5' });
      if (ps5Devices.length > 0 && parsedMaxPlayers > 4) {
        return res.status(400).json({
          success: false,
          message: 'For PS5 games, maximum player capacity cannot exceed 4.',
        });
      }
    }

    const game = new Game({
      name: name.trim(),
      description: description ? description.trim() : '',
      thumbnail: thumbnail ? thumbnail.trim() : '',
      category,
      compatibleDevices,
      minPlayers: parsedMinPlayers,
      maxPlayers: parsedMaxPlayers,
      bookingMode: effectiveBookingMode,
      isExclusive: Boolean(isExclusive),
      pricing,
      advancePaymentRequired: Boolean(advancePaymentRequired || isExclusive),
      minimumAdvancePayment: parseInt(minimumAdvancePayment) || 0,
      minimumDuration: parseInt(minimumDuration) || 60,
      maximumDuration: parseInt(maximumDuration) || 240,
      status,
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
        bookingMode: game.bookingMode,
        isExclusive: game.isExclusive,
        status: game.status,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Game '${game.name}' registered successfully.`,
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
      category,
      compatibleDevices,
      minPlayers,
      maxPlayers,
      bookingMode,
      isExclusive,
      pricing,
      advancePaymentRequired,
      minimumAdvancePayment,
      minimumDuration,
      maximumDuration,
      status,
    } = req.body;

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    if (name) game.name = name.trim();
    if (typeof description === 'string') game.description = description.trim();
    if (typeof thumbnail === 'string') game.thumbnail = thumbnail.trim();
    if (category) game.category = category;

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
      if (ps5Devices.length > 0 && game.maxPlayers > 4) {
        return res.status(400).json({
          success: false,
          message: 'For PS5 games, maximum player capacity cannot exceed 4.',
        });
      }
    }

    if (typeof isExclusive === 'boolean') game.isExclusive = isExclusive;
    if (pricing !== undefined) game.pricing = pricing;
    if (typeof advancePaymentRequired === 'boolean') game.advancePaymentRequired = advancePaymentRequired;
    if (minimumAdvancePayment !== undefined) game.minimumAdvancePayment = parseInt(minimumAdvancePayment);
    if (minimumDuration !== undefined) game.minimumDuration = parseInt(minimumDuration);
    if (maximumDuration !== undefined) game.maximumDuration = parseInt(maximumDuration);
    if (status) game.status = status;

    if (Array.isArray(compatibleDevices)) {
      // Sync device references
      const oldDevices = game.compatibleDevices.map((id) => id.toString());
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
