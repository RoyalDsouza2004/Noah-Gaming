import Pricing from '../models/Pricing.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';

/**
 * Calculates session price precision-safely in paise.
 * When customerId and bookingDate are provided, also calculates membership benefit.
 *
 * @param {Object} options
 * @param {string} options.deviceId
 * @param {string} [options.gameId]
 * @param {boolean} [options.isVenueSelection=false]
 * @param {number} [options.durationMinutes=60]
 * @param {number} [options.playersCount=1]
 * @param {string} [options.customerId]      - optional, for membership-aware pricing
 * @param {string} [options.bookingDate]     - YYYY-MM-DD IST, for membership check
 * @param {string} [options.startTime]       - HH:mm, for membership check
 * @param {string} [options.bookingType]     - 'SHARED' | 'PRIVATE'
 */
export async function calculateSessionPrice({
  deviceId,
  gameId = null,
  isVenueSelection = false,
  pricingCategory = null,
  gameClassification: customClassification = null,
  durationMinutes = 60,
  playersCount = 1,
  customerId = null,
  bookingDate = null,
  startTime = null,
  bookingType = 'SHARED',
  applyMembershipBenefit = true,
}) {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error('Device not found for price calculation');
  }

  // Venue game selection only applies to PlayStation 5 consoles; ignore for Pool Table
  const effectiveVenueSelection = device.deviceType === 'PS5' ? Boolean(isVenueSelection) : false;

  let game = null;
  if (gameId) {
    game = await Game.findById(gameId);
  }

  // Determine game booking classification
  let gameClassification = customClassification || pricingCategory || 'NON_EXCLUSIVE';
  if (device.deviceType === 'POOL') {
    gameClassification = 'NONE';
  } else if (game && (game.isExclusive || game.name === 'GTA 6')) {
    gameClassification = 'EXCLUSIVE';
  } else if (pricingCategory === 'EXCLUSIVE' || customClassification === 'EXCLUSIVE') {
    gameClassification = 'EXCLUSIVE';
  } else {
    gameClassification = 'NON_EXCLUSIVE';
  }

  // Determine applicable pricing rule
  let pricingRule = null;

  // 1. If not venue selection and game has specific pricing, check it
  if (!effectiveVenueSelection && game && game.pricing) {
    pricingRule = await Pricing.findOne({ _id: game.pricing, status: 'ACTIVE' });
  }

  // 2. If exclusive (either game-based or pricing category selected)
  if (!pricingRule && gameClassification === 'EXCLUSIVE') {
    pricingRule = await Pricing.findOne({
      $or: [
        { deviceType: 'EXCLUSIVE' },
        { name: /Exclusive/i },
        { name: /GTA 6/i },
      ],
      status: 'ACTIVE',
    });

    if (!pricingRule) {
      pricingRule = {
        name: 'PS5 Exclusive Hourly Rate',
        deviceType: 'EXCLUSIVE',
        billingType: 'PER_PLAYER_HOURLY',
        amount: 15000, // ₹150 per player per hour in paise
        currency: 'INR',
      };
    }
  }

  // 3. For non-exclusive games or Select at Venue on PS5, use the standard PS5 pricing rule (not game-specific/exclusive)
  if (!pricingRule && device.deviceType === 'PS5') {
    pricingRule = await Pricing.findOne({
      deviceType: 'PS5',
      game: null,
      billingType: 'PER_PLAYER_HOURLY',
      status: 'ACTIVE',
    }) || await Pricing.findOne({ deviceType: 'PS5', game: null, status: 'ACTIVE' });

    if (!pricingRule) {
      pricingRule = {
        name: 'PS5 Standard Hourly Rate',
        deviceType: 'PS5',
        billingType: 'PER_PLAYER_HOURLY',
        amount: 7000, // ₹70 per player per hour in paise
        currency: 'INR',
      };
    }
  }

  // 4. For Pool Table
  if (!pricingRule && device.deviceType === 'POOL') {
    pricingRule = await Pricing.findOne({ deviceType: 'POOL', status: 'ACTIVE' });
  }

  // 5. Check device direct match
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ device: device._id, game: null, status: 'ACTIVE' });
  }

  // 6. Check deviceType standard match (excluding game-specific rules)
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ deviceType: device.deviceType, game: null, status: 'ACTIVE' });
  }

  // 7. Check general deviceType active pricing rule
  if (!pricingRule) {
    pricingRule = await Pricing.findOne({ deviceType: device.deviceType, status: 'ACTIVE' });
  }

  // 8. Fallback to general active pricing rule
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

  const hours = Math.max(0.25, durationMinutes / 60);
  const players = Math.max(1, playersCount);
  let totalAmountPaise = 0;

  // On PS5 consoles, all gaming sessions (Exclusive and Non-Exclusive) calculate per player per hour
  const effectiveBillingType = device.deviceType === 'PS5' ? 'PER_PLAYER_HOURLY' : pricingRule.billingType;

  switch (effectiveBillingType) {
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

  const standardAmountPaise = totalAmountPaise; // Store original before membership discount

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

  // ===== MEMBERSHIP-AWARE PRICING =====
  let membershipApplied = false;
  let membershipDiscountPaise = 0;
  let freeHoursApplied = 0;
  let membershipCoverage = null;
  let payableAmountPaise = totalAmountPaise;

  if (customerId && bookingDate && !game?.isExclusive && applyMembershipBenefit) {
    try {
      // Dynamic import to avoid circular dependency
      const { checkMembershipBookingCoverage } = await import('../services/membership.service.js');

      membershipCoverage = await checkMembershipBookingCoverage({
        customerId,
        deviceId: device._id,
        gameId: effectiveVenueSelection ? null : (game ? game._id : null),
        bookingDate,
        startTime,
        durationHours: hours,
        numberOfPlayers: players,
        bookingType,
      });

      if (membershipCoverage && membershipCoverage.covered) {
        const discountPct = membershipCoverage.plan.discountPercentage || 100;
        const isPerPlayer = pricingRule.billingType === 'PER_PLAYER_HOURLY';

        if (membershipCoverage.freeHourAvailable) {
          // Apply free hours: plan dailyUsageLimit defines free minutes
          const freeLimitMins = membershipCoverage.freeMinutesAvailable !== undefined
            ? membershipCoverage.freeMinutesAvailable
            : (membershipCoverage.plan.dailyUsageLimit || 60);
          freeHoursApplied = Math.min(hours, freeLimitMins / 60);

          // BUSINESS RULE: Free-hour entitlement applies to ONE eligible player only (1 player), NOT all players!
          if (isPerPlayer) {
            // Free hour benefit strictly applies to the single membership holder (1 player)
            membershipDiscountPaise = Math.round(pricingRule.amount * freeHoursApplied * 1);
          } else {
            // PER_DEVICE_HOURLY (e.g. Pool Table) or FIXED_SESSION applies to station
            membershipDiscountPaise = Math.round(pricingRule.amount * freeHoursApplied);
          }

          // Apply percentage discount on top of free hour discount if plan provides partial coverage (discountPct < 100)
          // Any additional percentage discount only applies to the member's remaining portion
          if (discountPct < 100 && discountPct > 0) {
            const memberBaseSharePaise = isPerPlayer ? Math.round(pricingRule.amount * hours) : totalAmountPaise;
            const remainingMemberPaise = Math.max(0, memberBaseSharePaise - membershipDiscountPaise);
            membershipDiscountPaise += Math.round(remainingMemberPaise * (discountPct / 100));
          }

          payableAmountPaise = Math.max(0, totalAmountPaise - membershipDiscountPaise);
          membershipApplied = membershipDiscountPaise > 0;
        } else {
          // No free hours but percentage discount may still apply to the member's share
          if (discountPct > 0) {
            const memberBaseSharePaise = isPerPlayer ? Math.round(pricingRule.amount * hours) : totalAmountPaise;
            membershipDiscountPaise = Math.round(memberBaseSharePaise * (discountPct / 100));
            payableAmountPaise = Math.max(0, totalAmountPaise - membershipDiscountPaise);
            membershipApplied = discountPct > 0;
          }
        }

        // If fully covered, advance payment is not needed
        if (payableAmountPaise === 0) {
          advanceRequired = false;
          minimumAdvancePaise = 0;
        } else if (advanceRequired) {
          minimumAdvancePaise = Math.min(minimumAdvancePaise, payableAmountPaise);
        }
      }
    } catch (membershipErr) {
      // Non-fatal: if membership check fails, fall back to standard pricing
      console.warn('[Membership Pricing Check Error]:', membershipErr.message);
    }
  }

  const isPerPlayerPricing = pricingRule.billingType === 'PER_PLAYER_HOURLY';
  const memberCostPaise = isPerPlayerPricing
    ? Math.max(0, Math.round(pricingRule.amount * hours) - membershipDiscountPaise)
    : payableAmountPaise;
  const additionalPlayersCostPaise = isPerPlayerPricing
    ? Math.round(pricingRule.amount * hours * Math.max(0, players - 1))
    : 0;

  return {
    pricingRule: {
      id: pricingRule._id,
      name: pricingRule.name,
      billingType: pricingRule.billingType,
      ratePerUnitPaise: pricingRule.amount,
      ratePerUnitRupees: pricingRule.amount / 100,
    },
    gameClassification,
    isVenueSelection: effectiveVenueSelection,
    durationMinutes,
    durationHours: hours,
    playersCount: players,
    // Standard (before membership)
    standardAmountPaise,
    standardAmountRupees: standardAmountPaise / 100,
    // Payable (after membership discount)
    totalAmountPaise: payableAmountPaise,
    totalAmountRupees: payableAmountPaise / 100,
    payableAmountPaise,
    payableAmountRupees: payableAmountPaise / 100,
    // Per-player entitlement breakdown
    memberBreakdown: {
      eligiblePlayerCount: 1,
      additionalPlayersCount: Math.max(0, players - 1),
      memberAmountRupees: memberCostPaise / 100,
      additionalPlayersAmountRupees: additionalPlayersCostPaise / 100,
      perPlayerRateRupees: pricingRule.amount / 100,
      freeHoursApplied,
      discountRupees: membershipDiscountPaise / 100,
      breakdownMessage: isPerPlayerPricing && players > 1 && membershipApplied
        ? `Member (1 player): ₹${(memberCostPaise / 100).toFixed(0)} (${freeHoursApplied}h free) + ${players - 1} extra player(s): ₹${(additionalPlayersCostPaise / 100).toFixed(0)}`
        : null,
    },
    // Membership breakdown
    membershipBenefit: {
      applied: membershipApplied,
      planName: membershipCoverage?.plan?.name || null,
      advanceBookingLimit: membershipCoverage?.plan?.advanceBookingLimit || null,
      freeHoursApplied,
      freeMinutesApplied: Math.round(freeHoursApplied * 60),
      paidMinutes: Math.max(0, durationMinutes - Math.round(freeHoursApplied * 60)),
      discountPaise: membershipDiscountPaise,
      discountRupees: membershipDiscountPaise / 100,
      coveredPlayerCount: 1,
      chargeablePlayerCount: Math.max(0, players - 1),
      isFullyCovered: payableAmountPaise === 0 && membershipApplied,
      hasMembership: Boolean(membershipCoverage?.plan),
      freeHourAvailable: membershipCoverage?.freeHourAvailable ?? null,
      entitlementState: membershipCoverage?.entitlementState ?? null,
      reason: membershipCoverage?.reason || null,
    },
    advanceRequired,
    minimumAdvancePaise,
    minimumAdvanceRupees: minimumAdvancePaise / 100,
    currency: pricingRule.currency || 'INR',
  };
}
