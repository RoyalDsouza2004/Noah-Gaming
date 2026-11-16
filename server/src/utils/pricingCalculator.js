import Pricing from '../models/Pricing.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';

/**
 * Calculates session price precision-safely in paise
 * @param {Object} options
 * @param {string} options.deviceId
 * @param {string} [options.gameId]
 * @param {boolean} [options.isVenueSelection=false]
 * @param {number} [options.durationMinutes=60]
 * @param {number} [options.playersCount=1]
 */
export async function calculateSessionPrice({
  deviceId,
  gameId = null,
  isVenueSelection = false,
  durationMinutes = 60,
  playersCount = 1,
}) {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error('Device not found for price calculation');
  }

  // Validate Select at Venue restrictions
  if (isVenueSelection && device.deviceType !== 'PS5') {
    throw new Error('Select at Venue is only available for PlayStation 5 consoles.');
  }

  let game = null;
  if (gameId) {
    game = await Game.findById(gameId);
  }

  if (isVenueSelection && game && (game.isExclusive || game.name === 'GTA 6')) {
    throw new Error('Exclusive games cannot be configured as Select at Venue.');
  }

  // If Select at Venue, ignore specific game reference for pricing
  const effectiveGame = isVenueSelection ? null : game;

  // Determine game booking classification
  let gameClassification = 'NON_EXCLUSIVE';
  if (device.deviceType === 'POOL') {
    gameClassification = 'NONE';
  } else if (game && (game.isExclusive || game.name === 'GTA 6')) {
    gameClassification = 'EXCLUSIVE';
  } else {
    gameClassification = 'NON_EXCLUSIVE';
  }

  // Determine applicable pricing rule
  let pricingRule = null;

  // 1. If not venue selection and game has specific pricing, check it
  if (!isVenueSelection && game && game.pricing) {
    pricingRule = await Pricing.findOne({ _id: game.pricing, status: 'ACTIVE' });
  }

  // 2. If exclusive game, find exclusive pricing rule
  if (!pricingRule && !isVenueSelection && game && (game.isExclusive || game.name === 'GTA 6')) {
    pricingRule = await Pricing.findOne({
      $or: [{ game: game._id }, { name: /GTA 6/i }, { deviceType: 'EXCLUSIVE' }],
      status: 'ACTIVE',
    });
  }

  // 3. For non-exclusive games or Select at Venue on PS5, use the normal PS5 pricing rule
  if (!pricingRule && device.deviceType === 'PS5') {
    pricingRule = await Pricing.findOne({ deviceType: 'PS5', status: 'ACTIVE' });
  }

  // 4. Check device direct match
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ device: device._id, status: 'ACTIVE' });
  }

  // 5. Check deviceType match
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ deviceType: device.deviceType, status: 'ACTIVE' });
  }

  // 6. Fallback to general active pricing rule
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ deviceType: 'GENERAL', status: 'ACTIVE' });
  }

  if (!pricingRule) {
    // Default system fallback in paise: ₹70 per player per hour for PS5, ₹150 for POOL
    const isPool = device.deviceType === 'POOL';
    pricingRule = {
      name: 'Default Fallback Pricing',
      billingType: isPool ? 'PER_DEVICE_HOURLY' : 'PER_PLAYER_HOURLY',
      amount: isPool ? 15000 : 7000, // 15000 paise = ₹150, 7000 paise = ₹70
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
    gameClassification,
    isVenueSelection: Boolean(isVenueSelection),
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
