import Pricing from '../models/Pricing.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';

/**
 * Calculates session price precision-safely in paise
 * @param {Object} options
 * @param {string} options.deviceId
 * @param {string} [options.gameId]
 * @param {number} [options.durationMinutes=60]
 * @param {number} [options.playersCount=1]
 */
export async function calculateSessionPrice({
  deviceId,
  gameId = null,
  durationMinutes = 60,
  playersCount = 1,
}) {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error('Device not found for price calculation');
  }

  let game = null;
  if (gameId) {
    game = await Game.findById(gameId);
  }

  // Determine applicable pricing rule
  let pricingRule = null;

  // 1. Check game-specific pricing if game is assigned
  if (game && game.pricing) {
    pricingRule = await Pricing.findOne({ _id: game.pricing, status: 'ACTIVE' });
  }

  // 2. Check game direct match or exclusive game rule
  if (!pricingRule && game) {
    if (game.isExclusive || game.name === 'GTA 6') {
      pricingRule = await Pricing.findOne({
        $or: [{ game: game._id }, { name: /GTA 6/i }, { deviceType: 'EXCLUSIVE' }],
        status: 'ACTIVE',
      });
    } else {
      pricingRule = await Pricing.findOne({ game: game._id, status: 'ACTIVE' });
    }
  }

  // 3. Check device direct match
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ device: device._id, status: 'ACTIVE' });
  }

  // 4. Check deviceType match
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ deviceType: device.deviceType, status: 'ACTIVE' });
  }

  // 5. Fallback to general active pricing rule
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ deviceType: 'GENERAL', status: 'ACTIVE' });
  }

  if (!pricingRule) {
    // Default system fallback in paise: ₹60 per player per hour
    pricingRule = {
      name: 'Default Fallback Pricing',
      billingType: 'PER_PLAYER_HOURLY',
      amount: 6000, // 6000 paise = ₹60
      currency: 'INR',
    };
  }

  const hours = Math.max(1, durationMinutes / 60);
  const players = Math.max(1, playersCount);
  let totalAmountPaise = 0;

  switch (pricingRule.billingType) {
    case 'PER_PLAYER_HOURLY':
      totalAmountPaise = Math.round(pricingRule.amount * hours * players);
      break;
    case 'PER_DEVICE_HOURLY':
      totalAmountPaise = Math.round(pricingRule.amount * hours);
      break;
    case 'FIXED_SESSION':
      totalAmountPaise = Math.round(pricingRule.amount);
      break;
    default:
      totalAmountPaise = Math.round(pricingRule.amount * hours * players);
  }

  // Determine advance payment required (Configurable per game / exclusive title)
  let advanceRequired = false;
  let minimumAdvancePaise = 0;

  if (game && (game.isExclusive || game.advancePaymentRequired)) {
    advanceRequired = true;
    if (game.minimumAdvancePayment && game.minimumAdvancePayment > 0) {
      minimumAdvancePaise = Math.min(game.minimumAdvancePayment, totalAmountPaise);
    } else {
      minimumAdvancePaise = Math.round(totalAmountPaise * 0.5); // 50% default advance
    }
  }

  return {
    pricingRule: {
      id: pricingRule._id,
      name: pricingRule.name,
      billingType: pricingRule.billingType,
      ratePerUnitPaise: pricingRule.amount,
      ratePerUnitRupees: pricingRule.amount / 100,
    },
    durationMinutes,
    durationHours: hours,
    playersCount: players,
    totalAmountPaise,
    totalAmountRupees: totalAmountPaise / 100,
    advanceRequired,
    minimumAdvancePaise,
    minimumAdvanceRupees: minimumAdvancePaise / 100,
    currency: pricingRule.currency || 'INR',
  };
}
