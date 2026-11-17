import mongoose from 'mongoose';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipUpgrade from '../models/MembershipUpgrade.js';
import MembershipEntitlement from '../models/MembershipEntitlement.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import Game from '../models/Game.js';
import Device from '../models/Device.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  getRazorpayKeyId,
} from './razorpay.service.js';
import { generateReceipt } from '../utils/receiptGenerator.js';
import { createNotification } from './notification.service.js';
import {
  sendMembershipActivationEmail,
  sendMembershipExpiryReminderEmail,
} from './email.service.js';

/** IST timezone constant */
const TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +5:30

/**
 * Returns the current date string in IST (YYYY-MM-DD)
 */
function getTodayIST() {
  const utcNow = new Date();
  const istNow = new Date(utcNow.getTime() + IST_OFFSET_MS);
  return istNow.toISOString().split('T')[0];
}

/**
 * Returns the number of IST calendar days between today and a target date string.
 * Positive = target is in the future.
 */
function getDaysDifferenceFromTodayIST(targetDateStr) {
  const todayIST = getTodayIST();
  const todayParts = todayIST.split('-').map(Number);
  const targetParts = targetDateStr.split('-').map(Number);
  const todayMs = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const targetMs = Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2]);
  return Math.round((targetMs - todayMs) / (24 * 60 * 60 * 1000));
}

/**
 * Validates whether a customer is allowed to book on the given date
 * based on their active membership plan's advance booking limit.
 *
 * Returns { allowed: true, advanceBookingLimit } or throws an error.
 */
export async function validateCustomerAdvanceBooking({ customerId, bookingDate }) {
  if (!customerId || !bookingDate) return { allowed: true, advanceBookingLimit: null };

  // Find the customer's active subscription
  const customer = await User.findById(customerId).lean();
  if (!customer || !customer.membership || customer.membership.status !== 'ACTIVE') {
    // Non-members: no advance booking restriction from membership
    return { allowed: true, advanceBookingLimit: null };
  }

  const subscription = await MembershipSubscription.findById(customer.membership.subscriptionId)
    .populate('membershipPlan')
    .lean();

  if (!subscription || subscription.status !== 'ACTIVE') {
    return { allowed: true, advanceBookingLimit: null };
  }

  const plan = subscription.membershipPlan;
  if (!plan || !plan.advanceBookingLimit) {
    return { allowed: true, advanceBookingLimit: null };
  }

  const advanceBookingLimit = Number(plan.advanceBookingLimit);
  const diffDays = getDaysDifferenceFromTodayIST(bookingDate);

  if (diffDays > advanceBookingLimit) {
    const err = new Error(
      `Your ${plan.name} membership allows booking up to ${advanceBookingLimit} day(s) in advance. ` +
      `The requested date (${bookingDate}) is ${diffDays} day(s) ahead.`
    );
    err.status = 400;
    err.code = 'ADVANCE_BOOKING_LIMIT_EXCEEDED';
    throw err;
  }

  return { allowed: true, advanceBookingLimit };
}

/**
 * Atomically reserve the daily free-hour entitlement for a customer.
 *
 * Uses a unique index on `entitlementKey` to prevent concurrent double-use.
 * Returns the entitlement document if reserved, or throws an appropriate error.
 *
 * @param {Object} params
 * @param {string} params.customerId
 * @param {string} params.subscriptionId
 * @param {string} params.bookingDate  - IST date string YYYY-MM-DD
 * @param {string} [params.bookingId]  - booking _id being created
 * @param {string} [params.idempotencyKey]
 */
export async function reserveDailyFreeHour({
  customerId,
  subscriptionId,
  bookingDate,
  bookingId = null,
  idempotencyKey = null,
}) {
  const entitlementKey = `${customerId}_${subscriptionId}_${bookingDate}_DAILY_FREE_HOUR`;
  const reservationExpiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 min reservation window

  // Idempotency: if same idempotency key already reserved, return existing reservation
  if (idempotencyKey) {
    const existing = await MembershipEntitlement.findOne({
      entitlementKey,
      idempotencyKey,
      state: { $in: ['RESERVED', 'CONSUMED'] },
    });
    if (existing) {
      return existing;
    }
  }

  // Check if already CONSUMED today
  const consumed = await MembershipEntitlement.findOne({
    entitlementKey,
    state: 'CONSUMED',
  });
  if (consumed) {
    const err = new Error('Your daily free-hour benefit has already been used today.');
    err.status = 409;
    err.code = 'ENTITLEMENT_CONSUMED';
    throw err;
  }

  // Check if there's a valid (non-expired) RESERVED entry by someone else
  const activeReservation = await MembershipEntitlement.findOne({
    entitlementKey,
    state: 'RESERVED',
    reservationExpiresAt: { $gt: new Date() },
  });
  if (activeReservation) {
    // If this is the same booking, return it (idempotent)
    if (bookingId && activeReservation.booking?.toString() === bookingId.toString()) {
      return activeReservation;
    }
    const err = new Error(
      'Your daily free-hour benefit is currently reserved by another booking in progress. ' +
      'Please wait a moment and try again.'
    );
    err.status = 409;
    err.code = 'ENTITLEMENT_RESERVED';
    throw err;
  }

  // Atomic upsert: either create a new RESERVED entitlement or recover an expired one
  try {
    // First try to recover an expired/released reservation via findOneAndUpdate
    let entitlement = await MembershipEntitlement.findOneAndUpdate(
      {
        entitlementKey,
        state: { $in: ['RELEASED'] },
      },
      {
        $set: {
          state: 'RESERVED',
          booking: bookingId,
          idempotencyKey,
          reservationExpiresAt,
          finalizedAt: null,
          releaseReason: '',
        },
      },
      { new: true }
    );

    if (!entitlement) {
      // Also try to claim an expired RESERVED (past expiry)
      entitlement = await MembershipEntitlement.findOneAndUpdate(
        {
          entitlementKey,
          state: 'RESERVED',
          reservationExpiresAt: { $lte: new Date() },
        },
        {
          $set: {
            state: 'RESERVED',
            booking: bookingId,
            idempotencyKey,
            reservationExpiresAt,
            finalizedAt: null,
            releaseReason: '',
          },
        },
        { new: true }
      );
    }

    if (!entitlement) {
      // Create new reservation
      entitlement = await MembershipEntitlement.create({
        entitlementKey,
        customer: customerId,
        subscription: subscriptionId,
        membershipDate: bookingDate,
        entitlementType: 'DAILY_FREE_HOUR',
        state: 'RESERVED',
        booking: bookingId,
        idempotencyKey,
        reservationExpiresAt,
      });
    }

    return entitlement;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key — another concurrent request won the race
      const conflictErr = new Error(
        'Your daily free-hour benefit has already been claimed by a simultaneous booking request. ' +
        'Only one free session can be reserved at a time.'
      );
      conflictErr.status = 409;
      conflictErr.code = 'ENTITLEMENT_CONFLICT';
      throw conflictErr;
    }
    throw err;
  }
}

/**
 * Transition a RESERVED entitlement to CONSUMED (booking confirmed).
 */
