import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import ActivityLog from '../models/ActivityLog.js';
import GamingSession from '../models/GamingSession.js';
import { createBookingAtomic } from './booking.service.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';
import { generateReceipt } from '../utils/receiptGenerator.js';
import { formatISTDate, formatISTTime } from '../utils/timeSlots.js';
import {
  normalizePhone,
  isValidIndianPhone,
  normalizeEmail,
  isValidEmail,
  isPlaceholderEmail,
} from '../utils/validators.js';
import { calculateRevenueMetrics } from './revenue.service.js';
import { sendPaymentSuccessEmail } from './email.service.js';
import { getCustomerMembershipQuota } from './membership.service.js';
import { scheduleService } from './schedule.service.js';
export { getCustomerMembershipQuota };

/**
 * Log receptionist action to immutable ActivityLog
 */
export async function logReceptionistActivity({
  staffUser,
  action,
  bookingId = '',
  customerId = null,
  paymentReference = '',
  description = '',
  details = {},
  status = 'SUCCESS',
  ipAddress = '127.0.0.1',
}) {
  try {
    return await ActivityLog.create({
      userId: staffUser?._id || null,
      userName: staffUser?.name || 'Staff Receptionist',
      userRole: staffUser?.role || 'receptionist',
      action,
      category: 'RECEPTIONIST',
      bookingId,
      customerId,
      paymentReference,
      description,
      details,
      status,
      ipAddress,
    });
  } catch (err) {
    console.warn('[ActivityLog Error]', err.message);
  }
}

/**
 * 1. Receptionist Dashboard Live Stats
 */
export async function getReceptionistDashboardStats() {
  const now = new Date();
  const todayIST = formatISTDate(now);

  // Define IST day boundary timestamps for revenue
  const startOfTodayIST = new Date(`${todayIST}T00:00:00.000+05:30`);
  const endOfTodayIST = new Date(`${todayIST}T23:59:59.999+05:30`);

  // Bookings and revenue queries for today using centralized revenue service
  const [
    todayBookings,
    activeBookings,
    todayRevenueMetrics,
    devices,
  ] = await Promise.all([
    Booking.find({
      bookingDate: todayIST,
      bookingStatus: { $ne: 'CANCELLED' },
    }).populate('customer device game'),
    Booking.find({
      sessionStatus: { $in: ['ACTIVE', 'EXTENDED'] },
      bookingStatus: { $ne: 'CANCELLED' },
    }).populate('customer device game'),
    calculateRevenueMetrics({ range: 'today' }),
    Device.find({ status: { $ne: 'DELETED' } }).sort({ deviceCode: 1 }),
  ]);

  const totalBookingsToday = todayBookings.length;
  const walkInBookingsToday = todayBookings.filter((b) => b.isWalkIn).length;
  const completedSessions = todayBookings.filter(
    (b) => b.sessionStatus === 'COMPLETED' || b.bookingStatus === 'COMPLETED'
  ).length;

  const upcomingBookings = todayBookings.filter(
    (b) =>
      b.checkInStatus === 'NOT_CHECKED_IN' &&
      b.bookingStatus === 'CONFIRMED' &&
      new Date(b.startAt) > now
  ).length;

  const pendingPayments = todayBookings.filter((b) => b.balanceRemaining > 0).length;

  const todayRevenuePaise = todayRevenueMetrics.netCollectedPaise;

  // Calculate live physical console occupancy
  const ps5Devices = devices.filter((d) => d.deviceType === 'PS5' && d.status === 'ACTIVE');
  let occupiedPS5Count = 0;
  let availablePS5Count = 0;

  const deviceStatuses = devices.map((dev) => {
    // Find sessions currently running on this physical device
    const runningSessions = activeBookings.filter(
      (b) => b.device?._id.toString() === dev._id.toString()
    );

    const hasPrivate = runningSessions.some(
      (b) => b.bookingType === 'PRIVATE' || (b.game && b.game.isExclusive)
    );
    const totalOccupiedSlots = runningSessions.reduce(
      (sum, b) => sum + (b.numberOfPlayers || 1),
      0
    );

    let isAvailable = dev.status === 'ACTIVE';
    let availableSlots = 0;

    if (dev.status === 'MAINTENANCE') {
      isAvailable = false;
      availableSlots = 0;
    } else if (hasPrivate || totalOccupiedSlots >= dev.capacity) {
      isAvailable = false;
      availableSlots = 0;
    } else {
      isAvailable = true;
      availableSlots = dev.capacity - totalOccupiedSlots;
    }

    if (dev.deviceType === 'PS5') {
      if (!isAvailable || runningSessions.length > 0) {
        occupiedPS5Count++;
      } else {
        availablePS5Count++;
      }
    }

    // Format current active session for display if present
    const primarySession = runningSessions[0] || null;
    let sessionRemainingSeconds = 0;
    if (primarySession && primarySession.endAt) {
      sessionRemainingSeconds = Math.max(
        0,
        Math.floor((new Date(primarySession.endAt).getTime() - now.getTime()) / 1000)
      );
    }

    return {
      deviceId: dev._id,
      name: dev.name,
      deviceCode: dev.deviceCode,
      deviceType: dev.deviceType,
      capacity: dev.capacity,
      status: dev.status,
      isAvailable,
      availableSlots,
      totalOccupiedSlots,
      activeSessionsCount: runningSessions.length,
      currentSession: primarySession
        ? {
            bookingId: primarySession.bookingId,
            customerName: primarySession.customer?.name || 'Walk-In Player',
            gameName: primarySession.isVenueSelection
              ? 'Select Game at Venue'
              : (primarySession.game?.name || primarySession.gameTitle || 'Game Not Selected'),
            isExclusiveGame: Boolean(primarySession.game?.isExclusive || primarySession.gameClassification === 'EXCLUSIVE' || (primarySession.game?.name && /GTA/i.test(primarySession.game.name))),
            isGTA6: Boolean((primarySession.game?.name && /GTA/i.test(primarySession.game.name)) || (primarySession.gameTitle && /GTA/i.test(primarySession.gameTitle))),
            bookingType: primarySession.bookingType,
            bookingModeDisplay: primarySession.bookingType === 'PRIVATE' ? 'Private Session' : 'Shared Session',
            numberOfPlayers: primarySession.numberOfPlayers,
            startTime: primarySession.startAt ? formatISTTime(primarySession.startAt) : primarySession.startTime,
            endTime: primarySession.endAt ? formatISTTime(primarySession.endAt) : primarySession.endTime,
            startAt: primarySession.startAt,
            endAt: primarySession.endAt,
            remainingSeconds: sessionRemainingSeconds,
            remainingMinutes: Math.ceil(sessionRemainingSeconds / 60),
            sessionStatus: primarySession.sessionStatus,
            paymentStatus: primarySession.paymentStatus,
            balanceRemainingPaise: primarySession.balanceRemaining,
            balanceRemainingRupees: primarySession.balanceRemaining / 100,
          }
        : null,
    };
  });

  const poolTable = deviceStatuses.find((d) => d.deviceCode === 'POOL-01') || null;

  return {
    timestamp: now.toISOString(),
    metrics: {
      totalBookingsToday,
      upcomingBookings,
      activeGamingSessions: activeBookings.length,
      completedSessions,
      walkInBookingsToday,
      availablePS5Consoles: availablePS5Count,
      occupiedPS5Consoles: occupiedPS5Count,
      pendingPayments,
      todayRevenuePaise,
      todayRevenueRupees: todayRevenuePaise / 100,
    },
    poolTableStatus: poolTable,
    devices: deviceStatuses,
  };
}

/**
 * 2. Customer Search & Verification
 */
