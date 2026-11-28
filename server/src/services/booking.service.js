import Booking from '../models/Booking.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import User from '../models/User.js';
import DeviceMaintenance from '../models/DeviceMaintenance.js';
import ActivityLog from '../models/ActivityLog.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';
import {
  checkMembershipBookingCoverage,
  recordMembershipUsage,
  releaseMembershipUsage,
  validateCustomerAdvanceBooking,
  reserveDailyFreeHour,
  consumeDailyFreeHour,
  releaseDailyFreeHour,
} from './membership.service.js';
import { createNotification } from './notification.service.js';
import {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
} from './email.service.js';
import {
  parseISTDateTime,
  formatISTDate,
  formatISTTime,
  generateDailySlots,
  generateBookingId,
  getOperatingHours,
} from '../utils/timeSlots.js';
import * as scheduleService from './schedule.service.js';

/**
 * Determines if a game is configured for multiplayer gameplay.
 * Multiplayer games must use shared-seat booking and cannot be reserved as private sessions.
 */
export function isMultiplayerGame(game) {
  if (!game) return false;
  if (game.isExclusive) return false; // Exclusive titles like GTA 6 have dedicated private station lock
  if (game.bookingMode === 'PRIVATE_ONLY') return false;
  if (game.bookingMode === 'SHARED') return true;

  // Single player check: if maximum supported players is 1, it is strictly single player
  const maxP = game.maxPlayers || 1;
  const localP = game.localPlayersSupported || 1;
  if (maxP <= 1 && localP <= 1) {
    return false;
  }

  // If game supports multiple local/couch or shared players
  if (maxP > 1 || localP > 1) {
    return true;
  }

  if (game.multiplayer) {
    if (game.multiplayer.localCoop || game.multiplayer.splitScreen) return true;
    if (game.multiplayer.maxOfflineMultiplayerPlayers && game.multiplayer.maxOfflineMultiplayerPlayers > 1) return true;
    if (game.multiplayer.maxOnlinePlayers && game.multiplayer.maxOnlinePlayers > 1) return true;
  }

  return false;
}

/**
 * Checks real-time availability for a specific device and time interval
 * @param {string} deviceId
 * @param {Date} startAt
 * @param {Date} endAt
 * @param {string|Object} [gameId=null]
 */
