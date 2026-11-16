import Pricing from '../models/Pricing.js';
import ActivityLog from '../models/ActivityLog.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';

export const getAllPricing = async (req, res) => {
  try {
    const { deviceType, billingType, status } = req.query;
    const filter = {};

    if (deviceType) filter.deviceType = deviceType;
    if (billingType) filter.billingType = billingType;
    if (status) filter.status = status;

    const pricingPlans = await Pricing.find(filter)
      .populate('device', 'name deviceCode deviceType')
      .populate('game', 'name category isExclusive')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { pricingPlans, total: pricingPlans.length },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pricing plans',
      error: err.message,
    });
  }
};

export const getPricingById = async (req, res) => {
  try {
    const pricing = await Pricing.findById(req.params.id)
      .populate('device', 'name deviceCode deviceType')
      .populate('game', 'name category isExclusive');

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: 'Pricing rule not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { pricing },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing rule',
      error: err.message,
    });
  }
};

export const createPricing = async (req, res) => {
  try {
    const {
      name,
      deviceType = 'GENERAL',
      device = null,
      game = null,
      billingType = 'PER_PLAYER_HOURLY',
      amount, // can be passed in rupees (amountInRupees) or paise
      amountInRupees,
      currency = 'INR',
      minimumDuration = 60,
      maximumDuration = 240,
      status = 'ACTIVE',
    } = req.body;

    // Convert to precision-safe paise
    let amountInPaise = 0;
    if (amountInRupees !== undefined) {
      amountInPaise = Math.round(parseFloat(amountInRupees) * 100);
    } else if (amount !== undefined) {
      amountInPaise = parseInt(amount);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Amount is required (provide amount in paise or amountInRupees).',
      });
    }

    const pricing = new Pricing({
      name: name.trim(),
      deviceType,
      device: device || null,
      game: game || null,
      billingType,
      amount: amountInPaise,
      currency,
      minimumDuration: parseInt(minimumDuration) || 60,
      maximumDuration: parseInt(maximumDuration) || 240,
      status,
    });

    await pricing.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE_PRICING',
      category: 'SYSTEM',
      details: { pricingId: pricing._id, name: pricing.name, amountInPaise, billingType },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Pricing rule '${pricing.name}' created successfully.`,
      data: { pricing },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create pricing rule',
      error: err.message,
    });
  }
};

export const updatePricing = async (req, res) => {
  try {
    const {
      name,
      deviceType,
      device,
      game,
      billingType,
      amount,
      amountInRupees,
      currency,
      minimumDuration,
      maximumDuration,
      status,
    } = req.body;

    const pricing = await Pricing.findById(req.params.id);
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: 'Pricing rule not found',
      });
    }

    if (name) pricing.name = name.trim();
    if (deviceType) pricing.deviceType = deviceType;
    if (device !== undefined) pricing.device = device || null;
    if (game !== undefined) pricing.game = game || null;
    if (billingType) pricing.billingType = billingType;

    if (amountInRupees !== undefined) {
      pricing.amount = Math.round(parseFloat(amountInRupees) * 100);
    } else if (amount !== undefined) {
      pricing.amount = parseInt(amount);
    }

    if (currency) pricing.currency = currency;
    if (minimumDuration !== undefined) pricing.minimumDuration = parseInt(minimumDuration);
    if (maximumDuration !== undefined) pricing.maximumDuration = parseInt(maximumDuration);
    if (status) pricing.status = status;

    await pricing.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_PRICING',
      category: 'SYSTEM',
      details: { pricingId: pricing._id, name: pricing.name, amountPaise: pricing.amount },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Pricing rule '${pricing.name}' updated successfully.`,
      data: { pricing },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update pricing rule',
      error: err.message,
    });
  }
};

export const deletePricing = async (req, res) => {
  try {
    const pricing = await Pricing.findById(req.params.id);
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: 'Pricing rule not found',
      });
    }

    await Pricing.findByIdAndDelete(pricing._id);

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_PRICING',
      category: 'SYSTEM',
      details: { pricingId: pricing._id, name: pricing.name },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Pricing rule '${pricing.name}' deleted successfully.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete pricing rule',
      error: err.message,
    });
  }
};

// Calculate price endpoint for booking simulations
export const calculatePrice = async (req, res) => {
  try {
    const {
      deviceId,
      gameId,
      isVenueSelection = false,
      durationMinutes = 60,
      playersCount = 1,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required for price calculation',
      });
    }

    const breakdown = await calculateSessionPrice({
      deviceId,
      gameId: isVenueSelection ? null : gameId,
      isVenueSelection: Boolean(isVenueSelection),
      durationMinutes: parseInt(durationMinutes),
      playersCount: parseInt(playersCount),
    });

    res.status(200).json({
      success: true,
      data: breakdown,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Price calculation error',
      error: err.message,
    });
  }
};