export async function searchCustomersForReceptionist({ query = '' }) {
  const cleanQ = String(query || '').trim();
  if (!cleanQ) return [];

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const safeRegex = new RegExp(escapeRegex(cleanQ), 'i');

  // 1. Check if query is a booking ID (e.g. BK-20261117-001)
  if (cleanQ.toUpperCase().startsWith('BK-') || cleanQ.toUpperCase().startsWith('BK')) {
    const booking = await Booking.findOne({
      bookingId: new RegExp(`^${escapeRegex(cleanQ)}$`, 'i'),
    }).populate({
      path: 'customer',
      populate: { path: 'membership.planId' },
    });
    if (booking && booking.customer) {
      const custObj = typeof booking.customer.toSafeObject === 'function'
        ? booking.customer.toSafeObject()
        : booking.customer;
      return [custObj];
    }
  }

  // 2. Build multi-field search conditions
  const orConditions = [
    { name: safeRegex },
    { email: safeRegex },
    { customerId: safeRegex },
  ];

  // 3. Flexible digit extraction for phone numbers (handling spaces, dashes, +91 country codes, etc.)
  const digitsOnly = cleanQ.replace(/\D/g, '');
  if (digitsOnly.length >= 2) {
    const flexibleDigitPattern = digitsOnly.split('').map((d) => escapeRegex(d)).join('[\\s\\-]?');
    orConditions.push({ phone: new RegExp(flexibleDigitPattern, 'i') });
    // If country code 91 was prepended to a 10-digit number
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
      const national10 = digitsOnly.slice(-10);
      const flexibleNational = national10.split('').map((d) => escapeRegex(d)).join('[\\s\\-]?');
      orConditions.push({ phone: new RegExp(flexibleNational, 'i') });
    }
  } else {
    orConditions.push({ phone: safeRegex });
  }

  // 4. Exact ObjectId match if valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(cleanQ)) {
    orConditions.push({ _id: cleanQ });
  }

  // Find matching users (registered customers and walk-in guests)
  const users = await User.find({
    $or: orConditions,
  })
    .populate('membership.planId')
    .limit(25)
    .sort({ updatedAt: -1 });

  return users.map((u) => (typeof u.toSafeObject === 'function' ? u.toSafeObject() : u));
}

/**
 * 3. Comprehensive Customer Details for Receptionist
 */
export async function getReceptionistCustomerDetails({
  customerId,
  historyFilter = 'all',
  startDate,
  endDate,
}) {
  const user = await User.findById(customerId).populate('membership.planId membership.subscriptionId');
  if (!user) {
    const err = new Error('Customer account not found');
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const todayIST = formatISTDate(now);

  // Build gaming history query based on time filter
  const historyQuery = { customer: user._id };

  if (historyFilter === 'today') {
    historyQuery.bookingDate = todayIST;
  } else if (historyFilter === '7d') {
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    historyQuery.startAt = { $gte: past7d };
  } else if (historyFilter === '1m') {
    const past1m = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    historyQuery.startAt = { $gte: past1m };
  } else if (historyFilter === '6m') {
    const past6m = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    historyQuery.startAt = { $gte: past6m };
  } else if (historyFilter === '1y') {
    const past1y = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    historyQuery.startAt = { $gte: past1y };
  } else if (historyFilter === 'custom' && startDate && endDate) {
    historyQuery.bookingDate = { $gte: startDate, $lte: endDate };
  }

  const [
    upcomingBookings,
    gamingHistory,
    payments,
    allUserBookings,
    todayUsages,
  ] = await Promise.all([
    Booking.find({
      customer: user._id,
      bookingDate: { $gte: todayIST },
      bookingStatus: 'CONFIRMED',
    })
      .populate('device game')
      .sort({ bookingDate: 1, startTime: 1 }),
    Booking.find(historyQuery)
      .populate('device game payments')
      .sort({ startAt: -1 })
      .limit(50),
    Payment.find({ customer: user._id }).sort({ createdAt: -1 }).limit(50),
    Booking.find({ customer: user._id }),
    MembershipUsage.find({ customer: user._id, usageDate: todayIST, status: { $ne: 'CANCELLED' } }),
  ]);

  // Outstanding balance across active uncancelled bookings
  const outstandingBalancePaise = allUserBookings
    .filter((b) => b.bookingStatus !== 'CANCELLED')
    .reduce((sum, b) => sum + (b.balanceRemaining || 0), 0);

  // Cancellation metrics
  const cancellations = allUserBookings.filter((b) => b.bookingStatus === 'CANCELLED');

  // Daily membership usage today
  const minutesUsedToday = todayUsages.reduce((sum, u) => sum + (u.duration || 0), 0);
  const plan = user.membership?.planId || null;
  const dailyLimitMinutes = plan?.dailyUsageLimit || 0;
  const remainingMinutesToday = plan?.isUnlimited
    ? Math.max(0, dailyLimitMinutes - minutesUsedToday)
    : 9999;

  return {
    customer: user.toSafeObject(),
    membershipVerification: {
      hasActiveMembership: user.membership?.status === 'ACTIVE',
      status: user.membership?.status || 'NONE',
      planName: plan?.name || 'No Active Membership',
      isUnlimited: plan?.isUnlimited || false,
      expiresAt: user.membership?.expiresAt || null,
      dailyUsageLimitMinutes: dailyLimitMinutes,
      minutesUsedToday,
      remainingMinutesToday,
      includesExclusiveGames: plan?.includesExclusiveGames || false,
    },
    metrics: {
      totalBookingsCount: allUserBookings.length,
      upcomingBookingsCount: upcomingBookings.length,
      cancellationsCount: cancellations.length,
      outstandingBalancePaise,
      outstandingBalanceRupees: outstandingBalancePaise / 100,
    },
    upcomingBookings,
    gamingHistory,
    payments,
    cancellations: cancellations.slice(0, 10),
  };
}

/**
 * 4. Register Walk-In Customer at Reception
 * Mandatory Fields: Customer Name, Email Address, and Mobile Number
 * Enforces strict validation, prohibits fake/placeholder emails, prevents duplicate records, and avoids overwriting.
 */
export async function registerCustomerAtReception({ name, phone, email, staffUser }) {
  // 1. Validate Customer Name
  if (!name || !name.trim()) {
    const err = new Error('Customer full name is mandatory.');
    err.status = 400;
    throw err;
  }

  // 2. Validate & Normalize Mobile Number
  if (!phone || !String(phone).trim()) {
    const err = new Error('Mobile number is mandatory.');
    err.status = 400;
    throw err;
  }
  const cleanPhone = normalizePhone(phone);
  if (!isValidIndianPhone(cleanPhone)) {
    const err = new Error('Mobile number must be a valid 10-digit number (e.g. 9876543210).');
    err.status = 400;
    throw err;
  }

  // 3. Validate & Normalize Email Address
  if (!email || !String(email).trim()) {
    const err = new Error('Email address is mandatory for registration.');
    err.status = 400;
    throw err;
  }
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) {
    const err = new Error('Please enter a valid email address (e.g. customer@example.com).');
    err.status = 400;
    throw err;
  }
  if (isPlaceholderEmail(cleanEmail)) {
    const err = new Error('Placeholder, test, or generic email addresses are not permitted. Please enter the customer\'s real email address.');
    err.status = 400;
    throw err;
  }

  // 4. Check for existing customers using normalized email and mobile values
  const existingByPhone = await User.findOne({
    $or: [
      { phone: cleanPhone },
      { phone: `+91${cleanPhone}` },
      { phone: `+91 ${cleanPhone}` },
    ],
  });

  const existingByEmail = await User.findOne({ email: cleanEmail });

  // Prevent conflicting accounts
  if (existingByPhone && existingByEmail && existingByPhone._id.toString() !== existingByEmail._id.toString()) {
    const err = new Error(
      `Conflicting customer records found: Mobile ${cleanPhone} belongs to '${existingByPhone.name}', while email '${cleanEmail}' is registered to '${existingByEmail.name}'.`
    );
    err.status = 409;
    throw err;
  }

  const existingUser = existingByPhone || existingByEmail;
  if (existingUser) {
    return {
      customer: existingUser.toSafeObject(),
      alreadyExists: true,
      accountType: existingUser.accountType || 'REGISTERED',
      isGuest: existingUser.accountType === 'GUEST' || !!existingUser.isGuest,
      message: `Existing ${existingUser.accountType === 'GUEST' ? 'Guest' : 'Registered'} profile found for '${existingUser.name}' (${existingUser.phone}, ${existingUser.email}).`,
    };
  }

  // 5. Generate secure random initial password for walk-in guest accounts
  const tempPassword = `NoahPass_${Math.random().toString(36).slice(-8)}!1`;

  const newUser = await User.create({
    name: name.trim(),
    phone: cleanPhone,
    email: cleanEmail,
    password: tempPassword,
    role: 'customer',
    accountType: 'GUEST',
    isGuest: true,
  });

  await logReceptionistActivity({
    staffUser,
    action: 'REGISTER_CUSTOMER',
    customerId: newUser._id,
    description: `Registered new walk-in customer '${newUser.name}' (${newUser.phone}, ${newUser.email})`,
  });

  return {
    customer: newUser.toSafeObject(),
    alreadyExists: false,
    message: 'Customer registered successfully at front desk.',
  };
}