export async function checkSlotAvailability(deviceId, startAt, endAt, gameId = null) {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error('Device not found');
  }

  let game = null;
  if (gameId) {
    if (typeof gameId === 'object' && gameId !== null && gameId._id) {
      game = gameId;
    } else {
      game = await Game.findById(gameId);
    }
  }

  const effectiveMax = game ? Math.min(device.capacity, game.maxPlayers || device.capacity) : device.capacity;
  const effectiveMin = game ? (game.minPlayers || 1) : 1;
  const bookingMode = game ? (game.bookingMode || 'BOTH') : 'BOTH';

  // 1. Device status check
  if (device.status === 'MAINTENANCE') {
    return {
      status: 'MAINTENANCE',
      capacity: effectiveMax,
      deviceCapacity: device.capacity,
      occupiedPlayers: device.capacity,
      remainingPlayers: 0,
      hasPrivateBooking: false,
      sharedBookingsCount: 0,
      canBookShared: false,
      canBookPrivate: false,
      reason: 'Device is currently scheduled under maintenance.',
      playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
        slotNumber: i + 1,
        status: 'MAINTENANCE',
      })),
    };
  }

  if (device.status === 'INACTIVE') {
    return {
      status: 'UNAVAILABLE',
      capacity: effectiveMax,
      deviceCapacity: device.capacity,
      occupiedPlayers: device.capacity,
      remainingPlayers: 0,
      hasPrivateBooking: false,
      sharedBookingsCount: 0,
      canBookShared: false,
      canBookPrivate: false,
      reason: 'Device is currently inactive.',
      playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
        slotNumber: i + 1,
        status: 'UNAVAILABLE',
      })),
    };
  }

  // 2. Overlapping Maintenance Tickets check
  const activeMaintenance = await DeviceMaintenance.findOne({
    device: device._id,
    status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
    startDate: { $lte: endAt },
    $or: [{ expectedEndDate: { $gte: startAt } }, { expectedEndDate: null }],
  });

  if (activeMaintenance) {
    return {
      status: 'MAINTENANCE',
      capacity: effectiveMax,
      deviceCapacity: device.capacity,
      occupiedPlayers: device.capacity,
      remainingPlayers: 0,
      hasPrivateBooking: false,
      sharedBookingsCount: 0,
      canBookShared: false,
      canBookPrivate: false,
      reason: `Maintenance: ${activeMaintenance.reason}`,
      playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
        slotNumber: i + 1,
        status: 'MAINTENANCE',
      })),
    };
  }

  // 3. Overlapping Bookings check
  // Any booking where startAt < slotEnd && endAt > slotStart
  const overlappingBookings = await Booking.find({
    device: device._id,
    bookingStatus: { $in: ['CONFIRMED', 'PENDING'] },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  }).populate('customer', 'name phone').populate('game');

  // Check if any overlapping booking is PRIVATE
  const privateBooking = overlappingBookings.find((b) => b.bookingType === 'PRIVATE');
  if (privateBooking) {
    return {
      status: 'FULL',
      capacity: effectiveMax,
      deviceCapacity: device.capacity,
      occupiedPlayers: device.capacity,
      remainingPlayers: 0,
      hasPrivateBooking: true,
      privateBookingDetails: {
        bookingId: privateBooking.bookingId,
        customerName: privateBooking.customer?.name,
      },
      sharedBookingsCount: 0,
      canBookShared: false,
      canBookPrivate: false,
      reason: 'Private session reserved for entire station.',
      playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
        slotNumber: i + 1,
        status: 'BOOKED',
        bookingType: 'PRIVATE',
      })),
    };
  }

  const isMultiplayer = isMultiplayerGame(game);

  // Check shared session compatibility for overlapping bookings
  if (overlappingBookings.length > 0) {
    // 1. Time interval matching: All customers sharing the session must match the complete time interval
    const hasMismatchedTime = overlappingBookings.some(
      (b) => b.startAt.getTime() !== startAt.getTime() || b.endAt.getTime() !== endAt.getTime()
    );
    if (hasMismatchedTime) {
      return {
        status: 'FULL',
        capacity: effectiveMax,
        deviceCapacity: device.capacity,
        occupiedPlayers: device.capacity,
        remainingPlayers: 0,
        hasPrivateBooking: false,
        sharedBookingsCount: overlappingBookings.length,
        canBookShared: false,
        canBookPrivate: false,
        reason: 'Station is occupied by a session with a non-matching time interval.',
        playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
          slotNumber: i + 1,
          status: 'BOOKED',
          bookingType: 'SHARED',
        })),
      };
    }

    // 2. Game compatibility: All customers sharing the session must play the same game
    const firstWithGame = overlappingBookings.find((b) => b.game || b.isVenueSelection);
    if (firstWithGame) {
      const sessionGameId = firstWithGame.game ? (firstWithGame.game._id || firstWithGame.game).toString() : null;
      const requestedGameId = game ? (game._id || game).toString() : null;
      const isMismatchedGame = sessionGameId
        ? (!requestedGameId || requestedGameId !== sessionGameId)
        : (game !== null);

      if (isMismatchedGame) {
        const activeTitle = firstWithGame.game?.name || (firstWithGame.isVenueSelection ? 'Select at Venue' : 'Active Session');
        return {
          status: 'FULL',
          capacity: effectiveMax,
          deviceCapacity: device.capacity,
          occupiedPlayers: device.capacity,
          remainingPlayers: 0,
          hasPrivateBooking: false,
          sharedBookingsCount: overlappingBookings.length,
          canBookShared: false,
          canBookPrivate: false,
          reason: `Station is currently running '${activeTitle}'. Shared players must join the same title.`,
          playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
            slotNumber: i + 1,
            status: 'BOOKED',
            bookingType: 'SHARED',
          })),
        };
      }
    }
  }

  // Calculate shared player occupancy
  let occupiedPlayers = 0;
  const bookedSlots = [];

  for (const booking of overlappingBookings) {
    occupiedPlayers += booking.numberOfPlayers;
    for (let p = 0; p < booking.numberOfPlayers; p++) {
      bookedSlots.push({
        slotNumber: bookedSlots.length + 1,
        status: 'BOOKED',
        bookingId: booking.bookingId,
        bookingType: 'SHARED',
        playerName: booking.customer?.name || `Player ${bookedSlots.length + 1}`,
      });
    }
  }

  const remainingPlayers = Math.max(0, effectiveMax - occupiedPlayers);

  // Fill remaining slots up to device capacity
  const playerSlots = [...bookedSlots];
  for (let s = bookedSlots.length + 1; s <= device.capacity; s++) {
    playerSlots.push({
      slotNumber: s,
      status: s <= effectiveMax ? 'AVAILABLE' : 'RESTRICTED',
      bookingId: null,
      bookingType: null,
      playerName: null,
    });
  }

  let status = 'AVAILABLE';
  if (remainingPlayers === 0 || occupiedPlayers >= effectiveMax) {
    status = 'FULL';
  } else if (occupiedPlayers > 0) {
    status = 'PARTIALLY_BOOKED';
  }

  // Multiplayer games MUST use shared-seat booking: canBookPrivate is strictly FALSE for multiplayer games
  const canBookShared = bookingMode !== 'PRIVATE_ONLY' && remainingPlayers >= effectiveMin;
  const canBookPrivate = !isMultiplayer && bookingMode !== 'SHARED' && occupiedPlayers === 0;

  return {
    status,
    capacity: effectiveMax,
    deviceCapacity: device.capacity,
    occupiedPlayers,
    remainingPlayers,
    hasPrivateBooking: false,
    sharedBookingsCount: overlappingBookings.length,
    canBookShared,
    canBookPrivate,
    playerSlots,
  };
}