export async function consumeDailyFreeHour({ entitlementId, bookingId }) {
  const updated = await MembershipEntitlement.findOneAndUpdate(
    {
      _id: entitlementId,
      state: 'RESERVED',
    },
    {
      $set: {
        state: 'CONSUMED',
        booking: bookingId,
        finalizedAt: new Date(),
        reservationExpiresAt: null,
      },
    },
    { new: true }
  );

  if (!updated) {
    // If already CONSUMED (idempotent), just return
    const existing = await MembershipEntitlement.findById(entitlementId);
    if (existing && existing.state === 'CONSUMED') return existing;

    const err = new Error('Entitlement reservation not found or already finalized');
    err.status = 409;
    throw err;
  }
  return updated;
}

/**
 * Release a RESERVED entitlement (payment failed, booking cancelled, etc.)
 */
export async function releaseDailyFreeHour({ entitlementId, bookingId, reason = '' }) {
  if (!entitlementId) return null;

  const updated = await MembershipEntitlement.findOneAndUpdate(
    {
      _id: entitlementId,
      state: 'RESERVED',
    },
    {
      $set: {
        state: 'RELEASED',
        finalizedAt: new Date(),
        releaseReason: reason || 'Booking failed or cancelled',
        reservationExpiresAt: null,
      },
    },
    { new: true }
  );
  return updated;
}

/**
 * Calculates Expiration Date from start date, duration, and unit in IST
 */
export function calculateExpirationDate(startDate, duration, unit = 'DAYS') {
  const date = new Date(startDate);
  const dur = Number(duration) || 30;

  switch (unit.toUpperCase()) {
    case 'YEARS':
      date.setFullYear(date.getFullYear() + dur);
      break;
    case 'MONTHS':
      date.setMonth(date.getMonth() + dur);
      break;
    case 'DAYS':
    default:
      date.setDate(date.getDate() + dur);
      break;
  }
  return date;
}

/**
 * Generates unique subscription reference ID
 */
export function generateSubscriptionId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `SUB-${dateStr}-${rand}`;
}

/**
 * Creates Razorpay order for online membership purchase or renewal
 */
export async function createSubscriptionOrder({
  customerId,
  planId,
  renewalSubscriptionId = null,
}) {
  const customer = await User.findById(customerId);
  if (!customer) {
    const error = new Error('Customer account not found');
    error.status = 404;
    throw error;
  }

  const plan = await MembershipPlan.findById(planId);
  if (!plan || plan.status !== 'ACTIVE') {
    const error = new Error('Membership plan is invalid or inactive');
    error.status = 400;
    throw error;
  }

  const amountInPaise = Math.round(Number(plan.price));
  const isRenewal = !!renewalSubscriptionId;
  const receiptTag = `MBR_${plan._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;

  const order = await createRazorpayOrder({
    amount: amountInPaise,
    currency: plan.currency || 'INR',
    receipt: receiptTag,
    notes: {
      customerId: customer._id.toString(),
      planId: plan._id.toString(),
      isRenewal: isRenewal.toString(),
      renewalSubscriptionId: renewalSubscriptionId || '',
      planName: plan.name,
      business: 'NOAH GAMING',
    },
  });

  // Create pending Payment record
  const internalPaymentId = `PAY-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const pendingPayment = new Payment({
    paymentId: internalPaymentId,
    customer: customer._id,
    membershipPlan: plan._id,
    paymentPurpose: isRenewal ? 'MEMBERSHIP_RENEWAL' : 'MEMBERSHIP_NEW',
    paymentGateway: 'RAZORPAY',
    paymentMethod: 'UPI',
    gatewayOrderId: order.id,
    amount: amountInPaise,
    currency: 'INR',
    paymentStatus: 'PENDING',
    metadata: {
      razorpayOrder: order,
      planId: plan._id,
      planName: plan.name,
      isRenewal,
      renewalSubscriptionId,
      mode: 'test',
    },
    auditTrail: [
      {
        status: 'PENDING',
        changedBy: customer._id,
        reason: 'Razorpay order created for membership subscription (Test Mode)',
        timestamp: new Date(),
      },
    ],
  });
  await pendingPayment.save();

  return {
    orderId: order.id,
    amount: amountInPaise,
    amountInRupees: amountInPaise / 100,
    currency: order.currency || 'INR',
    keyId: getRazorpayKeyId(),
    paymentId: pendingPayment.paymentId,
    plan: {
      id: plan._id,
      name: plan.name,
      validityDuration: plan.validityDuration,
      validityUnit: plan.validityUnit,
      isUnlimited: plan.isUnlimited,
    },
    paymentPurpose: isRenewal ? 'MEMBERSHIP_RENEWAL' : 'MEMBERSHIP_NEW',
    isTestMode: true,
    businessName: 'NOAH GAMING',
  };
}

/**
 * Cryptographically verifies Razorpay payment and activates membership subscription
 */