/**
 * 5. Create Walk-In Booking at Front Desk
 */
export async function createWalkInBooking({
  customerId,
  deviceId,
  gameId = null,
  isVenueSelection = false,
  bookingType = 'SHARED',
  bookingDate,
  startTime,
  duration = 1,
  numberOfPlayers = 1,
  notes = '',
  paymentMethod = 'CASH',
  paymentAmountPaise = 0,
  transactionReference = '',
  staffUser,
  useMembershipFreeHours = false,
}) {
  const now = new Date();
  const todayIST = formatISTDate(now);
  const targetDate = bookingDate || todayIST;

  // 1. Create booking using existing Phase 3 atomic booking engine
  // Free hours are only applied if useMembershipFreeHours is explicitly true!
  const booking = await createBookingAtomic({
    customerId,
    deviceId,
    gameId: isVenueSelection ? null : gameId,
    isVenueSelection: Boolean(isVenueSelection),
    bookingType,
    bookingDate: targetDate,
    startTime,
    duration,
    numberOfPlayers,
    notes: notes ? `Walk-in: ${notes}` : 'Walk-in booking created at reception counter',
    applyMembershipBenefit: Boolean(useMembershipFreeHours),
  });

  // 2. Mark as Walk-In
  booking.isWalkIn = true;
  booking.walkInCreatedBy = staffUser._id;

  // 3. Handle Immediate Counter Payment if provided
  let paymentRecord = null;
  if (paymentAmountPaise > 0) {
    const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const receiptNumber = `REC-WALKIN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

    paymentRecord = await Payment.create({
      paymentId: internalPaymentId,
      receiptNumber,
      customer: customerId,
      booking: booking._id,
      collectedBy: staffUser._id,
      amount: Math.min(paymentAmountPaise, booking.totalAmount),
      currency: 'INR',
      paymentMethod: paymentMethod === 'COUNTER_UPI' ? 'COUNTER_UPI' : 'CASH',
      paymentGateway: paymentMethod === 'COUNTER_UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
      paymentStatus: 'PAID',
      paymentPurpose: 'WALKIN_OFFLINE',
      transactionReference: transactionReference || 'Front Desk Counter',
      paidAt: now,
      notes: `Walk-in counter payment collected by ${staffUser.name || 'Staff'}`,
      auditTrail: [
        {
          status: 'PAID',
          changedBy: staffUser._id,
          reason: `Walk-in payment via ${paymentMethod}`,
          timestamp: now,
        },
      ],
    });

    booking.payments.push(paymentRecord._id);
    booking.amountPaid = (booking.amountPaid || 0) + paymentRecord.amount;
    booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
    booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
    if (booking.advanceRequired && booking.amountPaid >= (booking.advanceAmount || 0)) {
      booking.isAdvancePaid = true;
    }
  }

  // 4. Auto check-in if session starts immediately (now is between startAt and endAt)
  if (now >= booking.startAt && now < booking.endAt) {
    const bookedDuration = booking.duration || 1;
    const scheduledEndAt = new Date(now.getTime() + bookedDuration * 3600 * 1000);
    const formattedEndTime = formatISTTime(scheduledEndAt);

    booking.checkInStatus = 'CHECKED_IN';
    booking.checkedInAt = now;
    booking.checkedInBy = staffUser._id;
    booking.sessionStatus = 'ACTIVE';
    booking.sessionStartedAt = now;
    booking.sessionStartedBy = staffUser._id;
    booking.startAt = now;
    booking.startTime = formatISTTime(now);
    booking.endAt = scheduledEndAt;
    booking.endTime = formattedEndTime;
  }

  await booking.save();

  if (booking.sessionStatus === 'ACTIVE') {
    let gamingSession = await GamingSession.findOne({ booking: booking._id });
    const scheduledEndAt = booking.endAt;
    if (!gamingSession) {
      gamingSession = new GamingSession({
        booking: booking._id,
        customer: booking.customer._id,
        device: booking.device._id,
        game: booking.game?._id || null,
        startedAt: now,
        scheduledEndAt,
        status: 'ACTIVE',
      });
    } else {
      gamingSession.status = 'ACTIVE';
      gamingSession.startedAt = now;
      gamingSession.scheduledEndAt = scheduledEndAt;
      gamingSession.actualEndAt = null;
    }
    await gamingSession.save();
  }

  await logReceptionistActivity({
    staffUser,
    action: 'CREATE_WALKIN_BOOKING',
    bookingId: booking.bookingId,
    customerId,
    paymentReference: paymentRecord?.receiptNumber || '',
    description: `Walk-in booking created for ${booking.numberOfPlayers} player(s) on ${booking.bookingDate} at ${booking.startTime}`,
    details: {
      deviceId,
      gameId,
      duration,
      paymentAmountPaise,
      paymentMethod,
    },
  });

  // Populate for return
  const populated = await Booking.findById(booking._id).populate('customer device game payments');

  if (paymentRecord && populated?.customer?.email) {
    sendPaymentSuccessEmail({
      payment: paymentRecord,
      customer: populated.customer,
      booking: populated,
      eventKey: `PAYMENT_SUCCESS_${paymentRecord._id}`,
    }).catch((e) => console.error('[Receptionist Walk-in Payment Email Error]:', e.message));
  }
  return {
    booking: populated,
    payment: paymentRecord,
  };
}

/**
 * 6. Booking Check-in
 */
export async function checkInBooking({ bookingId, staffUser, paymentCollection }) {
  const booking = await Booking.findOne({
    $or: [{ bookingId: bookingId.toUpperCase() }, { _id: bookingId }],
  }).populate('customer device game payments');

  if (!booking) {
    const err = new Error('Booking reservation not found.');
    err.status = 404;
    throw err;
  }

  if (booking.bookingStatus === 'CANCELLED') {
    const err = new Error('Cannot check in a cancelled booking.');
    err.status = 400;
    throw err;
  }

  if (booking.checkInStatus === 'CHECKED_IN') {
    const err = new Error(`Booking ${booking.bookingId} is already checked in.`);
    err.status = 400;
    throw err;
  }

  const now = new Date();

  // If receptionist collects outstanding balance at check-in
  let paymentRecord = null;
  if (paymentCollection && paymentCollection.amountPaise > 0) {
    const payAmount = Math.min(paymentCollection.amountPaise, booking.balanceRemaining);
    const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const receiptNumber = `REC-CHKIN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

    paymentRecord = await Payment.create({
      paymentId: internalPaymentId,
      receiptNumber,
      customer: booking.customer._id,
      booking: booking._id,
      collectedBy: staffUser._id,
      amount: payAmount,
      currency: 'INR',
      paymentMethod: paymentCollection.paymentMethod === 'COUNTER_UPI' ? 'COUNTER_UPI' : 'CASH',
      paymentGateway: paymentCollection.paymentMethod === 'COUNTER_UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
      paymentStatus: 'PAID',
      paymentPurpose: 'BOOKING_BALANCE',
      transactionReference: paymentCollection.transactionReference || 'Check-in counter',
      paidAt: now,
      notes: `Balance payment collected at check-in by ${staffUser.name || 'Staff'}`,
    });

    booking.payments.push(paymentRecord._id);
    booking.amountPaid = (booking.amountPaid || 0) + payAmount;
    booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
    booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  }

  // Update check-in and start active session
  const bookedDurationHours = booking.duration || 1;
  const scheduledEndAt = new Date(now.getTime() + bookedDurationHours * 3600 * 1000);
  const formattedEndTime = formatISTTime(scheduledEndAt);

  booking.checkInStatus = 'CHECKED_IN';
  booking.checkedInAt = now;
  booking.checkedInBy = staffUser._id;
  booking.sessionStatus = 'ACTIVE';
  booking.sessionStartedAt = now;
  booking.sessionStartedBy = staffUser._id;
  booking.startAt = now;
  booking.startTime = formatISTTime(now);
  booking.endAt = scheduledEndAt;
  booking.endTime = formattedEndTime;

  await booking.save();

  // Initialize or update GamingSession for Phase 8 automation
  let gamingSession = await GamingSession.findOne({ booking: booking._id });
  if (!gamingSession) {
    gamingSession = new GamingSession({
      booking: booking._id,
      customer: booking.customer._id,
      device: booking.device._id,
      game: booking.game?._id || null,
      startedAt: now,
      scheduledEndAt,
      status: 'ACTIVE',
    });
  } else {
    gamingSession.status = 'ACTIVE';
    gamingSession.startedAt = now;
    gamingSession.scheduledEndAt = scheduledEndAt;
    gamingSession.actualEndAt = null;
  }
  await gamingSession.save();

  await logReceptionistActivity({
    staffUser,
    action: 'CHECK_IN_BOOKING',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    paymentReference: paymentRecord?.receiptNumber || '',
    description: `Customer checked in for session ${booking.bookingId} on ${booking.device?.name}`,
  });

  const updated = await Booking.findById(booking._id).populate('customer device game payments');

  if (paymentRecord && updated?.customer?.email) {
    sendPaymentSuccessEmail({
      payment: paymentRecord,
      customer: updated.customer,
      booking: updated,
      eventKey: `PAYMENT_SUCCESS_${paymentRecord._id}`,
    }).catch((e) => console.error('[Receptionist Check-in Payment Email Error]:', e.message));
  }
  return {
    booking: updated,
    payment: paymentRecord,
  };
}