/**
 * Generates slot-by-slot live availability for a device on a specified date
 * @param {string} deviceId
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} [durationHours=1]
 * @param {string|Object} [gameId=null]
 */
export async function getDeviceDailyAvailability(deviceId, dateStr, durationHours = 1, gameId = null) {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error('Device not found');
  }

  const effectiveSchedule = await scheduleService.getEffectiveDaySchedule(dateStr);
  if (effectiveSchedule.isClosed) {
    return {
      device: {
        id: device._id,
        name: device.name,
        deviceCode: device.deviceCode,
        deviceType: device.deviceType,
        capacity: device.capacity,
        status: device.status,
      },
      date: dateStr,
      durationHours,
      isClosed: true,
      closureReason: effectiveSchedule.reason || 'Lounge is closed on this date.',
      scheduleType: effectiveSchedule.scheduleType,
      slots: [],
    };
  }

  const rawSlots = await generateDailySlots(dateStr, durationHours, effectiveSchedule);
  const slotsWithAvailability = [];

  for (const slot of rawSlots) {
    if (slot.isPast) {
      slotsWithAvailability.push({
        ...slot,
        status: 'UNAVAILABLE',
        available: false,
        capacity: device.capacity,
        occupiedPlayers: device.capacity,
        remainingPlayers: 0,
        canBookShared: false,
        canBookPrivate: false,
        reason: 'Time slot is in the past.',
        playerSlots: Array.from({ length: device.capacity }, (_, i) => ({
          slotNumber: i + 1,
          status: 'UNAVAILABLE',
        })),
      });
      continue;
    }

    const avail = await checkSlotAvailability(device._id, slot.startAt, slot.endAt, gameId);
    const isSlotAvailable = Boolean(
      (avail.status === 'AVAILABLE' || avail.status === 'PARTIALLY_BOOKED') &&
      avail.remainingPlayers > 0 &&
      (avail.canBookShared || avail.canBookPrivate)
    );

    slotsWithAvailability.push({
      ...slot,
      ...avail,
      available: isSlotAvailable,
    });
  }

  return {
    device: {
      id: device._id,
      name: device.name,
      deviceCode: device.deviceCode,
      deviceType: device.deviceType,
      capacity: device.capacity,
      status: device.status,
    },
    date: dateStr,
    durationHours,
    slots: slotsWithAvailability,
  };
}

