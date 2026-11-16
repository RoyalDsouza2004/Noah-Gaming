import mongoose from 'mongoose';
import GamingSession from '../models/GamingSession.js';
import Booking from '../models/Booking.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';
import { formatISTTime, formatISTDate } from '../utils/timeSlots.js';
import { createNotification } from './notification.service.js';
import { logReceptionistActivity } from './receptionist.service.js';

/**
 * Returns all active, extended, and awaiting receptionist sessions
 * Computes authoritative server-side remaining time.
 */
export async function getActiveSessions({ customerId = null } = {}) {
  const query = {
    status: { $in: ['ACTIVE', 'EXTENDED', 'TIME_EXPIRED', 'AWAITING_RECEPTIONIST'] },
  };

  if (customerId) {
    query.customer = customerId;
  }

  const sessions = await GamingSession.find(query)
    .populate('customer', 'name email phone avatar')
    .populate('device', 'name deviceCode deviceType capacity')
    .populate('game', 'name thumbnail isExclusive')
    .populate({
      path: 'booking',
      select: 'bookingId bookingDate startTime endTime duration numberOfPlayers bookingType totalAmount amountPaid balanceRemaining paymentStatus isWalkIn',
    })
    .sort({ scheduledEndAt: 1 });

  const now = Date.now();

  return sessions.map((sess) => {
    const endMs = new Date(sess.scheduledEndAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));
    const isOverdue = now >= endMs;

    return {
      id: sess._id,
      sessionId: sess._id,
      booking: sess.booking,
      customer: sess.customer,
      device: sess.device,
      game: sess.game,
      startedAt: sess.startedAt,
      scheduledEndAt: sess.scheduledEndAt,
      actualEndAt: sess.actualEndAt,
      status: isOverdue && sess.status === 'ACTIVE' ? 'AWAITING_RECEPTIONIST' : sess.status,
      remainingSeconds,
      isOverdue,
      lastReminderSent: sess.lastReminderSent,
      extensionHistory: sess.extensionHistory || [],
    };
  });
}

/**
 * Fetches a session by ID
 */
export async function getSessionById(sessionId) {
  let session = null;
  if (mongoose.Types.ObjectId.isValid(sessionId)) {
    session = await GamingSession.findById(sessionId)
      .populate('customer', 'name email phone')
      .populate('device', 'name deviceCode deviceType capacity')
      .populate('game', 'name thumbnail isExclusive')
      .populate('booking')
      .populate('completedBy', 'name email');
  }

  // Also check if sessionId was a booking ID
  if (!session) {
    const booking = await Booking.findOne({
      $or: [{ bookingId: sessionId.toUpperCase() }, { _id: sessionId }],
    });
    if (booking) {
      session = await GamingSession.findOne({ booking: booking._id })
        .populate('customer', 'name email phone')
        .populate('device', 'name deviceCode deviceType capacity')
        .populate('game', 'name thumbnail isExclusive')
        .populate('booking')
        .populate('completedBy', 'name email');
    }
  }

  if (!session) {
    const err = new Error('Gaming session not found');
    err.status = 404;
    throw err;
  }

  const now = Date.now();
  const endMs = new Date(session.scheduledEndAt).getTime();
  const remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));

  return {
    ...session.toObject(),
    remainingSeconds,
    isOverdue: now >= endMs && session.status !== 'COMPLETED',
  };
}

/**
 * Starts a session given a Booking ID
 */