/**
 * 7. Mark No-Show for Missed Booking
 */
export async function markBookingNoShow({ bookingId, staffUser, reason = '' }) {
  const booking = await Booking.findOne({
    $or: [{ bookingId: bookingId.toUpperCase() }, { _id: bookingId }],
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  if (booking.checkInStatus === 'CHECKED_IN') {
    const err = new Error('Cannot mark an already checked-in booking as no-show.');
    err.status = 400;
    throw err;
  }

  booking.checkInStatus = 'NO_SHOW';
  booking.bookingStatus = 'CANCELLED';
  booking.cancellationReason = reason || 'Customer marked No-Show by reception desk';
  booking.cancelledAt = new Date();

  await booking.save();

  // Cancel gaming session if exists
  let gamingSession = await GamingSession.findOne({ booking: booking._id });
  if (gamingSession) {
    gamingSession.status = 'CANCELLED';
    await gamingSession.save();
  }

  await logReceptionistActivity({
    staffUser,
    action: 'MARK_NO_SHOW',
    bookingId: booking.bookingId,
    customerId: booking.customer,
    description: `Marked reservation ${booking.bookingId} as NO_SHOW`,
  });

  return booking;
}

/**
 * 8. Live Active Gaming Sessions
 */
export async function getActiveSessions() {
  const now = new Date();
  const sessions = await Booking.find({
    sessionStatus: { $in: ['ACTIVE', 'EXTENDED', 'TIME_EXPIRED', 'AWAITING_RECEPTIONIST'] },
    bookingStatus: { $ne: 'CANCELLED' },
  })
    .populate('customer device game payments')
    .sort({ endAt: 1 });

  return sessions.map((s) => {
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(s.endAt).getTime() - now.getTime()) / 1000)
    );
    const elapsedMinutes = Math.floor(
      (now.getTime() - new Date(s.sessionStartedAt || s.startAt).getTime()) / 60000
    );
    const isOverdue = now > new Date(s.endAt);

    const gameDisplayName = s.isVenueSelection
      ? 'Select Game at Venue'
      : (s.game?.name || s.gameTitle || 'Game Not Selected');
    const isExclusiveGame = Boolean(s.game?.isExclusive || s.gameClassification === 'EXCLUSIVE' || (s.game?.name && /GTA/i.test(s.game.name)));
    const isGTA6 = Boolean((s.game?.name && /GTA/i.test(s.game.name)) || (s.gameTitle && /GTA/i.test(s.gameTitle)));

    return {
      _id: s._id,
      bookingId: s.bookingId,
      customer: s.customer,
      device: s.device,
      game: s.game,
      isVenueSelection: s.isVenueSelection,
      gameTitle: s.gameTitle,
      gameName: gameDisplayName,
      isExclusiveGame,
      isGTA6,
      bookingType: s.bookingType,
      bookingModeDisplay: s.bookingType === 'PRIVATE' ? 'Private Session' : 'Shared Session',
      numberOfPlayers: s.numberOfPlayers,
      startTime: s.startTime,
      endTime: s.endTime,
      startAt: s.startAt,
      endAt: s.endAt,
      duration: s.duration,
      totalAmountPaise: s.totalAmount,
      totalAmountRupees: s.totalAmount / 100,
      amountPaidPaise: s.amountPaid,
      amountPaidRupees: s.amountPaid / 100,
      balanceRemainingPaise: s.balanceRemaining,
      balanceRemainingRupees: s.balanceRemaining / 100,
      paymentStatus: s.paymentStatus,
      checkInStatus: s.checkInStatus,
      sessionStatus: s.sessionStatus,
      sessionStartedAt: s.sessionStartedAt,
      remainingSeconds,
      remainingMinutes: Math.ceil(remainingSeconds / 60),
      elapsedMinutes,
      isOverdue,
      extensions: s.extensions || [],
    };
  });
}

/**
 * 9. Start Session (Explicit Start)
 */