const slotLocks = new Map();

async function withSlotLock(key, fn) {
  while (slotLocks.has(key)) {
    try {
      await slotLocks.get(key);
    } catch (e) {
      // Ignore previous lock error
    }
  }
  let resolver;
  const lockPromise = new Promise((resolve) => {
    resolver = resolve;
  });
  slotLocks.set(key, lockPromise);
  try {
    return await fn();
  } finally {
    slotLocks.delete(key);
    resolver();
  }
}

/**
 * Concurrency-safe atomic booking creation with comprehensive validation
 */
export async function createBookingAtomic({
  customerId,
  deviceId,
  gameId = null,
  pricingCategory = null,
  gameClassification: customClassification = null,
  isVenueSelection = false,
  bookingType = 'SHARED',
  bookingDate, // 'YYYY-MM-DD'
  startTime,   // 'HH:mm'
  duration = 1, // in hours
  numberOfPlayers = 1,
  notes = '',
  idempotencyKey = null,
  applyMembershipBenefit = true,
}) {
  // If no gameId was provided, treat as venue selection (customer selects game upon arrival)
  const effectiveIsVenueSelection = Boolean(isVenueSelection || !gameId);
  const effectivePricingCategory = customClassification || pricingCategory || 'NON_EXCLUSIVE';

  // 0. Idempotency Check: if identical idempotencyKey was already submitted by this customer, return that booking
  if (idempotencyKey && customerId) {
    const existingBooking = await Booking.findOne({
      customer: customerId,
      idempotencyKey,
    });
    if (existingBooking) {
      return existingBooking;
    }
  }

  // 0b. Advance Booking Restriction Check:
  // Verifies customer's active membership plan limit (e.g. 3 or 7 days) in Asia/Kolkata
  if (customerId) {
    await validateCustomerAdvanceBooking({ customerId, bookingDate });
  }

  // 1. Fetch and validate device
  const device = await Device.findById(deviceId);
  if (!device) {
    const err = new Error('Device not found');
    err.status = 404;
    throw err;
  }

  if (device.status === 'MAINTENANCE') {
    const err = new Error(`Device '${device.name}' is currently under maintenance and cannot be booked.`);
    err.status = 400;
    throw err;
  }

  if (device.status !== 'ACTIVE') {
    const err = new Error(`Device '${device.name}' is not currently active for bookings.`);
    err.status = 400;
    throw err;
  }

  // 2. Validate Game if provided (and not venue selection)
  let game = null;
  if (gameId && !effectiveIsVenueSelection) {
    game = await Game.findById(gameId);
    if (!game) {
      const err = new Error('Selected game not found');
      err.status = 404;
      throw err;
    }

    // Check if game is exclusive and disabled
    if (game.isExclusive && game.status === 'INACTIVE') {
      const err = new Error(`Exclusive game '${game.name}' is currently unavailable until activated by the lounge administrator.`);
      err.status = 400;
      throw err;
    }

    // Verify physical device compatibility
    if (game.compatibleDevices && game.compatibleDevices.length > 0) {
      const isCompatible = game.compatibleDevices.some(
        (cd) => cd.toString() === device._id.toString()
      );
      if (!isCompatible) {
        const err = new Error(
          `Game '${game.name}' is only compatible with registered PS5 consoles (${device.name} is not compatible).`
        );
        err.status = 400;
        throw err;
      }
    } else if (game.isExclusive && device.deviceType !== 'PS5') {
      const err = new Error(`'${game.name}' is a PS5 exclusive title and cannot be assigned to ${device.name}.`);
      err.status = 400;
      throw err;
    }
  }

  // Exclusive & multiplayer booking mode rules
  let effectiveBookingType = bookingType;
  const isMultiplayer = isMultiplayerGame(game);

  if (isMultiplayer) {
    if (bookingType === 'PRIVATE') {
      const err = new Error(
        `'${game.name}' is a multiplayer game and must be booked as a Shared session. Private booking is not permitted for multiplayer titles.`
      );
      err.status = 400;
      throw err;
    }
    effectiveBookingType = 'SHARED';
  } else if (game) {
    if (game.bookingMode === 'PRIVATE_ONLY' || game.isExclusive) {
      if (bookingType === 'SHARED') {
        const err = new Error(
          `'${game.name}' is only available for Private sessions and cannot be booked as a Shared session.`
        );
        err.status = 400;
        throw err;
      }
      effectiveBookingType = 'PRIVATE';
    } else if (game.bookingMode === 'SHARED' && bookingType === 'PRIVATE') {
      const err = new Error(
        `'${game.name}' is configured for Shared sessions only and cannot be reserved as a Private session.`
      );
      err.status = 400;
      throw err;
    }
  }

  // 3. Validate Date & Time
  const durationHours = parseFloat(duration);
  if (isNaN(durationHours) || durationHours <= 0) {
    const err = new Error('Invalid booking duration specified');
    err.status = 400;
    throw err;
  }

  const startAt = parseISTDateTime(bookingDate, startTime);
  const durationMinutes = Math.round(durationHours * 60);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  // Validate start is not in the past
  const now = new Date();
  if (startAt.getTime() < now.getTime() - 2 * 60 * 1000) {
    // 2-min clock skew tolerance
    const err = new Error('Cannot book sessions in the past. Please select an upcoming time slot.');
    err.status = 400;
    throw err;
  }

  // Validate within operating hours & schedule priority
  const effectiveSchedule = await scheduleService.getEffectiveDaySchedule(bookingDate);
  if (effectiveSchedule.isClosed) {
    const err = new Error(
      effectiveSchedule.reason
        ? `Gaming lounge is closed on ${bookingDate} (${effectiveSchedule.reason}).`
        : `Gaming lounge is closed on ${bookingDate}.`
    );
    err.status = 400;
    throw err;
  }

  const openTime = effectiveSchedule.openTime || '10:00';
  const closeTime = effectiveSchedule.closeTime || '23:00';
  const dayOpenAt = parseISTDateTime(bookingDate, openTime);
  const dayCloseAt = parseISTDateTime(bookingDate, closeTime);

  if (startAt.getTime() < dayOpenAt.getTime() || endAt.getTime() > dayCloseAt.getTime()) {
    const err = new Error(
      `Booking extends outside daily operating hours for this date (${openTime} to ${closeTime} IST).`
    );
    err.status = 400;
    throw err;
  }

  // Validate not overlapping scheduled closed intervals
  if (effectiveSchedule.closedIntervals && effectiveSchedule.closedIntervals.length > 0) {
    for (const interval of effectiveSchedule.closedIntervals) {
      const intervalStart = parseISTDateTime(bookingDate, interval.from);
      const intervalEnd = parseISTDateTime(bookingDate, interval.to);
      if (startAt.getTime() < intervalEnd.getTime() && endAt.getTime() > intervalStart.getTime()) {
        const err = new Error(
          `Selected booking time conflicts with a scheduled closure (${interval.from} - ${interval.to}${interval.reason ? ': ' + interval.reason : ''}).`
        );
        err.status = 400;
        throw err;
      }
    }
  }

  const endTime = formatISTTime(endAt);

  // 4. Validate player count
  const players = parseInt(numberOfPlayers);
  if (isNaN(players) || players < 1) {
    const err = new Error('Number of players must be at least 1');
    err.status = 400;
    throw err;
  }

  if (players > device.capacity) {
    const err = new Error(
      `Player count (${players}) exceeds maximum device capacity of ${device.capacity} for '${device.name}'.`
    );
    err.status = 400;
    throw err;
  }

  // Game-specific player capacity limits
  if (game) {
    const gameMin = game.minPlayers || 1;
    const gameMax = game.maxPlayers || device.capacity;

    if (players < gameMin) {
      const err = new Error(
        `Player count (${players}) is less than the minimum required (${gameMin}) for '${game.name}'.`
      );
      err.status = 400;
      throw err;
    }

    if (players > gameMax) {
      const err = new Error(
        `Player count (${players}) exceeds the maximum allowed (${gameMax}) for '${game.name}'.`
      );
      err.status = 400;
      throw err;
    }
  }

  // 5. Concurrency-Safe Immediate Availability Re-check wrapped in lock
  const lockKey = `${device._id.toString()}_${startAt.getTime()}`;
  return await withSlotLock(lockKey, async () => {
    const avail = await checkSlotAvailability(device._id, startAt, endAt, game);

    if (avail.status === 'MAINTENANCE') {
      const err = new Error(`Device is under maintenance for this time slot: ${avail.reason}`);
      err.status = 409;
      throw err;
    }

    if (effectiveBookingType === 'PRIVATE') {
      if (!avail.canBookPrivate) {
        const err = new Error(
          game && game.isExclusive
            ? `Cannot reserve GTA 6 on ${device.name}: Console is already booked during this time interval. Please select the other PS5 console or an alternate slot.`
            : 'Cannot create a Private Booking: Device is already booked or partially reserved during this time interval.'
        );
        err.status = 409;
        throw err;
      }
    } else {
      // SHARED
      if (avail.hasPrivateBooking) {
        const err = new Error(
          'Cannot join session: A customer has reserved this entire device for a Private Booking.'
        );
        err.status = 409;
        throw err;
      }

      if (!avail.canBookShared) {
        const err = new Error(
          avail.reason || 'This slot is not available for a shared session.'
        );
        err.status = 409;
        throw err;
      }

      if (players > avail.remainingPlayers) {
        const err = new Error(
          `Session is almost full. Only ${avail.remainingPlayers} player position(s) remain available for '${game ? game.name : device.name}' (requested ${players}).`
        );
        err.status = 409;
        throw err;
      }
    }

    // 6. Calculate Price using centralized backend pricing engine
    const pricingCalculation = await calculateSessionPrice({
      deviceId: device._id,
      gameId: effectiveIsVenueSelection ? null : (game ? game._id : null),
      isVenueSelection: effectiveIsVenueSelection,
      pricingCategory: effectivePricingCategory,
      gameClassification: effectivePricingCategory,
      durationMinutes,
      playersCount: players,
      customerId,
      bookingDate,
      startTime,
      bookingType: effectiveBookingType,
      applyMembershipBenefit,
    });

    let totalAmountPaise = pricingCalculation.totalAmountPaise;
    let advanceRequired = Boolean(pricingCalculation.advanceRequired);
    let advanceAmountPaise = pricingCalculation.minimumAdvancePaise || 0;
    let isAdvancePaid = false;
    let initialPaymentStatus = 'PENDING';
    let membershipApplied = Boolean(pricingCalculation.membershipBenefit?.applied && applyMembershipBenefit);
    let membershipSubscriptionId = null;
    let membershipDiscountPaise = pricingCalculation.membershipBenefit?.discountPaise || 0;
    let reservedEntitlement = null;

    // 6b. Evaluate Membership Coverage & Reserve Entitlement Atomically
    if (customerId && membershipApplied && applyMembershipBenefit) {
      const coverage = await checkMembershipBookingCoverage({
        customerId,
        deviceId: device._id,
        gameId: effectiveIsVenueSelection ? null : (game ? game._id : null),
        bookingDate,
        startTime,
        durationHours,
        numberOfPlayers: players,
        bookingType: effectiveBookingType,
      });

      if (coverage && coverage.covered) {
        membershipSubscriptionId = coverage.subscription.id;

        // Atomically reserve daily free hour benefit if applicable
        if (pricingCalculation.membershipBenefit.freeHoursApplied > 0 && coverage.freeHourAvailable) {
          reservedEntitlement = await reserveDailyFreeHour({
            customerId,
            subscriptionId: coverage.subscription.id,
            bookingDate,
            idempotencyKey,
          });
        }
      }

      if (totalAmountPaise === 0) {
        advanceRequired = false;
        advanceAmountPaise = 0;
        isAdvancePaid = true;
        initialPaymentStatus = 'PAID';
      }
    }

    const pricePerPlayerPaise = Math.round(totalAmountPaise / players);

    // 7. Generate unique booking reference
    const bookingId = generateBookingId(bookingDate);

    // 8. Construct slot objects
    const customer = customerId ? await User.findById(customerId).select('name') : null;
    const playerSlots = [];
    for (let i = 1; i <= players; i++) {
      playerSlots.push({
        slotNumber: avail.occupiedPlayers + i,
        playerName: i === 1 && customer?.name ? customer.name : `Player ${avail.occupiedPlayers + i}`,
        isHost: i === 1 && avail.occupiedPlayers === 0,
      });
    }

    const gameClassification = device.deviceType === 'POOL'
      ? 'NONE'
      : (effectivePricingCategory === 'EXCLUSIVE' || (game && game.isExclusive))
      ? 'EXCLUSIVE'
      : 'NON_EXCLUSIVE';

    const gameTitle = device.deviceType === 'POOL'
      ? '8-Ball Pool Table'
      : game
      ? game.name
      : gameClassification === 'EXCLUSIVE'
      ? 'Exclusive Game (Select at Venue)'
      : 'Non-Exclusive Game (Select at Venue)';

    // 9. Save confirmed booking to MongoDB
    const booking = new Booking({
      bookingId,
      customer: customerId,
      device: device._id,
      game: effectiveIsVenueSelection ? null : (game ? game._id : null),
      isVenueSelection: Boolean(effectiveIsVenueSelection),
      gameClassification,
      gameTitle,
      bookingType: effectiveBookingType,
      bookingDate,
      startTime,
      endTime,
      startAt,
      endAt,
      duration: durationHours,
      numberOfPlayers: players,
      totalAmount: totalAmountPaise,
      amountPaid: totalAmountPaise === 0 ? 0 : 0,
      balanceRemaining: totalAmountPaise,
      advanceRequired,
      advanceAmount: advanceAmountPaise,
      isAdvancePaid,
      paymentExpiresAt: totalAmountPaise === 0 ? null : new Date(Date.now() + 15 * 60 * 1000),
      pricePerPlayer: pricePerPlayerPaise,
      membershipApplied,
      membershipSubscription: membershipSubscriptionId,
      membershipDiscount: membershipDiscountPaise,
      membershipEntitlement: reservedEntitlement?._id || null,
      idempotencyKey: idempotencyKey || null,
      pricingSnapshot: {
        pricingId: pricingCalculation.pricingRule.id,
        planName: pricingCalculation.pricingRule.name,
        billingType: pricingCalculation.pricingRule.billingType,
        ratePerUnitPaise: pricingCalculation.pricingRule.ratePerUnitPaise,
        ratePerUnitRupees: pricingCalculation.pricingRule.ratePerUnitRupees,
        currency: pricingCalculation.currency,
        advanceRequired: pricingCalculation.advanceRequired,
        minimumAdvancePaise: pricingCalculation.minimumAdvancePaise,
      },
      playerSlots,
      bookingStatus: 'CONFIRMED',
      paymentStatus: initialPaymentStatus,
      notes: notes ? notes.trim() : '',
    });

    try {
      await booking.save();
    } catch (saveErr) {
      if (reservedEntitlement) {
        await releaseDailyFreeHour({
          entitlementId: reservedEntitlement._id,
          reason: `Booking save failed: ${saveErr.message}`,
        }).catch(() => {});
      }
      throw saveErr;
    }

    // If fully covered (₹0) and free hour was reserved, finalize and consume entitlement immediately
    if (initialPaymentStatus === 'PAID' && reservedEntitlement) {
      await consumeDailyFreeHour({
        entitlementId: reservedEntitlement._id,
        bookingId: booking._id,
      }).catch((consumeErr) => {
        console.error('[Consume Entitlement Error]:', consumeErr.message);
      });
    }

    // If session covered under membership, record usage tracking
    if (membershipApplied && membershipSubscriptionId) {
      await recordMembershipUsage({
        booking,
        customerId,
        subscriptionId: membershipSubscriptionId,
      });
    }

    // Send Booking Confirmation Notification and Email
    if (customerId) {
      try {
        await createNotification({
          recipient: customerId,
          recipientRole: 'customer',
          title: 'Booking Confirmed! 🎮',
          message: `Your reservation for ${device.name}${game ? ` (${game.name})` : ''} on ${bookingDate} from ${startTime} to ${endTime} IST has been confirmed (Ref: ${booking.bookingId}).`,
          category: 'BOOKING_CONFIRMED',
          relatedBooking: booking._id,
          idempotencyKey: `BOOKING_CONFIRMED_${booking._id}`,
          deliveryChannels: ['IN_APP', 'WHATSAPP'],
        });
      } catch (notifErr) {
        console.warn('Booking confirmation notification error:', notifErr.message);
      }

      try {
        const customer = await User.findById(customerId);
        if (customer && customer.email) {
          sendBookingConfirmationEmail({
            booking,
            customer,
            device,
            game,
          }).catch((emailErr) => console.error('[Booking Confirmation Email Error]:', emailErr.message));
        }
      } catch (emailErr) {
        console.warn('Booking confirmation email error:', emailErr.message);
      }
    }

    // Audit log
    await ActivityLog.create({
      userId: customerId,
      action: 'CREATE_BOOKING',
      category: 'BOOKING',
      details: {
        bookingId: booking.bookingId,
        deviceId: device._id,
        deviceName: device.name,
        bookingType,
        date: bookingDate,
        time: `${startTime}-${endTime}`,
        players,
        amountRupees: totalAmountPaise / 100,
      },
    });

    return booking;
  });
}