export async function verifyMembershipPayment({
  orderId,
  paymentId,
  signature,
  userId,
  renewalSubscriptionId = null,
  planId = null,
}) {
  // 1. Verify signature
  const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!isValid) {
    // Record failed payment
    await Payment.create({
      paymentId: `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: userId,
      paymentPurpose: renewalSubscriptionId ? 'MEMBERSHIP_RENEWAL' : 'MEMBERSHIP_NEW',
      paymentGateway: 'RAZORPAY',
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignatureVerified: false,
      amount: 0,
      paymentStatus: 'FAILED',
      notes: 'Invalid cryptographic signature on membership purchase',
      auditTrail: [
        {
          status: 'FAILED',
          changedBy: userId,
          reason: 'Invalid cryptographic signature',
          timestamp: new Date(),
        },
      ],
    });

    const error = new Error('Invalid payment signature. Membership activation rejected.');
    error.status = 400;
    throw error;
  }

  // 2. Prevent duplicate processing
  const existingPayment = await Payment.findOne({
    gatewayOrderId: orderId,
    gatewayPaymentId: paymentId,
    paymentStatus: 'PAID',
  });
  if (existingPayment) {
    const existingSub = await MembershipSubscription.findOne({ payment: existingPayment._id })
      .populate('membershipPlan');
    return {
      alreadyProcessed: true,
      subscription: existingSub,
      payment: existingPayment,
    };
  }

  // 3. Find customer and plan
  const customer = await User.findById(userId);
  let renewalSub = null;
  if (renewalSubscriptionId) {
    renewalSub = await MembershipSubscription.findById(renewalSubscriptionId);
  }

  let plan = null;
  if (planId) {
    plan = await MembershipPlan.findById(planId);
  }
  if (!plan && renewalSub) {
    plan = await MembershipPlan.findById(renewalSub.membershipPlan);
  }
  if (!plan && customer.membership?.planId) {
    plan = await MembershipPlan.findById(customer.membership.planId);
  }
  if (!plan) {
    plan = await MembershipPlan.findOne({ status: 'ACTIVE' });
  }

  if (!plan) {
    throw new Error('No valid membership plan found for subscription activation');
  }

  const now = new Date();
  let startDate = now;
  let previousExpirationDate = null;

  // If renewing an active subscription, extend from its current expiration date
  if (renewalSub && renewalSub.status === 'ACTIVE' && renewalSub.expirationDate > now) {
    startDate = renewalSub.expirationDate;
    previousExpirationDate = renewalSub.expirationDate;
  }

  const expirationDate = calculateExpirationDate(startDate, plan.validityDuration, plan.validityUnit);

  // 4. Record verified Payment
  const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
  let paymentRecord = await Payment.findOne({ gatewayOrderId: orderId });

  if (paymentRecord) {
    paymentRecord.gatewayPaymentId = paymentId;
    paymentRecord.gatewaySignatureVerified = true;
    paymentRecord.paymentStatus = 'PAID';
    paymentRecord.paidAt = now;
    if (!paymentRecord.receiptNumber) {
      paymentRecord.receiptNumber = receiptNumber;
    }
    paymentRecord.auditTrail.push({
      status: 'PAID',
      changedBy: customer._id,
      reason: `Activated ${plan.name} through Razorpay Order ${orderId} (Test Mode)`,
      timestamp: now,
    });
    await paymentRecord.save();
  } else {
    const internalPaymentId = `PAY-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    paymentRecord = await Payment.create({
      paymentId: internalPaymentId,
      receiptNumber,
      customer: customer._id,
      membershipPlan: plan._id,
      paymentPurpose: renewalSub ? 'MEMBERSHIP_RENEWAL' : 'MEMBERSHIP_NEW',
      paymentGateway: 'RAZORPAY',
      paymentMethod: 'UPI',
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignatureVerified: true,
      amount: plan.price,
      currency: plan.currency || 'INR',
      paymentStatus: 'PAID',
      paidAt: now,
      auditTrail: [
        {
          status: 'PAID',
          changedBy: customer._id,
          reason: `Activated ${plan.name} through Razorpay Order ${orderId} (Test Mode)`,
          timestamp: now,
        },
      ],
    });
  }

  // 5. Create or Update MembershipSubscription
  let subscription = null;
  if (renewalSub) {
    renewalSub.expirationDate = expirationDate;
    renewalSub.status = 'ACTIVE';
    renewalSub.renewalHistory.push({
      renewedAt: now,
      previousExpirationDate: previousExpirationDate || renewalSub.expirationDate,
      newExpirationDate: expirationDate,
      payment: paymentRecord._id,
      renewedBy: customer._id,
      notes: `Renewed online via Razorpay (${orderId})`,
    });
    await renewalSub.save();
    subscription = renewalSub;
  } else {
    subscription = await MembershipSubscription.create({
      subscriptionId: generateSubscriptionId(),
      customer: customer._id,
      membershipPlan: plan._id,
      purchaseDate: now,
      startDate: now,
      expirationDate,
      status: 'ACTIVE',
      payment: paymentRecord._id,
      paymentReference: paymentRecord.paymentId,
      notes: `Online purchase via Razorpay (Order ${orderId})`,
    });
  }

  // Link subscription to payment
  paymentRecord.membershipSubscription = subscription._id;
  await paymentRecord.save();

  // 6. Update User profile membership status
  customer.membership = {
    status: 'ACTIVE',
    planId: plan._id,
    planName: plan.name,
    planPrice: plan.price,
    subscriptionId: subscription._id,
    expiresAt: expirationDate,
    dailyUsageMinutesUsed: 0,
    lastUsageDate: '',
    remainingHours: plan.dailyUsageLimit ? Math.round(plan.dailyUsageLimit / 60) : 999,
  };
  await customer.save();

  // 7. Send in-app notification
  await createNotification({
    recipient: customer._id,
    title: renewalSub ? 'Membership Renewed!' : 'Membership Activated!',
    message: `Your ${plan.name} is now ACTIVE until ${expirationDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    category: renewalSub ? 'MEMBERSHIP_RENEWED' : 'MEMBERSHIP_ACTIVATED',
    data: {
      subscriptionId: subscription.subscriptionId,
      planName: plan.name,
      expirationDate,
    },
  });

  // 8. Send Membership Activation Email
  if (customer.email) {
    sendMembershipActivationEmail({
      membership: subscription,
      user: customer,
      plan,
      eventKey: `MEMBERSHIP_ACTIVATION_${subscription._id}`,
    }).catch((emailErr) => console.error('[Membership Activation Email Error]:', emailErr.message));
  }

  return {
    subscription,
    payment: paymentRecord,
    customer: customer.toSafeObject(),
  };
}

/**
 * Records offline membership purchase at front desk (Cash or Counter UPI)
 */
export async function recordOfflineMembershipPurchase({
  customerId,
  planId,
  amount,
  paymentMethod = 'CASH',
  transactionReference = '',
  staffId,
  notes = '',
}) {
  const customer = await User.findById(customerId);
  if (!customer) {
    const error = new Error('Customer account not found');
    error.status = 404;
    throw error;
  }

  const plan = await MembershipPlan.findById(planId);
  if (!plan || plan.status !== 'ACTIVE') {
    const error = new Error('Membership plan is invalid or inactive');
    error.status = 400;
    throw error;
  }

  const staff = await User.findById(staffId);
  if (!staff || (staff.role !== 'admin' && staff.role !== 'receptionist')) {
    const error = new Error('Unauthorized staff member');
    error.status = 403;
    throw error;
  }

  const amountInPaise = Math.round(Number(amount) * 100);
  const now = new Date();
  const startDate = now;
  const expirationDate = calculateExpirationDate(startDate, plan.validityDuration, plan.validityUnit);

  const internalPaymentId = `PAY-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

  const paymentRecord = await Payment.create({
    paymentId: internalPaymentId,
    receiptNumber,
    customer: customer._id,
    membershipPlan: plan._id,
    paymentPurpose: 'MEMBERSHIP_NEW',
    paymentGateway: paymentMethod === 'CASH' ? 'OFFLINE_CASH' : 'OFFLINE_COUNTER_UPI',
    paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'COUNTER_UPI',
    transactionReference: transactionReference || `OFFLINE-${Date.now()}`,
    amount: amountInPaise,
    currency: plan.currency || 'INR',
    paymentStatus: 'PAID',
    collectedBy: staff._id,
    paidAt: now,
    notes: notes || 'Front desk offline membership registration',
    auditTrail: [
      {
        status: 'PAID',
        changedBy: staff._id,
        reason: `Collected ₹${amount} via ${paymentMethod} by ${staff.name} (${staff.role})`,
        timestamp: now,
      },
    ],
  });

  const subscription = await MembershipSubscription.create({
    subscriptionId: generateSubscriptionId(),
    customer: customer._id,
    membershipPlan: plan._id,
    purchaseDate: now,
    startDate,
    expirationDate,
    status: 'ACTIVE',
    payment: paymentRecord._id,
    paymentReference: internalPaymentId,
    notes: `Offline counter purchase: ${notes || 'Registered at reception desk'}`,
  });

  paymentRecord.membershipSubscription = subscription._id;
  await paymentRecord.save();

  customer.membership = {
    status: 'ACTIVE',
    planId: plan._id,
    subscriptionId: subscription._id,
    expiresAt: expirationDate,
    dailyUsageMinutesUsed: 0,
    lastUsageDate: '',
    remainingHours: plan.dailyUsageLimit ? Math.round(plan.dailyUsageLimit / 60) : 999,
  };
  await customer.save();

  await createNotification({
    recipient: customer._id,
    title: 'Membership Activated!',
    message: `Your ${plan.name} has been activated at the front desk. Valid until ${expirationDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    category: 'MEMBERSHIP_ACTIVATED',
    data: {
      subscriptionId: subscription.subscriptionId,
      receiptNumber,
    },
  });

  if (customer.email) {
    sendMembershipActivationEmail({
      membership: subscription,
      user: customer,
      plan,
      eventKey: `MEMBERSHIP_ACTIVATION_${subscription._id}`,
    }).catch((emailErr) => console.error('[Offline Membership Activation Email Error]:', emailErr.message));
  }

  return {
    subscription,
    payment: paymentRecord,
    customer: customer.toSafeObject(),
  };
}

/**
 * Checks if a customer's active membership covers a requested booking session
 * Evaluates: device coverage, game coverage, GTA 6 exclusive rules, session duration, daily usage limits
 */
export async function checkMembershipBookingCoverage({
  customerId,
  deviceId,
  gameId = null,
  bookingDate,
  startTime,
  durationHours = 1,
  numberOfPlayers = 1,
  bookingType = 'SHARED',
}) {
  const customer = await User.findById(customerId);
  if (!customer) {
    return { covered: false, reason: 'Customer account not found' };
  }

  // 1. Check if user has an active membership
  if (
    !customer.membership ||
    customer.membership.status !== 'ACTIVE' ||
    !customer.membership.subscriptionId
  ) {
    return { covered: false, reason: 'No active membership subscription' };
  }

  // 2. Check if membership has expired
  const now = new Date();
  if (customer.membership.expiresAt && customer.membership.expiresAt < now) {
    customer.membership.status = 'EXPIRED';
    await customer.save();
    return { covered: false, reason: 'Membership subscription has expired' };
  }

  const subscription = await MembershipSubscription.findById(customer.membership.subscriptionId)
    .populate('membershipPlan');

  if (!subscription || subscription.status !== 'ACTIVE' || subscription.expirationDate < now) {
    return { covered: false, reason: 'Membership subscription is not active or has expired' };
  }

  const plan = subscription.membershipPlan;
  if (!plan || plan.status !== 'ACTIVE') {
    return { covered: false, reason: 'Membership plan is not active' };
  }

  // 3. Check Device Eligibility
  if (plan.eligibleDevices && plan.eligibleDevices.length > 0) {
    const isDeviceEligible = plan.eligibleDevices.some(
      (d) => (d._id || d).toString() === deviceId.toString()
    );
    if (!isDeviceEligible) {
      return {
        covered: false,
        reason: `Station is not eligible under your '${plan.name}' membership.`,
      };
    }
  }

  // 4. Check Game Eligibility & GTA 6 Exclusive Rules
  let game = null;
  if (gameId) {
    game = await Game.findById(gameId);
  }

  if (game) {
    // CRITICAL: Exclusive Game Rule (GTA 6)
    if (game.isExclusive || game.name === 'GTA 6') {
      if (!plan.includesExclusiveGames) {
        return {
          covered: false,
          isExclusiveExcluded: true,
          reason: `GTA 6 is an exclusive release and is not covered under '${plan.name}'. Standard ₹150/hr booking & advance payment applies.`,
        };
      }
    }

    if (plan.eligibleGames && plan.eligibleGames.length > 0) {
      const isGameEligible = plan.eligibleGames.some(
        (g) => (g._id || g).toString() === game._id.toString()
      );
      if (!isGameEligible) {
        return {
          covered: false,
          reason: `Game '${game.name}' is not covered under your '${plan.name}' membership.`,
        };
      }
    }
  }

  // 5. Check Mode Eligibility (Shared vs Private)
  if (bookingType === 'PRIVATE' && !plan.privateBookingAllowed) {
    return {
      covered: false,
      reason: `'${plan.name}' only covers shared station gameplay. Private console lock requires regular booking.`,
    };
  }

  // 6. Check Continuous Session Duration Cap
  const requestedDurationMinutes = durationHours * 60;
  if (plan.maximumSessionDuration && requestedDurationMinutes > plan.maximumSessionDuration) {
    return {
      covered: false,
      reason: `Requested duration (${durationHours}h) exceeds the maximum continuous session limit of ${plan.maximumSessionDuration / 60}h allowed under '${plan.name}'.`,
    };
  }

  // 7. Check Daily Usage Limit & Bookings per Day for the requested date
  const dayUsages = await MembershipUsage.find({
    customer: customer._id,
    usageDate: bookingDate,
    status: { $ne: 'CANCELLED' },
  });

  if (plan.maximumBookingsPerDay && dayUsages.length >= plan.maximumBookingsPerDay) {
    return {
      covered: false,
      reason: `Daily booking limit (${plan.maximumBookingsPerDay} sessions/day) reached for ${bookingDate}.`,
    };
  }

  const minutesAlreadyUsed = dayUsages.reduce((sum, u) => sum + (u.duration || 0), 0);
  if (plan.dailyUsageLimit && plan.dailyUsageLimit > 0) {
    if (minutesAlreadyUsed + requestedDurationMinutes > plan.dailyUsageLimit) {
      const remainingMinutes = Math.max(0, plan.dailyUsageLimit - minutesAlreadyUsed);
      return {
        covered: false,
        reason: `Daily gaming allowance exceeded. Plan allows ${plan.dailyUsageLimit / 60}h/day (${remainingMinutes} mins remaining on ${bookingDate}).`,
      };
    }
  }

  // 8. Check if free-hour entitlement is available today (atomic check via MembershipEntitlement)
  const entitlementKey = `${customer._id}_${subscription._id}_${bookingDate}_DAILY_FREE_HOUR`;
  const existingEntitlement = await MembershipEntitlement.findOne({
    entitlementKey,
    state: { $in: ['RESERVED', 'CONSUMED'] },
  });

  let freeHourAvailable = true;
  let entitlementState = null;

  if (existingEntitlement) {
    if (existingEntitlement.state === 'CONSUMED') {
      freeHourAvailable = false;
      entitlementState = 'CONSUMED';
    } else if (existingEntitlement.state === 'RESERVED') {
      // Check if reservation is still valid (not expired)
      if (existingEntitlement.reservationExpiresAt && existingEntitlement.reservationExpiresAt > new Date()) {
        freeHourAvailable = false;
        entitlementState = 'RESERVED';
      }
      // If expired, treat as available (recovery path)
    }
  }

  // Calculate how many free minutes are available
  const dailyUsageLimitMins = plan.dailyUsageLimit || 60; // default 1 hour
  const freeMinutesAvailable = freeHourAvailable ? Math.min(dailyUsageLimitMins - minutesAlreadyUsed, dailyUsageLimitMins) : 0;

  // All eligibility checks passed!
  return {
    covered: true,
    plan: {
      id: plan._id,
      name: plan.name,
      isUnlimited: plan.isUnlimited,
      discountPercentage: plan.discountPercentage || 100,
      dailyUsageLimit: plan.dailyUsageLimit || 60,
      advanceBookingLimit: plan.advanceBookingLimit || null,
    },
    subscription: {
      id: subscription._id,
      subscriptionId: subscription.subscriptionId,
      expirationDate: subscription.expirationDate,
    },
    minutesAlreadyUsedToday: minutesAlreadyUsed,
    remainingMinutesToday: plan.dailyUsageLimit ? Math.max(0, plan.dailyUsageLimit - minutesAlreadyUsed) : 9999,
    freeHourAvailable,
    freeMinutesAvailable,
    entitlementState,
    entitlementKey,
  };
}

/**
 * Returns customer membership quota details including daily allowance,
 * used today, and remaining free hours.
 */
export async function getCustomerMembershipQuota({ customerId, dateIST = null }) {
  if (!customerId) {
    return {
      isMember: false,
      status: 'NONE',
      planName: null,
      dailyAllowanceHours: 0,
      dailyAllowanceMinutes: 0,
      usedTodayHours: 0,
      usedTodayMinutes: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      freeHoursAvailable: false,
      isEligibleForFreeHours: false,
      expirationDate: null,
      isExpired: false,
    };
  }

  const customer = await User.findById(customerId).populate('membership.planId');
  if (!customer) {
    return {
      isMember: false,
      status: 'NONE',
      planName: null,
      dailyAllowanceHours: 0,
      dailyAllowanceMinutes: 0,
      usedTodayHours: 0,
      usedTodayMinutes: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      freeHoursAvailable: false,
      isEligibleForFreeHours: false,
      expirationDate: null,
      isExpired: false,
    };
  }

  const now = new Date();
  const targetDate = dateIST || getTodayIST();

  // Find active subscription
  let subscription = null;
  if (customer.membership?.subscriptionId) {
    subscription = await MembershipSubscription.findById(customer.membership.subscriptionId).populate('membershipPlan');
  }

  if (!subscription) {
    subscription = await MembershipSubscription.findOne({
      customer: customer._id,
      status: 'ACTIVE',
    }).populate('membershipPlan');
  }

  const isExpired = Boolean(
    (customer.membership?.expiresAt && customer.membership.expiresAt < now) ||
    (subscription && subscription.expirationDate && subscription.expirationDate < now)
  );

  const isActive = Boolean(
    !isExpired &&
    (customer.membership?.status === 'ACTIVE' || (subscription && subscription.status === 'ACTIVE'))
  );

  if (!isActive) {
    return {
      isMember: Boolean(subscription || customer.membership?.planId),
      status: isExpired ? 'EXPIRED' : (customer.membership?.status || 'NONE'),
      planName: subscription?.membershipPlan?.name || customer.membership?.planId?.name || null,
      dailyAllowanceHours: 0,
      dailyAllowanceMinutes: 0,
      usedTodayHours: 0,
      usedTodayMinutes: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      freeHoursAvailable: false,
      isEligibleForFreeHours: false,
      expirationDate: subscription?.expirationDate || customer.membership?.expiresAt || null,
      isExpired,
    };
  }

  const plan = subscription?.membershipPlan || customer.membership?.planId;
  const dailyAllowanceMinutes = plan?.dailyUsageLimit || 120; // default 2 hours if not specified
  const dailyAllowanceHours = Math.round((dailyAllowanceMinutes / 60) * 10) / 10;

  // Calculate used minutes today
  const todayUsages = await MembershipUsage.find({
    customer: customer._id,
    usageDate: targetDate,
    status: { $ne: 'CANCELLED' },
  });

  const usedTodayMinutes = todayUsages.reduce((sum, u) => sum + (u.duration || 0), 0);
  const usedTodayHours = Math.round((usedTodayMinutes / 60) * 10) / 10;

  const remainingMinutes = Math.max(0, dailyAllowanceMinutes - usedTodayMinutes);
  const remainingHours = Math.round((remainingMinutes / 60) * 10) / 10;

  return {
    isMember: true,
    status: 'ACTIVE',
    subscriptionId: subscription?._id || customer.membership?.subscriptionId,
    planId: plan?._id,
    planName: plan?.name || 'Membership',
    dailyAllowanceMinutes,
    dailyAllowanceHours,
    usedTodayMinutes,
    usedTodayHours,
    remainingMinutes,
    remainingHours,
    freeHoursAvailable: remainingMinutes > 0,
    isEligibleForFreeHours: remainingMinutes > 0,
    expirationDate: subscription?.expirationDate || customer.membership?.expiresAt,
    expiresAtIST: (subscription?.expirationDate || customer.membership?.expiresAt)
      ? new Date(subscription?.expirationDate || customer.membership?.expiresAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      : null,
    isExpired: false,
  };
}

/**
 * Records membership usage for a confirmed booking
 */
export async function recordMembershipUsage({ booking, customerId, subscriptionId }) {
  try {
    const durationMinutes = Math.round((booking.duration || 1) * 60);

    const usage = await MembershipUsage.create({
      customer: customerId,
      subscription: subscriptionId,
      booking: booking._id,
      device: booking.device,
      game: booking.game || null,
      usageDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      duration: durationMinutes,
      status: 'ACTIVE',
      notes: `Session covered under membership subscription`,
    });

    // Update booking reference
    booking.membershipApplied = true;
    booking.membershipSubscription = subscriptionId;
    booking.membershipUsage = usage._id;
    await booking.save();

    return usage;
  } catch (err) {
    console.error('[Record Membership Usage Error]:', err.message);
    return null;
  }
}

/**
 * Releases membership usage when a booking is cancelled
 */
export async function releaseMembershipUsage({ bookingId }) {
  try {
    const usage = await MembershipUsage.findOneAndUpdate(
      { booking: bookingId, status: { $ne: 'CANCELLED' } },
      { status: 'CANCELLED', notes: 'Booking cancelled before session execution' },
      { new: true }
    );
    return usage;
  } catch (err) {
    console.error('[Release Membership Usage Error]:', err.message);
    return null;
  }
}

/**
 * Customer Renews Active or Expired Subscription
 */
export async function renewSubscription({ subscriptionId, customerId }) {
  const subscription = await MembershipSubscription.findOne({
    _id: subscriptionId,
    customer: customerId,
  }).populate('membershipPlan');

  if (!subscription) {
    const error = new Error('Subscription not found');
    error.status = 404;
    throw error;
  }

  return createSubscriptionOrder({
    customerId,
    planId: subscription.membershipPlan._id,
    renewalSubscriptionId: subscription._id,
  });
}

/**
 * Admin Manages Subscription (Suspend, Reactivate, Cancel, Extend Days)
 */
export async function adminUpdateSubscription({
  subscriptionId,
  status,
  extendDays = 0,
  notes = '',
  adminId,
}) {
  const subscription = await MembershipSubscription.findById(subscriptionId).populate(
    'membershipPlan customer'
  );
  if (!subscription) {
    const error = new Error('Subscription not found');
    error.status = 404;
    throw error;
  }

  const previousStatus = subscription.status;
  const previousExpiration = subscription.expirationDate;

  if (status) {
    subscription.status = status;
  }

  if (extendDays && Number(extendDays) > 0) {
    const newExp = new Date(subscription.expirationDate);
    newExp.setDate(newExp.getDate() + Number(extendDays));
    subscription.expirationDate = newExp;
  }

  subscription.renewalHistory.push({
    renewedAt: new Date(),
    previousExpirationDate: previousExpiration,
    newExpirationDate: subscription.expirationDate,
    renewedBy: adminId,
    notes: `Admin Action: ${status || 'Extended'} (${notes || 'Administrative modification'})`,
  });

  await subscription.save();

  // Sync customer user record
  const customer = await User.findById(subscription.customer._id);
  if (customer) {
    customer.membership.status = subscription.status;
    customer.membership.expiresAt = subscription.expirationDate;
    await customer.save();

    // Trigger notification
    const notifType =
      status === 'SUSPENDED'
        ? 'MEMBERSHIP_SUSPENDED'
        : status === 'ACTIVE'
        ? 'MEMBERSHIP_REACTIVATED'
        : 'SYSTEM';

    await createNotification({
      recipient: customer._id,
      title: `Membership ${subscription.status}!`,
      message: `Your membership has been updated by administration: ${notes || subscription.status}.`,
      category: notifType,
      data: {
        subscriptionId: subscription.subscriptionId,
        newExpiration: subscription.expirationDate,
      },
    });
  }

  return subscription;
}

/**
 * Background sweep: expires subscriptions whose expiration date is in the past
 */
export async function checkAndExpireSubscriptions() {
  const now = new Date();
  try {
    const expiredSubs = await MembershipSubscription.find({
      status: 'ACTIVE',
      expirationDate: { $lt: now },
    });

    for (const sub of expiredSubs) {
      sub.status = 'EXPIRED';
      await sub.save();

      await User.findByIdAndUpdate(sub.customer, {
        'membership.status': 'EXPIRED',
      });

      await createNotification({
        recipient: sub.customer,
        title: 'Membership Expired',
        message: 'Your membership subscription has expired. Renew today to continue enjoying exclusive gaming perks!',
        category: 'MEMBERSHIP_EXPIRED',
        data: { subscriptionId: sub.subscriptionId },
      });
    }

    if (expiredSubs.length > 0) {
      console.log(`[Membership Sweep] Marked ${expiredSubs.length} subscriptions as EXPIRED.`);
    }

    // Sweep for passes expiring in 3 days and dispatch expiry reminders
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoonSubs = await MembershipSubscription.find({
      status: 'ACTIVE',
      expirationDate: { $gt: now, $lte: threeDaysFromNow },
    }).populate('customer');

    for (const sub of expiringSoonSubs) {
      if (sub.customer && sub.customer.email) {
        const expiryDateKey = sub.expirationDate.toISOString().slice(0, 10);
        sendMembershipExpiryReminderEmail({
          membership: sub,
          user: sub.customer,
          eventKey: `MEMBERSHIP_EXPIRY_REMINDER_${sub._id}_${expiryDateKey}`,
        }).catch((err) => console.error('[Expiry Reminder Email Error]:', err.message));
      }
    }
  } catch (err) {
    console.error('[Membership Sweep Error]:', err.message);
  }
}

/**
 * Generates unique upgrade transaction reference ID
 */
export function generateUpgradeTransactionId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `UPG-${dateStr}-${rand}`;
}

/**
 * Retrieves membership plans strictly eligible for upgrade
 * (Higher tier only, strictly excluding current plan and lower-priced plans)
 */
export async function getEligibleUpgradePlans({ customerId }) {
  const customer = await User.findById(customerId);
  if (!customer) {
    const error = new Error('Customer account not found');
    error.status = 404;
    throw error;
  }

  const currentSub = await MembershipSubscription.findOne({
    customer: customerId,
    status: 'ACTIVE',
    expirationDate: { $gt: new Date() },
  }).populate('membershipPlan');

  if (!currentSub || !currentSub.membershipPlan) {
    return {
      currentPlan: null,
      eligiblePlans: [],
      reason: 'No active eligible subscription to upgrade.',
    };
  }

  const currentPlan = currentSub.membershipPlan;

  // Only higher priced / higher tier plans are eligible
  const eligiblePlans = await MembershipPlan.find({
    status: 'ACTIVE',
    price: { $gt: currentPlan.price },
    _id: { $ne: currentPlan._id },
  }).sort({ price: 1 });

  // Calculate instant quotes for each eligible plan
  const plansWithQuotes = [];
  for (const plan of eligiblePlans) {
    try {
      const quote = await calculateUpgradeQuote({ customerId, targetPlanId: plan._id });
      plansWithQuotes.push({
        ...plan.toObject(),
        upgradeQuote: quote.financials,
      });
    } catch {
      plansWithQuotes.push(plan.toObject());
    }
  }

  return {
    currentPlan: {
      id: currentPlan._id,
      name: currentPlan.name,
      price: currentPlan.price,
      subscriptionId: currentSub.subscriptionId,
      startDate: currentSub.startDate,
      expirationDate: currentSub.expirationDate,
    },
    eligiblePlans: plansWithQuotes,
  };
}

/**
 * Calculates time-based prorated upgrade credit & final amount payable
 * Formula:
 * Unused Credit = Original Membership Amount × (Remaining Eligible Days / Total Membership Days)
 * Upgrade Amount = New Membership Price − Unused Membership Credit
 */
export async function calculateUpgradeQuote({ customerId, targetPlanId }) {
  const customer = await User.findById(customerId);
  if (!customer) {
    const error = new Error('Customer account not found');
    error.status = 404;
    throw error;
  }

  const now = new Date();

  // Find active, unexpired subscription
  const currentSub = await MembershipSubscription.findOne({
    customer: customerId,
    status: 'ACTIVE',
    expirationDate: { $gt: now },
  }).populate('membershipPlan payment');

  if (!currentSub || !currentSub.membershipPlan) {
    const error = new Error('No active eligible subscription found to upgrade from.');
    error.status = 400;
    throw error;
  }

  const currentPlan = currentSub.membershipPlan;
  const targetPlan = await MembershipPlan.findById(targetPlanId);

  if (!targetPlan || targetPlan.status !== 'ACTIVE') {
    const error = new Error('Selected target membership plan is not available.');
    error.status = 404;
    throw error;
  }

  if (targetPlan._id.toString() === currentPlan._id.toString()) {
    const error = new Error('Cannot upgrade to your current active plan.');
    error.status = 400;
    throw error;
  }

  if (targetPlan.price <= currentPlan.price) {
    const error = new Error('Upgrade plan must be of a higher tier/price than your current plan.');
    error.status = 400;
    throw error;
  }

  // Calculate day-based proration
  const totalDurationDays =
    currentPlan.validityUnit === 'DAYS' && currentPlan.validityDuration
      ? currentPlan.validityDuration
      : Math.max(1, Math.round((currentSub.expirationDate.getTime() - currentSub.startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const remainingMs = currentSub.expirationDate.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.min(totalDurationDays, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))));

  // Credit calculation in integer paise
  const originalAmountPaise = currentSub.payment?.amount || currentPlan.price;
  const unusedCreditPaise = Math.round((originalAmountPaise * remainingDays) / totalDurationDays);
  const newPricePaise = targetPlan.price;
  const finalAmountPayablePaise = Math.max(0, newPricePaise - unusedCreditPaise);

  return {
    customer: {
      id: customer._id,
      name: customer.name,
      customerId: customer.customerId,
    },
    currentSubscription: {
      id: currentSub._id,
      subscriptionId: currentSub.subscriptionId,
      planId: currentPlan._id,
      planName: currentPlan.name,
      originalPricePaise: originalAmountPaise,
      startDate: currentSub.startDate,
      expirationDate: currentSub.expirationDate,
      totalValidityDays: totalDurationDays,
      remainingEligibleDays: remainingDays,
    },
    targetPlan: {
      id: targetPlan._id,
      name: targetPlan.name,
      pricePaise: newPricePaise,
      validityDuration: targetPlan.validityDuration,
      validityUnit: targetPlan.validityUnit,
    },
    financials: {
      originalAmountPaise,
      originalAmountRupees: +(originalAmountPaise / 100).toFixed(2),
      totalValidityDays: totalDurationDays,
      remainingEligibleDays: remainingDays,
      unusedCreditPaise,
      unusedCreditRupees: +(unusedCreditPaise / 100).toFixed(2),
      newPlanPricePaise: newPricePaise,
      newPlanPriceRupees: +(newPricePaise / 100).toFixed(2),
      finalAmountPayablePaise,
      finalAmountPayableRupees: +(finalAmountPayablePaise / 100).toFixed(2),
    },
  };
}

/**
 * Initiates an upgrade order and creates PENDING MembershipUpgrade record
 */
export async function createUpgradeOrder({ customerId, targetPlanId }) {
  const quote = await calculateUpgradeQuote({ customerId, targetPlanId });

  // Cancel any prior PENDING upgrade attempts by this customer to avoid duplicate reuse
  await MembershipUpgrade.updateMany(
    { customer: customerId, upgradeStatus: 'PENDING' },
    { $set: { upgradeStatus: 'CANCELLED', notes: 'Superseded by new upgrade request' } }
  );

  const upgradeTransactionId = generateUpgradeTransactionId();

  const upgradeRecord = await MembershipUpgrade.create({
    upgradeTransactionId,
    customer: customerId,
    previousSubscription: quote.currentSubscription.id,
    previousPlan: quote.currentSubscription.planId,
    newPlan: quote.targetPlan.id,
    originalMembershipAmount: quote.financials.originalAmountPaise,
    remainingEligibleDays: quote.financials.remainingEligibleDays,
    totalValidityDays: quote.financials.totalValidityDays,
    calculatedUnusedCredit: quote.financials.unusedCreditPaise,
    newMembershipPrice: quote.financials.newPlanPricePaise,
    finalAmountPayable: quote.financials.finalAmountPayablePaise,
    upgradeStatus: 'PENDING',
    notes: `Prorated upgrade from ${quote.currentSubscription.planName} to ${quote.targetPlan.name}`,
  });

  // If final amount is 0, complete atomically without payment gateway
  if (quote.financials.finalAmountPayablePaise === 0) {
    return completeUpgradeZeroAmount({ upgradeRecord, quote });
  }

  // Create Razorpay order for the remaining amount payable
  const rzpOrder = await createRazorpayOrder({
    amount: quote.financials.finalAmountPayablePaise,
    currency: 'INR',
    receipt: upgradeTransactionId,
    notes: {
      upgradeTransactionId,
      customerId: customerId.toString(),
      targetPlanId: targetPlanId.toString(),
    },
  });

  upgradeRecord.paymentReference = rzpOrder.id;
  await upgradeRecord.save();

  return {
    order: {
      ...rzpOrder,
      keyId: getRazorpayKeyId(),
      isTestMode: true,
      businessName: 'NOAH GAMING',
    },
    upgrade: upgradeRecord,
    quote,
  };
}

/**
 * Completes an upgrade when amount payable is 0
 */
async function completeUpgradeZeroAmount({ upgradeRecord, quote }) {
  const now = new Date();
  const targetPlan = await MembershipPlan.findById(upgradeRecord.newPlan);
  const expirationDate = calculateExpirationDate(now, targetPlan.validityDuration, targetPlan.validityUnit);

  // Archive old subscription
  const oldSub = await MembershipSubscription.findById(upgradeRecord.previousSubscription);
  if (oldSub) {
    oldSub.status = 'UPGRADED';
    await oldSub.save();
  }

  // Create new active subscription
  const newSub = await MembershipSubscription.create({
    subscriptionId: generateSubscriptionId(),
    customer: quote.customer.id,
    membershipPlan: targetPlan._id,
    purchaseDate: now,
    startDate: now,
    expirationDate,
    status: 'ACTIVE',
    payment: null,
    paymentReference: upgradeRecord.upgradeTransactionId,
    notes: `Upgraded from ${quote.currentSubscription.planName} (Zero net balance)`,
  });

  if (oldSub) {
    oldSub.upgradedTo = newSub._id;
    await oldSub.save();
  }

  upgradeRecord.upgradeStatus = 'COMPLETED';
  upgradeRecord.completedAt = now;
  await upgradeRecord.save();

  // Update customer user model
  await User.findByIdAndUpdate(quote.customer.id, {
    'membership.status': 'ACTIVE',
    'membership.planId': targetPlan._id,
    'membership.subscriptionId': newSub._id,
    'membership.expiresAt': expirationDate,
    'membership.dailyUsageMinutesUsed': 0,
    'membership.lastUsageDate': '',
    'membership.remainingHours': targetPlan.dailyUsageLimit ? Math.round(targetPlan.dailyUsageLimit / 60) : 999,
  });

  await createNotification({
    recipient: quote.customer.id,
    title: 'Membership Upgraded!',
    message: `Your membership has been upgraded to ${targetPlan.name} valid until ${expirationDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    category: 'MEMBERSHIP_ACTIVATED',
    data: {
      subscriptionId: newSub.subscriptionId,
      planName: targetPlan.name,
      expirationDate,
    },
  });

  return {
    success: true,
    subscription: newSub,
    upgrade: upgradeRecord,
    quote,
  };
}

/**
 * Cryptographically verifies Razorpay payment for membership upgrade
 */
export async function verifyMembershipUpgradePayment({
  customerId,
  upgradeTransactionId,
  razorpayPaymentId,
  razorpayOrderId,
  razorpaySignature,
}) {
  const upgrade = await MembershipUpgrade.findOne({
    upgradeTransactionId,
    customer: customerId,
  }).populate('previousSubscription previousPlan newPlan');

  if (!upgrade) {
    const error = new Error('Upgrade transaction record not found.');
    error.status = 404;
    throw error;
  }

  if (upgrade.upgradeStatus === 'COMPLETED') {
    const error = new Error('This upgrade transaction has already been completed.');
    error.status = 400;
    throw error;
  }

  // Cryptographic signature check
  const isValid = verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!isValid) {
    upgrade.upgradeStatus = 'FAILED';
    upgrade.notes = 'Signature verification failed';
    await upgrade.save();

    const error = new Error('Invalid payment signature. Upgrade rejected.');
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const newPlan = upgrade.newPlan;
  const expirationDate = calculateExpirationDate(now, newPlan.validityDuration, newPlan.validityUnit);

  // 1. Record Payment
  const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
  const receiptNumber = `REC-UPG-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
  const paymentRecord = await Payment.create({
    paymentId: internalPaymentId,
    receiptNumber,
    customer: customerId,
    amount: upgrade.finalAmountPayable,
    currency: 'INR',
    paymentMethod: 'UPI',
    paymentGateway: 'RAZORPAY',
    paymentStatus: 'PAID',
    paymentPurpose: 'MEMBERSHIP_UPGRADE',
    membershipPlan: newPlan._id,
    gatewayOrderId: razorpayOrderId,
    gatewayPaymentId: razorpayPaymentId,
    gatewaySignature: razorpaySignature,
    paidAt: now,
    notes: `Prorated upgrade to ${newPlan.name} (Credited ₹${upgrade.calculatedUnusedCredit / 100})`,
    auditTrail: [
      {
        status: 'PAID',
        changedBy: customerId,
        reason: 'Online membership upgrade verified via Razorpay',
        timestamp: now,
      },
    ],
  });

  // 2. Archive previous subscription as UPGRADED
  const oldSub = await MembershipSubscription.findById(upgrade.previousSubscription._id || upgrade.previousSubscription);
  if (oldSub) {
    oldSub.status = 'UPGRADED';
    await oldSub.save();
  }

  // 3. Create new active subscription
  const newSub = await MembershipSubscription.create({
    subscriptionId: generateSubscriptionId(),
    customer: customerId,
    membershipPlan: newPlan._id,
    purchaseDate: now,
    startDate: now,
    expirationDate,
    status: 'ACTIVE',
    payment: paymentRecord._id,
    paymentReference: internalPaymentId,
    notes: `Upgraded from ${upgrade.previousPlan?.name || 'Previous Plan'} via Razorpay (${razorpayPaymentId})`,
  });

  if (oldSub) {
    oldSub.upgradedTo = newSub._id;
    await oldSub.save();
  }

  // 4. Mark upgrade as COMPLETED
  upgrade.upgradeStatus = 'COMPLETED';
  upgrade.payment = paymentRecord._id;
  upgrade.paymentReference = internalPaymentId;
  upgrade.completedAt = now;
  await upgrade.save();

  // 5. Update user customer record
  await User.findByIdAndUpdate(customerId, {
    'membership.status': 'ACTIVE',
    'membership.planId': newPlan._id,
    'membership.subscriptionId': newSub._id,
    'membership.expiresAt': expirationDate,
    'membership.dailyUsageMinutesUsed': 0,
    'membership.lastUsageDate': '',
    'membership.remainingHours': newPlan.dailyUsageLimit ? Math.round(newPlan.dailyUsageLimit / 60) : 999,
  });

  // 6. In-app notification
  await createNotification({
    recipient: customerId,
    title: 'Membership Upgraded!',
    message: `Congratulations! Your membership has been upgraded to ${newPlan.name} valid until ${expirationDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    category: 'MEMBERSHIP_ACTIVATED',
    data: {
      subscriptionId: newSub.subscriptionId,
      planName: newPlan.name,
      expirationDate,
    },
  });

  return {
    subscription: newSub,
    payment: paymentRecord,
    upgrade,
  };
}

/**
 * Front-desk offline upgrade registration (Cash / Counter UPI)
 */
export async function recordOfflineMembershipUpgrade({
  customerId,
  targetPlanId,
  paymentMethod = 'CASH',
  referenceNumber = '',
  cashierId,
  notes = '',
}) {
  const quote = await calculateUpgradeQuote({ customerId, targetPlanId });
  const upgradeTransactionId = generateUpgradeTransactionId();
  const now = new Date();
  const targetPlan = await MembershipPlan.findById(targetPlanId);
  const expirationDate = calculateExpirationDate(now, targetPlan.validityDuration, targetPlan.validityUnit);

  const internalPaymentId = `PAY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Record offline payment
  const receiptNumber = `REC-OFFLINE-UPG-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
  const paymentRecord = await Payment.create({
    paymentId: internalPaymentId,
    receiptNumber,
    customer: customerId,
    cashier: cashierId,
    amount: quote.financials.finalAmountPayablePaise,
    currency: 'INR',
    paymentMethod: paymentMethod === 'COUNTER_UPI' || paymentMethod === 'UPI' ? 'COUNTER_UPI' : 'CASH',
    paymentGateway: paymentMethod === 'COUNTER_UPI' || paymentMethod === 'UPI' ? 'OFFLINE_COUNTER_UPI' : 'OFFLINE_CASH',
    paymentStatus: 'PAID',
    paymentPurpose: 'MEMBERSHIP_UPGRADE',
    membershipPlan: targetPlan._id,
    notes: `Front-desk offline upgrade (Ref: ${referenceNumber || 'N/A'}). ${notes}`,
    paidAt: now,
    auditTrail: [
      {
        status: 'PAID',
        changedBy: cashierId,
        reason: `Offline upgrade registered via ${paymentMethod}`,
        timestamp: now,
      },
    ],
  });

  // 2. Mark old subscription UPGRADED
  const oldSub = await MembershipSubscription.findById(quote.currentSubscription.id);
  if (oldSub) {
    oldSub.status = 'UPGRADED';
    await oldSub.save();
  }

  // 3. Create new subscription
  const newSub = await MembershipSubscription.create({
    subscriptionId: generateSubscriptionId(),
    customer: customerId,
    membershipPlan: targetPlan._id,
    purchaseDate: now,
    startDate: now,
    expirationDate,
    status: 'ACTIVE',
    payment: paymentRecord._id,
    paymentReference: internalPaymentId,
    notes: `Offline counter upgrade by staff (${paymentMethod}). Ref: ${referenceNumber || 'N/A'}`,
  });

  if (oldSub) {
    oldSub.upgradedTo = newSub._id;
    await oldSub.save();
  }

  // 4. Record upgrade transaction
  const upgrade = await MembershipUpgrade.create({
    upgradeTransactionId,
    customer: customerId,
    previousSubscription: quote.currentSubscription.id,
    previousPlan: quote.currentSubscription.planId,
    newPlan: targetPlan._id,
    originalMembershipAmount: quote.financials.originalAmountPaise,
    remainingEligibleDays: quote.financials.remainingEligibleDays,
    totalValidityDays: quote.financials.totalValidityDays,
    calculatedUnusedCredit: quote.financials.unusedCreditPaise,
    newMembershipPrice: quote.financials.newPlanPricePaise,
    finalAmountPayable: quote.financials.finalAmountPayablePaise,
    payment: paymentRecord._id,
    paymentReference: internalPaymentId,
    upgradeStatus: 'COMPLETED',
    completedAt: now,
    notes: `Offline counter upgrade (${paymentMethod}) by Staff`,
  });

  // 5. Update customer profile
  await User.findByIdAndUpdate(customerId, {
    'membership.status': 'ACTIVE',
    'membership.planId': targetPlan._id,
    'membership.subscriptionId': newSub._id,
    'membership.expiresAt': expirationDate,
    'membership.dailyUsageMinutesUsed': 0,
    'membership.lastUsageDate': '',
    'membership.remainingHours': targetPlan.dailyUsageLimit ? Math.round(targetPlan.dailyUsageLimit / 60) : 999,
  });

  await createNotification({
    recipient: customerId,
    title: 'Membership Upgraded at Front Desk!',
    message: `Your membership has been upgraded to ${targetPlan.name} valid until ${expirationDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    category: 'MEMBERSHIP_ACTIVATED',
    data: {
      subscriptionId: newSub.subscriptionId,
      planName: targetPlan.name,
      expirationDate,
    },
  });

  return {
    subscription: newSub,
    payment: paymentRecord,
    upgrade,
    quote,
  };
}