export async function startSession({ bookingId, staffUser }) {
  const booking = await Booking.findById(bookingId).populate('customer device game');
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const bookedDurationHours = booking.duration || 1;
  const scheduledEndAt = new Date(now.getTime() + bookedDurationHours * 3600 * 1000);
  const formattedEndTime = formatISTTime(scheduledEndAt);

  booking.sessionStatus = 'ACTIVE';
  booking.sessionStartedAt = now;
  booking.sessionStartedBy = staffUser._id;
  booking.startAt = now;
  booking.startTime = formatISTTime(now);
  booking.endAt = scheduledEndAt;
  booking.endTime = formattedEndTime;
  if (booking.checkInStatus !== 'CHECKED_IN') {
    booking.checkInStatus = 'CHECKED_IN';
    booking.checkedInAt = now;
    booking.checkedInBy = staffUser._id;
  }

  await booking.save();

  // Initialize or update GamingSession
  let gamingSession = await GamingSession.findOne({ booking: booking._id });
  if (!gamingSession) {
    gamingSession = new GamingSession({
      booking: booking._id,
      customer: booking.customer._id,
      device: booking.device._id,
      game: booking.game?._id || null,
      startedAt: now,
      scheduledEndAt,
      status: 'ACTIVE',
    });
  } else {
    gamingSession.status = 'ACTIVE';
    gamingSession.startedAt = now;
    gamingSession.scheduledEndAt = scheduledEndAt;
    gamingSession.actualEndAt = null;
  }
  await gamingSession.save();

  await logReceptionistActivity({
    staffUser,
    action: 'START_SESSION',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    description: `Started active gaming timer for ${booking.bookingId} on ${booking.device?.name}`,
  });

  return booking;
}

/**
 * Preview Session Extension with Authoritative Dynamic Pricing Breakdown & Membership Free Hours
 */
export async function previewSessionExtension({
  bookingId,
  extendedDurationHours = 1,
  useMembershipFreeHours = false,
}) {
  const booking = await Booking.findById(bookingId).populate('customer device game');
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const parsedDuration = Number(extendedDurationHours);
  if (!parsedDuration || parsedDuration <= 0) {
    const err = new Error('Invalid extension duration. Must be greater than 0.');
    err.status = 400;
    throw err;
  }

  const previousEndAt = new Date(booking.endAt || new Date());
  const previousEndTime = booking.endTime || formatISTTime(previousEndAt);
  const newEndAt = new Date(previousEndAt.getTime() + parsedDuration * 3600 * 1000);
  const newEndTime = formatISTTime(newEndAt);

  // Check closing hours dynamically from schedule service
  let exceedsClosingHours = false;
  let closingHoursWarning = null;
  const bookingDateStr = booking.bookingDate || formatISTDate(newEndAt);
  let effectiveCloseTime = '23:00';
  try {
    const effectiveDay = await scheduleService.getEffectiveDaySchedule(bookingDateStr);
    if (effectiveDay.isClosed) {
      exceedsClosingHours = true;
      closingHoursWarning = `Cannot extend session: Lounge is closed on ${bookingDateStr} (${effectiveDay.reason || 'Closed'}).`;
    } else if (effectiveDay.closeTime) {
      effectiveCloseTime = effectiveDay.closeTime;
    }
  } catch (e) {
    effectiveCloseTime = '23:00';
  }

  if (!exceedsClosingHours) {
    const [closeH, closeM] = effectiveCloseTime.split(':').map(Number);
    const [endHour, endMin] = newEndTime.split(':').map(Number);
    if (endHour > closeH || (endHour === closeH && endMin > closeM)) {
      exceedsClosingHours = true;
      closingHoursWarning = `Cannot extend session beyond lounge operating hours (Closes at ${effectiveCloseTime} IST).`;
    }
  }

  // Check physical device conflict during extension window
  const conflictingBookings = await Booking.find({
    device: booking.device._id,
    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] },
    _id: { $ne: booking._id },
    startAt: { $lt: newEndAt },
    endAt: { $gt: previousEndAt },
  }).populate('game');

  let hasConflict = false;
  let conflictWarning = null;

  const isExclusiveSession = Boolean(
    booking.game?.isExclusive ||
    booking.gameClassification === 'EXCLUSIVE' ||
    (booking.game?.name && /GTA/i.test(booking.game.name))
  );
  const isPrivateBooking = booking.bookingType === 'PRIVATE';

  if ((isPrivateBooking || isExclusiveSession) && conflictingBookings.length > 0) {
    hasConflict = true;
    const nextB = conflictingBookings[0];
    conflictWarning = `Station reserved by upcoming booking ${nextB.bookingId} starting at ${nextB.startTime}.`;
  } else if (!isPrivateBooking && !isExclusiveSession) {
    for (const conflict of conflictingBookings) {
      if (conflict.bookingType === 'PRIVATE' || (conflict.game && conflict.game.isExclusive)) {
        hasConflict = true;
        conflictWarning = `Station reserved by upcoming private booking ${conflict.bookingId} at ${conflict.startTime}.`;
        break;
      }
      const totalPlayers = (conflict.numberOfPlayers || 1) + booking.numberOfPlayers;
      if (totalPlayers > booking.device.capacity) {
        hasConflict = true;
        conflictWarning = `Capacity of ${booking.device.name} (${booking.device.capacity} players) would be exceeded during extension.`;
        break;
      }
    }
  }

  // Fetch customer's membership quota details
  const quota = await getCustomerMembershipQuota({
    customerId: booking.customer?._id,
    dateIST: booking.bookingDate,
  });

  // Calculate standard extension pricing
  const standardPricing = await calculateSessionPrice({
    deviceId: booking.device._id,
    gameId: booking.isVenueSelection ? null : (booking.game?._id || null),
    isVenueSelection: booking.isVenueSelection,
    durationMinutes: parsedDuration * 60,
    playersCount: booking.numberOfPlayers,
    customerId: booking.customer?._id,
    bookingDate: booking.bookingDate,
    startTime: previousEndTime,
    bookingType: booking.bookingType,
    applyMembershipBenefit: false, // Standard base rate without auto deduction
  });

  const rate = standardPricing.pricingRule.ratePerUnitRupees;
  const billingType = standardPricing.pricingRule.billingType;
  const billableUnits = billingType === 'PER_DEVICE_HOURLY' ? 1 : booking.numberOfPlayers;
  const standardUnitCostRupees = rate * billableUnits;

  let freeHoursApplied = 0;
  let paidDurationHours = parsedDuration;
  let additionalAmountRupees = standardPricing.totalAmountRupees;
  let additionalAmountPaise = standardPricing.totalAmountPaise;
  let membershipDiscountRupees = 0;
  let calculationFormula = '';

  const canUseFreeHours = Boolean(
    useMembershipFreeHours &&
    quota.isEligibleForFreeHours &&
    quota.remainingHours > 0 &&
    !isExclusiveSession
  );

  if (canUseFreeHours) {
    freeHoursApplied = Math.min(parsedDuration, quota.remainingHours);
    paidDurationHours = Math.max(0, parsedDuration - freeHoursApplied);
    additionalAmountRupees = Math.round(paidDurationHours * standardUnitCostRupees * 100) / 100;
    additionalAmountPaise = Math.round(additionalAmountRupees * 100);
    membershipDiscountRupees = Math.round(freeHoursApplied * standardUnitCostRupees * 100) / 100;

    if (freeHoursApplied > 0 && paidDurationHours > 0) {
      calculationFormula = `${freeHoursApplied}h Free (${quota.planName}) + ${paidDurationHours}h @ ₹${rate}/hr × ${billableUnits} = ₹${additionalAmountRupees}`;
    } else if (freeHoursApplied > 0 && paidDurationHours === 0) {
      calculationFormula = `${freeHoursApplied}h Free (${quota.planName}) = ₹0`;
    } else {
      calculationFormula = `₹${rate}/hr × ${parsedDuration}h × ${billableUnits} = ₹${additionalAmountRupees}`;
    }
  } else {
    // Option A: Cash / Counter Payment (0 free hours deducted)
    additionalAmountRupees = standardPricing.totalAmountRupees;
    additionalAmountPaise = standardPricing.totalAmountPaise;
    freeHoursApplied = 0;
    paidDurationHours = parsedDuration;
    membershipDiscountRupees = 0;
    if (billingType === 'PER_DEVICE_HOURLY') {
      calculationFormula = `₹${rate}/hr × ${parsedDuration}h = ₹${additionalAmountRupees} (Paid in Full)`;
    } else {
      calculationFormula = `₹${rate}/hr × ${parsedDuration}h × ${billableUnits} player${billableUnits > 1 ? 's' : ''} = ₹${additionalAmountRupees} (Paid in Full)`;
    }
  }

  const gameDisplayName = booking.isVenueSelection
    ? 'Select Game at Venue'
    : (booking.game?.name || booking.gameTitle || 'Game Not Selected');

  return {
    bookingId: booking.bookingId,
    sessionId: booking._id,
    customerName: booking.customer?.name || 'Walk-In Player',
    deviceName: booking.device.name,
    deviceCode: booking.device.deviceCode,
    deviceType: booking.device.deviceType,
    gameName: gameDisplayName,
    isExclusiveGame: isExclusiveSession,
    isGTA6: Boolean((booking.game?.name && /GTA/i.test(booking.game.name)) || (booking.gameTitle && /GTA/i.test(booking.gameTitle))),
    bookingType: booking.bookingType,
    bookingModeDisplay: booking.bookingType === 'PRIVATE' ? 'Private Session' : 'Shared Session',
    numberOfPlayers: booking.numberOfPlayers,
    billableUnits,
    previousEndTime,
    previousEndAt,
    newEndTime,
    newEndAt,
    extendedDurationHours: parsedDuration,
    hourlyRateRupees: rate,
    billingType,
    pricingRuleName: standardPricing.pricingRule.name,
    calculationFormula,
    additionalAmountPaise,
    additionalAmountRupees,
    membershipApplied: freeHoursApplied > 0,
    freeHoursApplied,
    paidDurationHours,
    membershipDiscountRupees,
    canExtend: !exceedsClosingHours && !hasConflict,
    warning: exceedsClosingHours ? closingHoursWarning : conflictWarning,
    quota,
    useMembershipFreeHours: Boolean(useMembershipFreeHours),
  };
}