export async function startGamingSession({ bookingId, staffUser }) {
  const booking = await Booking.findById(bookingId).populate('customer device game');
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  if (booking.bookingStatus === 'CANCELLED') {
    const err = new Error('Cannot start a cancelled booking');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const durationHours = booking.duration || 1;
  const scheduledEndAt = new Date(now.getTime() + durationHours * 3600 * 1000);

  // Update booking
  booking.sessionStatus = 'ACTIVE';
  booking.sessionStartedAt = now;
  booking.sessionStartedBy = staffUser._id;
  if (booking.checkInStatus !== 'CHECKED_IN') {
    booking.checkInStatus = 'CHECKED_IN';
    booking.checkedInAt = now;
    booking.checkedInBy = staffUser._id;
  }
  await booking.save();

  // Create or Update GamingSession
  let session = await GamingSession.findOne({ booking: booking._id });
  if (!session) {
    session = new GamingSession({
      booking: booking._id,
      customer: booking.customer._id,
      device: booking.device._id,
      game: booking.game?._id || null,
      startedAt: now,
      scheduledEndAt,
      status: 'ACTIVE',
    });
  } else {
    session.startedAt = now;
    session.scheduledEndAt = scheduledEndAt;
    session.status = 'ACTIVE';
    session.actualEndAt = null;
    session.lastReminderSent = null;
  }
  await session.save();

  // Audit activity
  await logReceptionistActivity({
    staffUser,
    action: 'START_SESSION',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    description: `Started active gaming timer for ${booking.bookingId} on ${booking.device?.name}`,
  });

  // Notify customer
  await createNotification({
    recipient: booking.customer._id,
    recipientRole: 'customer',
    title: 'Gaming Session Started! 🎮',
    message: `Your gaming session on ${booking.device?.name} has officially started. Scheduled duration: ${durationHours} hour(s). Have a blast!`,
    category: 'SESSION_STARTED',
    relatedBooking: booking._id,
    relatedSession: session._id,
    deliveryChannels: ['IN_APP', 'WHATSAPP'],
    idempotencyKey: `SESSION_START_${session._id}`,
  });

  // Notify receptionist staff
  await createNotification({
    recipient: staffUser._id,
    recipientRole: 'receptionist',
    title: 'Live Session Started',
    message: `Session ${booking.bookingId} (${booking.device?.name}) started by ${staffUser.name}.`,
    category: 'SESSION_STARTED',
    relatedBooking: booking._id,
    relatedSession: session._id,
    deliveryChannels: ['IN_APP'],
  });

  return await getSessionById(session._id);
}

/**
 * Extends an active gaming session with conflict and operating hours validation
 */
export async function extendGamingSession({
  sessionId,
  extendedDurationHours,
  paymentMethod = 'CASH',
  paymentAmountPaise = 0,
  transactionReference = '',
  staffUser,
  notes = '',
}) {
  const session = await GamingSession.findById(sessionId).populate('customer device game booking');
  if (!session) {
    const err = new Error('Gaming session not found');
    err.status = 404;
    throw err;
  }

  if (!['ACTIVE', 'EXTENDED', 'AWAITING_RECEPTIONIST', 'TIME_EXPIRED'].includes(session.status)) {
    const err = new Error(`Cannot extend session with status '${session.status}'`);
    err.status = 400;
    throw err;
  }

  const parsedDuration = Number(extendedDurationHours);
  if (!parsedDuration || parsedDuration <= 0) {
    const err = new Error('Invalid extension duration. Must be greater than 0.');
    err.status = 400;
    throw err;
  }

  const previousEndAt = new Date(session.scheduledEndAt);
  const newEndAt = new Date(previousEndAt.getTime() + parsedDuration * 3600 * 1000);
  const newEndTime = formatISTTime(newEndAt);

  // Check closing hours (23:00 IST)
  const [endH, endM] = newEndTime.split(':').map(Number);
  if (endH > 23 || (endH === 23 && endM > 0)) {
    const err = new Error(
      `Cannot extend session beyond lounge operating closing hours (23:00 IST). Extended end time would be ${newEndTime}.`
    );
    err.status = 409;
    throw err;
  }

  const booking = await Booking.findById(session.booking._id).populate('device game');

  // Conflict check with future bookings on this physical device
  const conflict = await Booking.findOne({
    _id: { $ne: booking._id },
    device: booking.device._id,
    bookingStatus: { $in: ['CONFIRMED', 'PENDING'] },
    startAt: { $lt: newEndAt },
    endAt: { $gt: previousEndAt },
  });

  if (conflict) {
    const err = new Error(
      `Device conflict detected: ${booking.device.name} is reserved by another booking (${conflict.bookingId}) starting at ${conflict.startTime} IST.`
    );
    err.status = 409;
    throw err;
  }

  // Calculate pricing for extension
  const pricingResult = await calculateSessionPrice({
    deviceId: booking.device._id,
    gameId: booking.game?._id || null,
    playersCount: booking.numberOfPlayers || 1,
    durationMinutes: Math.round(parsedDuration * 60),
  });

  const additionalAmountPaise = pricingResult.totalAmountPaise || pricingResult.finalPricePaise || 0;

  // Handle immediate payment if provided
  if (paymentAmountPaise > 0) {
    const now = new Date();
    const paymentId = `PAY-EXT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const payment = await Payment.create({
      paymentId,
      receiptNumber: `REC-EXT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`,
      customer: booking.customer,
      booking: booking._id,
      collectedBy: staffUser._id,
      amount: paymentAmountPaise,
      currency: 'INR',
      paymentMethod: paymentMethod === 'COUNTER_UPI' ? 'COUNTER_UPI' : 'CASH',
      paymentGateway: paymentMethod === 'COUNTER_UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
      paymentStatus: 'PAID',
      paymentPurpose: 'WALKIN_OFFLINE',
      transactionReference: transactionReference || 'Extension Settlement',
      paidAt: now,
      notes: `Extension payment of ₹${paymentAmountPaise / 100} collected by ${staffUser.name}`,
    });

    booking.payments.push(payment._id);
    booking.amountPaid = (booking.amountPaid || 0) + paymentAmountPaise;
  }

  // Update Booking
  booking.endAt = newEndAt;
  booking.endTime = newEndTime;
  booking.duration = (booking.duration || 1) + parsedDuration;
  booking.totalAmount = (booking.totalAmount || 0) + additionalAmountPaise;
  booking.balanceRemaining = Math.max(0, booking.totalAmount - (booking.amountPaid || 0));
  booking.sessionStatus = 'EXTENDED';
  booking.extensions.push({
    extensionId: `EXT-${Date.now()}`,
    extendedDurationHours: parsedDuration,
    previousEndTime: formatISTTime(previousEndAt),
    newEndTime,
    previousEndAt,
    newEndAt,
    additionalAmountPaise,
    extendedBy: staffUser._id,
    extendedAt: new Date(),
    notes,
  });
  await booking.save();

  // Update GamingSession
  session.scheduledEndAt = newEndAt;
  session.status = 'EXTENDED';
  session.lastReminderSent = null; // Reset reminder tracking so 15m/5m/1m reminders trigger on the extended time!
  session.extensionHistory.push({
    extensionId: `EXT-${Date.now()}`,
    extendedDurationHours: parsedDuration,
    previousEndAt,
    newEndAt,
    extendedAt: new Date(),
    extendedBy: staffUser._id,
    additionalAmountPaise,
    notes,
  });
  await session.save();

  // Audit log
  await logReceptionistActivity({
    staffUser,
    action: 'EXTEND_SESSION',
    bookingId: booking.bookingId,
    customerId: booking.customer,
    description: `Extended session for ${booking.bookingId} by ${parsedDuration} hr(s) until ${newEndTime} IST`,
  });

  // Notify customer
  await createNotification({
    recipient: booking.customer,
    recipientRole: 'customer',
    title: 'Session Extended! ⏱️',
    message: `Your gaming session on ${booking.device?.name} has been extended by ${parsedDuration} hr(s). New end time is ${newEndTime} IST.`,
    category: 'SESSION_EXTENDED',
    relatedBooking: booking._id,
    relatedSession: session._id,
    deliveryChannels: ['IN_APP', 'WHATSAPP'],
  });

  return await getSessionById(session._id);
}

/**
 * Completes an active or expired gaming session upon receptionist confirmation
 * Releases device availability.
 */
export async function completeGamingSession({
  sessionId,
  staffUser,
  paymentCollection = null,
  notes = '',
}) {
  const session = await GamingSession.findById(sessionId).populate('customer device game booking');
  if (!session) {
    const err = new Error('Gaming session not found');
    err.status = 404;
    throw err;
  }

  const booking = await Booking.findById(session.booking._id).populate('customer device game payments');
  const now = new Date();

  // Collect any remaining balance if submitted
  if (paymentCollection && paymentCollection.amountPaise > 0) {
    const payAmount = Math.min(paymentCollection.amountPaise, booking.balanceRemaining);
    const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const receiptNumber = `REC-SETTLE-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

    const paymentRecord = await Payment.create({
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

  // Calculate actual duration
  const sessionStart = session.startedAt || booking.sessionStartedAt || booking.startAt;
  const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - new Date(sessionStart).getTime()) / 60000));

  // Update Booking
  booking.sessionStatus = 'COMPLETED';
  booking.bookingStatus = 'COMPLETED';
  booking.sessionCompletedAt = now;
  booking.sessionCompletedBy = staffUser._id;
  booking.actualDurationMinutes = actualDurationMinutes;
  booking.notes = notes ? `${booking.notes ? booking.notes + ' | ' : ''}${notes}` : booking.notes;
  await booking.save();

  // Update GamingSession
  session.status = 'COMPLETED';
  session.actualEndAt = now;
  session.completedBy = staffUser._id;
  session.notes = notes;
  await session.save();

  // Audit activity
  await logReceptionistActivity({
    staffUser,
    action: 'COMPLETE_SESSION',
    bookingId: booking.bookingId,
    customerId: booking.customer._id,
    description: `Session completed for ${booking.bookingId} on ${booking.device?.name}. Actual duration: ${actualDurationMinutes} mins.`,
  });

  // Notify customer
  await createNotification({
    recipient: booking.customer._id,
    recipientRole: 'customer',
    title: 'Session Completed 🎉',
    message: `Your gaming session on ${booking.device?.name} has finished. Thank you for gaming with NOAH GAMING!`,
    category: 'SESSION_COMPLETED',
    relatedBooking: booking._id,
    relatedSession: session._id,
    deliveryChannels: ['IN_APP', 'WHATSAPP'],
  });

  return {
    success: true,
    message: `Session for booking ${booking.bookingId} completed successfully. Device ${booking.device?.name} is now released and available.`,
    session: await getSessionById(session._id),
  };
}