/**
 * Cancels an existing booking and releases its player capacity
 */
export async function cancelBookingService(bookingId, userId, userRole, reason = '') {
  const query = { _id: bookingId };
  if (userRole !== 'admin' && userRole !== 'receptionist') {
    query.customer = userId; // Customers can only cancel their own bookings
  }

  const booking = await Booking.findOne(query).populate('device customer game');
  if (!booking) {
    const err = new Error('Booking not found or you are not authorized to cancel it.');
    err.status = 404;
    throw err;
  }

  if (booking.bookingStatus === 'CANCELLED') {
    const err = new Error('This booking is already cancelled.');
    err.status = 400;
    throw err;
  }

  if (booking.bookingStatus === 'COMPLETED') {
    const err = new Error('Completed gaming sessions cannot be cancelled.');
    err.status = 400;
    throw err;
  }

  booking.bookingStatus = 'CANCELLED';
  booking.cancellationReason = reason ? reason.trim() : 'Cancelled by user';
  booking.cancelledAt = new Date();

  await booking.save();

  // If session was counted under membership quota, release it
  if (booking.membershipEntitlement) {
    await releaseDailyFreeHour({
      entitlementId: booking.membershipEntitlement,
      bookingId: booking._id,
      reason: reason ? reason.trim() : 'Booking cancelled by user',
    }).catch((releaseErr) => {
      console.error('[Release Free Hour Entitlement Error]:', releaseErr.message);
    });
  }

  if (booking.membershipApplied) {
    await releaseMembershipUsage({ bookingId: booking._id });
  }

  // Send Booking Cancellation Notification and Email
  const customerUser = booking.customer;
  if (customerUser) {
    const custId = customerUser._id || customerUser;
    try {
      await createNotification({
        recipient: custId,
        recipientRole: 'customer',
        title: 'Booking Cancelled 🚫',
        message: `Your reservation for ${booking.device?.name || 'Device'} on ${booking.bookingDate} (${booking.startTime}-${booking.endTime} IST) has been cancelled.`,
        category: 'BOOKING_CANCELLED',
        relatedBooking: booking._id,
        idempotencyKey: `BOOKING_CANCELLED_${booking._id}`,
        deliveryChannels: ['IN_APP', 'WHATSAPP'],
      });
    } catch (notifErr) {
      console.warn('Booking cancellation notification error:', notifErr.message);
    }

    try {
      if (customerUser.email) {
        sendBookingCancellationEmail({
          booking,
          customer: customerUser,
          reason: booking.cancellationReason,
        }).catch((emailErr) => console.error('[Booking Cancellation Email Error]:', emailErr.message));
      }
    } catch (emailErr) {
      console.warn('Booking cancellation email error:', emailErr.message);
    }
  }

  // Audit log
  await ActivityLog.create({
    userId,
    action: 'CANCEL_BOOKING',
    category: 'BOOKING',
    details: {
      bookingId: booking.bookingId,
      reason: booking.cancellationReason,
      cancelledByRole: userRole,
    },
  });

  return booking;
}