/**
 * 10. Session Extension
 */
export async function extendSession({
  bookingId,
  extendedDurationHours,
  paymentMethod = 'CASH',
  paymentAmountPaise = 0,
  transactionReference = '',
  staffUser,
  notes = '',
  useMembershipFreeHours = false,
}) {
  const booking = await Booking.findById(bookingId).populate('customer device game');
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  if (!['ACTIVE', 'EXTENDED', 'TIME_EXPIRED', 'AWAITING_RECEPTIONIST'].includes(booking.sessionStatus)) {
    const err = new Error(`Cannot extend session with status '${booking.sessionStatus}'. Session must be active or awaiting extension.`);
    err.status = 400;
    throw err;
  }

  const parsedDuration = Number(extendedDurationHours);
  if (!parsedDuration || parsedDuration <= 0) {
    const err = new Error('Invalid extension duration. Must be greater than 0.');
    err.status = 400;
    throw err;
  }

  const previousEndAt = new Date(booking.endAt || new Date());
  const previousEndTime = booking.endTime || formatISTTime(previousEndAt);
  const newEndAt = new Date(previousEndAt.getTime() + parsedDuration * 3600 * 1000);
  const newEndTime = formatISTTime(newEndAt);

  // Check closing hours dynamically from schedule service
  const bookingDateStr = booking.bookingDate || formatISTDate(newEndAt);
  let effectiveCloseTime = '23:00';
  try {
    const effectiveDay = await scheduleService.getEffectiveDaySchedule(bookingDateStr);
    if (effectiveDay.isClosed) {
      const err = new Error(`Cannot extend session: Lounge is closed on ${bookingDateStr} (${effectiveDay.reason || 'Closed'}).`);
      err.status = 400;
      throw err;
    } else if (effectiveDay.closeTime) {
      effectiveCloseTime = effectiveDay.closeTime;
    }
  } catch (e) {
    if (e.status) throw e;
    effectiveCloseTime = '23:00';
  }

  const [closeH, closeM] = effectiveCloseTime.split(':').map(Number);
  const [endHour, endMin] = newEndTime.split(':').map(Number);
  if (endHour > closeH || (endHour === closeH && endMin > closeM)) {
    const err = new Error(`Cannot extend session beyond lounge operating hours (Closes at ${effectiveCloseTime} IST).`);
    err.status = 400;
    throw err;
  }

  // Check physical device conflict during the extension window
  const conflictingBookings = await Booking.find({
    device: booking.device._id,
    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] },
    _id: { $ne: booking._id },
    startAt: { $lt: newEndAt },
    endAt: { $gt: previousEndAt },
  }).populate('game');

  const isExclusiveSession = Boolean(
    booking.game?.isExclusive ||
    booking.gameClassification === 'EXCLUSIVE' ||
    (booking.game?.name && /GTA/i.test(booking.game.name))
  );
  const isPrivateBooking = booking.bookingType === 'PRIVATE';

  if ((isPrivateBooking || isExclusiveSession) && conflictingBookings.length > 0) {
    const nextB = conflictingBookings[0];
    const err = new Error(
      `Cannot extend ${booking.device.name}: Reserved by upcoming booking ${nextB.bookingId} starting at ${nextB.startTime}.`
    );
    err.status = 409;
    throw err;
  }

  if (!isPrivateBooking && !isExclusiveSession) {
    for (const conflict of conflictingBookings) {
      if (conflict.bookingType === 'PRIVATE' || (conflict.game && conflict.game.isExclusive)) {
        const err = new Error(
          `Cannot extend session: Upcoming private booking ${conflict.bookingId} occupies ${booking.device.name} at ${conflict.startTime}.`
        );
        err.status = 409;
        throw err;
      }
      const totalPlayers = (conflict.numberOfPlayers || 1) + booking.numberOfPlayers;
      if (totalPlayers > booking.device.capacity) {
        const err = new Error(
          `Cannot extend session: Capacity of ${booking.device.name} (${booking.device.capacity} players) would be exceeded during extension.`
        );
        err.status = 409;
        throw err;
      }
    }
  }

  // Pricing & Quota calculation
  const quota = await getCustomerMembershipQuota({
    customerId: booking.customer?._id,
    dateIST: booking.bookingDate,
  });

  const standardPricing = await calculateSessionPrice({
    deviceId: booking.device._id,
    gameId: booking.isVenueSelection ? null : (booking.game?._id || null),
    isVenueSelection: booking.isVenueSelection,
    durationMinutes: parsedDuration * 60,
    playersCount: booking.numberOfPlayers,
    customerId: booking.customer?._id,
    bookingDate: booking.bookingDate,
    startTime: previousEndTime,
    bookingType: booking.bookingType,
    applyMembershipBenefit: false,
  });

  const rate = standardPricing.pricingRule.ratePerUnitRupees;
  const billingType = standardPricing.pricingRule.billingType;
  const isPerPlayer = billingType === 'PER_PLAYER_HOURLY';
  const players = booking.numberOfPlayers || 1;
  const billableUnits = billingType === 'PER_DEVICE_HOURLY' ? 1 : players;
  const standardUnitCostRupees = rate * billableUnits;

  let freeHoursApplied = 0;
  let paidDurationHours = parsedDuration;
  let additionalAmountPaise = standardPricing.totalAmountPaise;

  const canApplyFreeHours = Boolean(
    useMembershipFreeHours &&
    quota.isEligibleForFreeHours &&
    quota.remainingHours > 0 &&
    !isExclusiveSession
  );

  if (canApplyFreeHours) {
    freeHoursApplied = Math.min(parsedDuration, quota.remainingHours);
    if (isPerPlayer && players > 1) {
      // 1 eligible member gets free hours applied to their seat; additional players pay configured per-player rate
      const memberCostRupees = Math.max(0, parsedDuration - freeHoursApplied) * rate;
      const otherPlayersCostRupees = (players - 1) * parsedDuration * rate;
      const paidAmountRupees = Math.round((memberCostRupees + otherPlayersCostRupees) * 100) / 100;
      additionalAmountPaise = Math.round(paidAmountRupees * 100);
    } else {
      paidDurationHours = Math.max(0, parsedDuration - freeHoursApplied);
      const paidAmountRupees = Math.round(paidDurationHours * standardUnitCostRupees * 100) / 100;
      additionalAmountPaise = Math.round(paidAmountRupees * 100);
    }

    // Record MembershipUsage for the free hours consumed
    if (freeHoursApplied > 0) {
      await MembershipUsage.create({
        customer: booking.customer._id,
        subscription: quota.subscriptionId,
        booking: booking._id,
        device: booking.device._id,
        game: booking.game?._id || null,
        usageDate: booking.bookingDate,
        startTime: previousEndTime,
        endTime: newEndTime,
        duration: Math.round(freeHoursApplied * 60),
        status: 'COMPLETED',
        notes: `Session extended +${parsedDuration}h using ${freeHoursApplied}h membership free allowance`,
      });
    }
  }

  const now = new Date();

  // Create extension record
  const extensionEntry = {
    extensionId: `EXT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    extendedDurationHours: parsedDuration,
    previousEndTime,
    newEndTime,
    previousEndAt,
    newEndAt,
    additionalAmountPaise,
    extendedBy: staffUser._id,
    extendedAt: now,
    notes: `${notes ? notes + ' | ' : ''}${freeHoursApplied > 0 ? `Used ${freeHoursApplied}h membership free quota` : 'Cash/Counter extension (quota untouched)'}`,
  };

  booking.extensions.push(extensionEntry);
  booking.duration += parsedDuration;
  booking.endTime = newEndTime;
  booking.endAt = newEndAt;
  booking.totalAmount += additionalAmountPaise;
  booking.balanceRemaining += additionalAmountPaise;
  booking.extensionTotalAmountPaise = (booking.extensionTotalAmountPaise || 0) + additionalAmountPaise;
  booking.sessionStatus = 'EXTENDED';

  // Record extension payment if collected at desk
  let paymentRecord = null;
  if (paymentAmountPaise > 0) {
    const payAmount = Math.min(paymentAmountPaise, booking.balanceRemaining);
    const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const receiptNumber = `REC-EXT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

    paymentRecord = await Payment.create({
      paymentId: internalPaymentId,
      receiptNumber,
      customer: booking.customer._id,
      booking: booking._id,
      collectedBy: staffUser._id,
      amount: payAmount,
      currency: 'INR',
      paymentMethod: paymentMethod === 'COUNTER_UPI' ? 'COUNTER_UPI' : 'CASH',
      paymentGateway: paymentMethod === 'COUNTER_UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
      paymentStatus: 'PAID',
      paymentPurpose: 'BOOKING_BALANCE',
      transactionReference: transactionReference || 'Counter Session Extension',
      paidAt: now,
      notes: `Extension payment for +${parsedDuration}h on ${booking.device.name}`,
    });

    booking.payments.push(paymentRecord._id);
    booking.amountPaid = (booking.amountPaid || 0) + payAmount;
    booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
    booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  }

  await booking.save();

  // Sync with GamingSession for Phase 8 automation
  let gamingSession = await GamingSession.findOne({ booking: booking._id });
  if (gamingSession) {
    gamingSession.scheduledEndAt = newEndAt;
    gamingSession.status = 'EXTENDED';
    gamingSession.extensionHistory.push({
      extendedAt: now,
      extendedDurationMinutes: parsedDuration * 60,
      extendedBy: staffUser._id,
      previousScheduledEndAt: previousEndAt,
      newScheduledEndAt: newEndAt,
      additionalAmountPaise,
    });
    // Reset reminders so that 15m, 5m, 1m warnings can trigger for the newly extended time
    gamingSession.reminderHistory = (gamingSession.reminderHistory || []).filter(
      (r) => !['15m', '5m', '1m'].includes(r.reminderType)
    );
    await gamingSession.save();
  }

  await logReceptionistActivity({
    staffUser,
    action: 'EXTEND_SESSION',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    paymentReference: paymentRecord?.receiptNumber || '',
    description: `Extended session ${booking.bookingId} by +${parsedDuration}h to ${newEndTime} (Added ₹${additionalAmountPaise / 100})`,
    details: {
      extendedDurationHours: parsedDuration,
      additionalAmountPaise,
      newEndTime,
    },
  });

  const updated = await Booking.findById(booking._id).populate('customer device game payments');

  if (paymentRecord && updated?.customer?.email) {
    sendPaymentSuccessEmail({
      payment: paymentRecord,
      customer: updated.customer,
      booking: updated,
      eventKey: `PAYMENT_SUCCESS_${paymentRecord._id}`,
    }).catch((e) => console.error('[Receptionist Extension Payment Email Error]:', e.message));
  }
  return {
    booking: updated,
    extension: extensionEntry,
    payment: paymentRecord,
  };
}

/**
 * 11. Complete Session
 */
export async function completeSession({
  bookingId,
  staffUser,
  paymentCollection,
  notes = '',
}) {
  const booking = await Booking.findById(bookingId).populate('customer device game payments');
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const now = new Date();

  // Collect any remaining balance if submitted
  let paymentRecord = null;
  if (paymentCollection && paymentCollection.amountPaise > 0) {
    const payAmount = Math.min(paymentCollection.amountPaise, booking.balanceRemaining);
    const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const receiptNumber = `REC-SETTLE-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

    paymentRecord = await Payment.create({
      paymentId: internalPaymentId,
      receiptNumber,
      customer: booking.customer._id,
      booking: booking._id,
      collectedBy: staffUser._id,
      amount: payAmount,
      currency: 'INR',
      paymentMethod: paymentCollection.paymentMethod === 'COUNTER_UPI' ? 'COUNTER_UPI' : 'CASH',
      paymentGateway: paymentCollection.paymentMethod === 'COUNTER_UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
      paymentStatus: 'PAID',
      paymentPurpose: 'BOOKING_BALANCE',
      transactionReference: paymentCollection.transactionReference || 'Checkout Settlement',
      paidAt: now,
      notes: `Final settlement collected at checkout by ${staffUser.name || 'Staff'}`,
    });

    booking.payments.push(paymentRecord._id);
    booking.amountPaid = (booking.amountPaid || 0) + payAmount;
    booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
    booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  }

  // Calculate actual duration in minutes
  const sessionStart = booking.sessionStartedAt || booking.startAt;
  const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - new Date(sessionStart).getTime()) / 60000));

  booking.sessionStatus = 'COMPLETED';
  booking.bookingStatus = 'COMPLETED';
  booking.sessionCompletedAt = now;
  booking.sessionCompletedBy = staffUser._id;
  booking.actualDurationMinutes = actualDurationMinutes;
  if (notes) {
    booking.notes = `${booking.notes ? `${booking.notes} | ` : ''}Completion Note: ${notes}`;
  }

  await booking.save();

  // Update membership usage if membership applied
  if (booking.membershipApplied && booking.customer) {
    const todayIST = formatISTDate(now);
    await MembershipUsage.create({
      customer: booking.customer._id,
      booking: booking._id,
      device: booking.device._id,
      game: booking.game?._id || null,
      usageDate: todayIST,
      startTime: booking.startTime,
      endTime: formatISTTime(now),
      duration: actualDurationMinutes,
      status: 'COMPLETED',
      notes: `Completed gaming session on ${booking.device.name}`,
    });
  }

  // Complete GamingSession(s) comprehensively to prevent ghost/zombie active timers
  const gamingSessions = await GamingSession.find({
    $or: [
      { booking: booking._id },
      { customer: booking.customer._id, device: booking.device._id, status: { $ne: 'COMPLETED' } },
    ],
  });
  for (const gs of gamingSessions) {
    gs.status = 'COMPLETED';
    gs.actualEndAt = now;
    gs.completedBy = staffUser._id;
    await gs.save();
  }

  await logReceptionistActivity({
    staffUser,
    action: 'COMPLETE_SESSION',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    paymentReference: paymentRecord?.receiptNumber || '',
    description: `Completed gaming session ${booking.bookingId} (${actualDurationMinutes} mins actual duration)`,
    details: {
      actualDurationMinutes,
      balanceRemainingPaise: booking.balanceRemaining,
    },
  });

  const updated = await Booking.findById(booking._id).populate('customer device game payments');

  if (paymentRecord && updated?.customer?.email) {
    sendPaymentSuccessEmail({
      payment: paymentRecord,
      customer: updated.customer,
      booking: updated,
      eventKey: `PAYMENT_SUCCESS_${paymentRecord._id}`,
    }).catch((e) => console.error('[Receptionist Settlement Payment Email Error]:', e.message));
  }
  return {
    booking: updated,
    payment: paymentRecord,
  };
}

/**
 * 12. Counter Offline Payment Collection
 */
export async function collectReceptionistOfflinePayment({
  bookingId,
  amountPaise,
  paymentMethod = 'CASH',
  transactionReference = '',
  staffUser,
  notes = '',
}) {
  const booking = await Booking.findById(bookingId).populate('customer device game payments');
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const payAmount = Number(amountPaise);
  if (!payAmount || payAmount <= 0) {
    const err = new Error('Payment amount must be greater than 0.');
    err.status = 400;
    throw err;
  }

  if (booking.balanceRemaining <= 0) {
    const err = new Error('This booking has no outstanding balance.');
    err.status = 400;
    throw err;
  }

  const actualPay = Math.min(payAmount, booking.balanceRemaining);
  const now = new Date();
  const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
  const receiptNumber = `REC-COUNTER-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

  const paymentRecord = await Payment.create({
    paymentId: internalPaymentId,
    receiptNumber,
    customer: booking.customer._id,
    booking: booking._id,
    collectedBy: staffUser._id,
    amount: actualPay,
    currency: 'INR',
    paymentMethod: paymentMethod === 'COUNTER_UPI' ? 'COUNTER_UPI' : 'CASH',
    paymentGateway: paymentMethod === 'COUNTER_UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
    paymentStatus: 'PAID',
    paymentPurpose: 'BOOKING_BALANCE',
    transactionReference: transactionReference || 'Front Desk Cash/UPI',
    paidAt: now,
    notes: notes || `Offline payment collected at reception counter by ${staffUser.name || 'Staff'}`,
    auditTrail: [
      {
        status: 'PAID',
        changedBy: staffUser._id,
        reason: `Collected ₹${actualPay / 100} via ${paymentMethod}`,
        timestamp: now,
      },
    ],
  });

  booking.payments.push(paymentRecord._id);
  booking.amountPaid = (booking.amountPaid || 0) + actualPay;
  booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
  booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';

  await booking.save();

  await logReceptionistActivity({
    staffUser,
    action: 'COLLECT_PAYMENT',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    paymentReference: receiptNumber,
    description: `Collected counter payment of ₹${actualPay / 100} (${paymentMethod}) for booking ${booking.bookingId}`,
    details: {
      amountPaise: actualPay,
      paymentMethod,
      balanceRemainingPaise: booking.balanceRemaining,
    },
  });

  // Generate structured receipt
  const receiptDoc = generateReceipt({
    payment: paymentRecord,
    booking,
    customer: booking.customer,
  });

  if (paymentRecord && booking?.customer?.email) {
    sendPaymentSuccessEmail({
      payment: paymentRecord,
      customer: booking.customer,
      booking,
      eventKey: `PAYMENT_SUCCESS_${paymentRecord._id}`,
    }).catch((e) => console.error('[Receptionist Counter Payment Email Error]:', e.message));
  }

  return {
    payment: paymentRecord,
    booking,
    receipt: receiptDoc.receiptData,
  };
}

/**
 * 13. Receptionist Activity Logs (Admin Only)
 */
export async function getReceptionistActivityLogs({
  staffId = null,
  action = null,
  startDate = null,
  endDate = null,
  limit = 50,
  page = 1,
}) {
  const query = {
    $or: [{ category: 'RECEPTIONIST' }, { userRole: 'receptionist' }],
  };

  if (staffId) query.userId = staffId;
  if (action) query.action = action;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const parsedLimit = Math.min(100, Math.max(1, Number(limit)));
  const parsedPage = Math.max(1, Number(page));
  const skip = (parsedPage - 1) * parsedLimit;

  const [logs, total] = await Promise.all([
    ActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
    ActivityLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit),
  };
}

/**
 * 14. Get Today's Bookings with Search & Filters
 */
export async function getTodayBookings({ search = '', status = '', checkInStatus = '' } = {}) {
  const todayIST = formatISTDate(new Date());
  const query = {
    bookingDate: todayIST,
  };

  if (status) {
    query.bookingStatus = status;
  }
  if (checkInStatus) {
    query.checkInStatus = checkInStatus;
  }

  let bookings = await Booking.find(query)
    .populate('customer device game payments')
    .sort({ startTime: 1, createdAt: -1 });

  if (search && search.trim()) {
    const cleanS = search.trim().toLowerCase();
    bookings = bookings.filter((b) => {
      const matchId = b.bookingId?.toLowerCase().includes(cleanS);
      const matchName = b.customer?.name?.toLowerCase().includes(cleanS);
      const matchPhone = b.customer?.phone?.includes(cleanS);
      const matchDevice = b.device?.name?.toLowerCase().includes(cleanS);
      const matchGame = b.game?.name?.toLowerCase().includes(cleanS);
      return matchId || matchName || matchPhone || matchDevice || matchGame;
    });
  }

  return bookings;
}

/**
 * 15. Get Upcoming Bookings
 */
export async function getUpcomingBookings({ limit = 50 } = {}) {
  const now = new Date();
  const todayIST = formatISTDate(now);

  const bookings = await Booking.find({
    bookingDate: { $gte: todayIST },
    bookingStatus: 'CONFIRMED',
    checkInStatus: { $ne: 'NO_SHOW' },
    endAt: { $gt: now },
  })
    .populate('customer device game payments')
    .sort({ startAt: 1 })
    .limit(limit);

  return bookings;
}

/**
 * 16. Get Single Booking Details for Front Desk
 */
export async function getBookingDetailsForReceptionist(bookingId) {
  const booking = await Booking.findOne({
    $or: [{ bookingId: bookingId.toUpperCase() }, { _id: bookingId }],
  }).populate('customer device game payments');

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  return booking;
}

/**
 * 17. Get Pending Payments List
 */
export async function getPendingPaymentsList() {
  const bookings = await Booking.find({
    bookingStatus: { $nin: ['CANCELLED'] },
    balanceRemaining: { $gt: 0 },
  })
    .populate('customer device game payments')
    .sort({ bookingDate: -1, startTime: -1 })
    .limit(100);

  return bookings;
}

