import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import Refund from '../models/Refund.js';
import User from '../models/User.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import ActivityLog from '../models/ActivityLog.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  initiateRazorpayRefund,
  getRazorpayKeyId,
} from './razorpay.service.js';
import { formatISTDate } from '../utils/timeSlots.js';
import { FEATURES, PAYMENT_MESSAGES } from '../config/features.js';
import { createNotification } from './notification.service.js';
import {
  sendPaymentSuccessEmail,
  sendMembershipActivationEmail,
} from './email.service.js';

function generatePaymentId() {
  const dateStr = formatISTDate(new Date()).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `PAY-${dateStr}-${rand}`;
}

function generateReceiptNumber() {
  const dateStr = formatISTDate(new Date()).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `REC-${dateStr}-${rand}`;
}

function generateRefundId() {
  const dateStr = formatISTDate(new Date()).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `REF-${dateStr}-${rand}`;
}

async function findBookingSafely(identifier) {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier) && String(new mongoose.Types.ObjectId(identifier)) === String(identifier)) {
    const byId = await Booking.findById(identifier).populate('device game customer');
    if (byId) return byId;
  }
  return await Booking.findOne({ bookingId: identifier }).populate('device game customer');
}

/**
 * Creates or retrieves a Razorpay Order for online customer booking payment
 * Features:
 * - Server-side trusted calculation in integer paise (never trusts frontend amount)
 * - Idempotency & duplicate-click protection (reuses active unexpired pending order)
 * - Temporary 15-minute slot lock
 */
export async function createOnlineOrder({ customerId, bookingId, paymentPurpose }) {
  if (!FEATURES.ENABLE_ONLINE_PAYMENTS) {
    const err = new Error(PAYMENT_MESSAGES.ONLINE_UNAVAILABLE);
    err.status = 403;
    throw err;
  }

  const booking = await findBookingSafely(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  // Ownership verification
  const bookingCustomerId = booking.customer?._id?.toString() || booking.customer?.toString();
  if (bookingCustomerId !== customerId.toString()) {
    const err = new Error('Access denied: You are not authorized to pay for this reservation');
    err.status = 403;
    throw err;
  }

  if (booking.bookingStatus === 'CANCELLED') {
    const err = new Error('Cannot initiate payment for a cancelled booking');
    err.status = 400;
    throw err;
  }

  if (booking.paymentStatus === 'PAID' || (booking.totalAmount === 0 && (booking.balanceRemaining || 0) === 0)) {
    const err = new Error('This booking is already fully paid with zero balance remaining. No additional payment required.');
    err.status = 400;
    throw err;
  }

  // Determine payable amount strictly on backend
  let payableAmountPaise = 0;
  let resolvedPurpose = paymentPurpose;

  const isExclusiveGTA6 = booking.game?.isExclusive || booking.game?.name === 'GTA 6';

  if (isExclusiveGTA6 && !booking.isAdvancePaid) {
    // Mandatory GTA 6 advance payment
    payableAmountPaise = booking.advanceAmount || Math.round(booking.totalAmount * 0.5);
    resolvedPurpose = 'GTA6_ADVANCE';
  } else if (booking.balanceRemaining > 0) {
    payableAmountPaise = booking.balanceRemaining;
    resolvedPurpose = resolvedPurpose || 'BOOKING_BALANCE';
  } else {
    payableAmountPaise = booking.totalAmount;
    resolvedPurpose = resolvedPurpose || 'BOOKING_FULL';
  }

  if (payableAmountPaise <= 0) {
    const err = new Error('Calculated payable amount is invalid or zero');
    err.status = 400;
    throw err;
  }

  // Duplicate-click / Idempotency protection:
  // If an active PENDING payment already exists for this booking within the last 15 minutes, reuse it
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const existingPendingPayment = await Payment.findOne({
    booking: booking._id,
    customer: customerId,
    paymentStatus: 'PENDING',
    paymentGateway: 'RAZORPAY',
    amount: payableAmountPaise,
    createdAt: { $gte: fifteenMinutesAgo },
  }).sort({ createdAt: -1 });

  if (existingPendingPayment && existingPendingPayment.gatewayOrderId) {
    // Refresh temporary hold
    booking.paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await booking.save();

    return {
      orderId: existingPendingPayment.gatewayOrderId,
      amount: existingPendingPayment.amount,
      amountInRupees: existingPendingPayment.amount / 100,
      currency: 'INR',
      keyId: getRazorpayKeyId(),
      paymentId: existingPendingPayment.paymentId,
      bookingId: booking.bookingId,
      purpose: existingPendingPayment.paymentPurpose,
      expiresAt: booking.paymentExpiresAt,
      isTestMode: true,
      businessName: 'NOAH GAMING',
    };
  }

  // Temporary slot lock: Hold slot for 15 minutes while customer completes payment
  booking.paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await booking.save();

  // Create Razorpay Gateway Order via SDK
  const razorpayOrder = await createRazorpayOrder({
    amount: payableAmountPaise,
    currency: 'INR',
    receipt: booking.bookingId,
    notes: {
      bookingId: booking.bookingId,
      customerId: customerId.toString(),
      deviceName: booking.device?.name || 'Station',
      gameName: booking.game?.name || 'Standard',
      purpose: resolvedPurpose,
      business: 'NOAH GAMING',
    },
  });

  // Create pending Payment record in MongoDB
  const paymentId = generatePaymentId();
  const payment = new Payment({
    paymentId,
    customer: customerId,
    booking: booking._id,
    paymentPurpose: resolvedPurpose,
    paymentGateway: 'RAZORPAY',
    paymentMethod: 'UPI',
    gatewayOrderId: razorpayOrder.id,
    amount: payableAmountPaise,
    currency: 'INR',
    paymentStatus: 'PENDING',
    metadata: {
      razorpayOrder,
      bookingReference: booking.bookingId,
      stationName: booking.device?.name,
      mode: 'test',
    },
    auditTrail: [
      {
        status: 'PENDING',
        changedBy: customerId,
        reason: 'Razorpay order created for online checkout (Test Mode)',
        timestamp: new Date(),
      },
    ],
  });

  await payment.save();

  // Link payment to booking
  if (!booking.payments.includes(payment._id)) {
    booking.payments.push(payment._id);
    await booking.save();
  }

  return {
    orderId: razorpayOrder.id,
    amount: payableAmountPaise,
    amountInRupees: payableAmountPaise / 100,
    currency: 'INR',
    keyId: getRazorpayKeyId(),
    paymentId: payment.paymentId,
    bookingId: booking.bookingId,
    purpose: resolvedPurpose,
    expiresAt: booking.paymentExpiresAt,
    isTestMode: true,
    businessName: 'NOAH GAMING',
  };
}

/**
 * Cryptographically verifies Razorpay payment signature and confirms booking
 * Features:
 * - Constant-time signature verification
 * - Idempotency against multiple client callbacks
 * - Updates booking financial ledger and advance payment flags
 */
export async function verifyOnlinePayment({ orderId, paymentId, signature, userId }) {
  const payment = await Payment.findOne({ gatewayOrderId: orderId });
  if (!payment) {
    const err = new Error('Payment record for this order ID was not found');
    err.status = 404;
    throw err;
  }

  // Idempotency: If already marked PAID, return existing verified state
  if (payment.paymentStatus === 'PAID') {
    const booking = await Booking.findById(payment.booking).populate('device game customer');
    return { payment, booking, alreadyVerified: true };
  }

  // Verify ownership / authorization
  const isOwner = payment.customer?.toString() === userId.toString();
  const requestingUser = await User.findById(userId);
  const isStaff = requestingUser?.role === 'admin' || requestingUser?.role === 'receptionist';

  if (!isOwner && !isStaff) {
    const err = new Error('Access denied: You do not have permission to verify this transaction');
    err.status = 403;
    throw err;
  }

  // Cryptographic signature verification (constant-time timingSafeEqual)
  const isValidSignature = verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isValidSignature) {
    payment.paymentStatus = 'FAILED';
    payment.gatewayPaymentId = paymentId;
    payment.auditTrail.push({
      status: 'FAILED',
      changedBy: userId,
      reason: 'Cryptographic HMAC-SHA256 signature verification failed',
      timestamp: new Date(),
    });
    await payment.save();

    const err = new Error('Invalid payment signature. Payment verification rejected.');
    err.status = 400;
    throw err;
  }

  // Update Payment to PAID
  payment.gatewayPaymentId = paymentId;
  payment.gatewaySignatureVerified = true;
  payment.paymentStatus = 'PAID';
  payment.paidAt = new Date();
  if (!payment.receiptNumber) {
    payment.receiptNumber = generateReceiptNumber();
  }
  payment.auditTrail.push({
    status: 'PAID',
    changedBy: userId,
    reason: 'Verified Razorpay signature successfully (Test Mode)',
    timestamp: new Date(),
  });
  await payment.save();

  // Update Booking Financial Records
  const booking = await Booking.findById(payment.booking).populate('device game customer');
  if (booking) {
    booking.amountPaid = (booking.amountPaid || 0) + payment.amount;
    booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);

    if (payment.paymentPurpose === 'GTA6_ADVANCE') {
      booking.isAdvancePaid = true;
    }

    if (booking.balanceRemaining === 0) {
      booking.paymentStatus = 'PAID';
    } else {
      booking.paymentStatus = 'PARTIALLY_PAID';
    }

    booking.bookingStatus = 'CONFIRMED';
    booking.paymentExpiresAt = null; // Clear temporary hold
    await booking.save();

    // Consume reserved daily free-hour entitlement and record usage if applicable
    if (booking.membershipEntitlement) {
      try {
        const { consumeDailyFreeHour, recordMembershipUsage } = await import('./membership.service.js');
        await consumeDailyFreeHour({
          entitlementId: booking.membershipEntitlement,
          bookingId: booking._id,
        });
        if (booking.membershipApplied && booking.membershipSubscription) {
          await recordMembershipUsage({
            booking,
            customerId: booking.customer?._id || booking.customer,
            subscriptionId: booking.membershipSubscription,
          });
        }
      } catch (consumeErr) {
        console.error('[Consume Entitlement on Payment Error]:', consumeErr.message);
      }
    }

    // Audit log
    await ActivityLog.create({
      userId,
      action: 'PAYMENT_SUCCESS',
      category: 'PAYMENT',
      details: {
        paymentId: payment.paymentId,
        gatewayPaymentId: paymentId,
        amountRupees: payment.amount / 100,
        bookingId: booking.bookingId,
        purpose: payment.paymentPurpose,
        mode: 'test',
      },
    });

    try {
      await createNotification({
        recipient: booking.customer?._id || booking.customer,
        recipientRole: 'customer',
        title: 'Payment Confirmed! 💳',
        message: `Payment of ₹${payment.amount / 100} for reservation ${booking.bookingId} has been successfully verified (Receipt: ${payment.receiptNumber}).`,
        category: 'PAYMENT_CONFIRMED',
        relatedBooking: booking._id,
        idempotencyKey: `PAYMENT_CONFIRMED_${payment._id}`,
        deliveryChannels: ['IN_APP', 'WHATSAPP'],
      });
    } catch (notifErr) {
      console.warn('Payment notification error:', notifErr.message);
    }

    try {
      const customerUser = booking.customer;
      if (customerUser && customerUser.email) {
        sendPaymentSuccessEmail({
          payment,
          customer: customerUser,
          booking,
          eventKey: `PAYMENT_SUCCESS_${payment._id}`,
        }).catch((emailErr) => console.error('[Payment Success Email Error]:', emailErr.message));
      }
    } catch (emailErr) {
      console.warn('Payment success email error:', emailErr.message);
    }
  }

  return { payment, booking, alreadyVerified: false };
}

/**
 * Handles incoming Razorpay Webhooks idempotently
 * Supports:
 * - payment.captured
 * - order.paid
 * - payment.failed
 * - refund.processed
 */
export async function processWebhookEvent({ event, payload, signature, rawBody }) {
  // 1. Cryptographic webhook signature verification using rawBody
  const isValid = verifyWebhookSignature({ rawBody, signature });
  if (!isValid) {
    const err = new Error('Unauthorized: Invalid Razorpay webhook signature');
    err.status = 400;
    throw err;
  }

  const paymentEntity = payload?.payment?.entity;
  const orderEntity = payload?.order?.entity;
  const refundEntity = payload?.refund?.entity;

  const orderId = paymentEntity?.order_id || orderEntity?.id;
  const paymentId = paymentEntity?.id;

  if (!orderId) {
    return { status: 'ignored', reason: 'No order_id found in webhook payload' };
  }

  const payment = await Payment.findOne({ gatewayOrderId: orderId });
  if (!payment) {
    return { status: 'ignored', reason: 'Payment record not found for gateway order' };
  }

  // Webhook event deduplication
  const eventId = payload?.event_id || `${event}_${paymentId || orderId}`;
  const processedEvents = payment.metadata?.processedWebhooks || [];
  if (processedEvents.includes(eventId)) {
    return { status: 'already_processed', eventId, paymentId: payment.paymentId };
  }

  // Idempotency: If already marked PAID and receiving captured/paid event
  if (payment.paymentStatus === 'PAID' && (event === 'payment.captured' || event === 'order.paid')) {
    payment.metadata = {
      ...payment.metadata,
      processedWebhooks: [...processedEvents, eventId],
    };
    await payment.save();
    return { status: 'already_processed', paymentId: payment.paymentId };
  }

  // Process payment.captured or order.paid
  if (event === 'payment.captured' || event === 'order.paid') {
    if (paymentId) payment.gatewayPaymentId = paymentId;
    payment.gatewaySignatureVerified = true;
    payment.paymentStatus = 'PAID';
    payment.paidAt = new Date();
    if (!payment.receiptNumber) {
      payment.receiptNumber = generateReceiptNumber();
    }
    payment.metadata = {
      ...payment.metadata,
      processedWebhooks: [...processedEvents, eventId],
    };
    payment.auditTrail.push({
      status: 'PAID',
      reason: `Razorpay webhook event: ${event}`,
      timestamp: new Date(),
    });
    await payment.save();

    // 1. If linked to a booking
    if (payment.booking) {
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.amountPaid = (booking.amountPaid || 0) + payment.amount;
        booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
        if (payment.paymentPurpose === 'GTA6_ADVANCE') {
          booking.isAdvancePaid = true;
        }
        booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
        booking.bookingStatus = 'CONFIRMED';
        booking.paymentExpiresAt = null;
        await booking.save();

        // Consume reserved daily free-hour entitlement and record usage if applicable
        if (booking.membershipEntitlement) {
          try {
            const { consumeDailyFreeHour, recordMembershipUsage } = await import('./membership.service.js');
            await consumeDailyFreeHour({
              entitlementId: booking.membershipEntitlement,
              bookingId: booking._id,
            });
            if (booking.membershipApplied && booking.membershipSubscription) {
              await recordMembershipUsage({
                booking,
                customerId: booking.customer?._id || booking.customer,
                subscriptionId: booking.membershipSubscription,
              });
            }
          } catch (consumeErr) {
            console.error('[Webhook Consume Entitlement Error]:', consumeErr.message);
          }
        }

        if (payment.customer) {
          const custUser = await User.findById(payment.customer);
          if (custUser && custUser.email) {
            sendPaymentSuccessEmail({
              payment,
              customer: custUser,
              booking,
              eventKey: `PAYMENT_SUCCESS_${payment._id}`,
            }).catch((e) => console.error('[Webhook Payment Success Email Error]:', e.message));
          }
        }
      }
    }

    // 2. If linked to a membership plan
    if (payment.membershipPlan && !payment.membershipSubscription) {
      try {
        const plan = await MembershipPlan.findById(payment.membershipPlan);
        const customer = await User.findById(payment.customer);
        if (plan && customer) {
          const now = new Date();
          const msPerDay = 24 * 60 * 60 * 1000;

          // Check if this is a renewal
          let renewalSub = null;
          if (payment.paymentPurpose === 'MEMBERSHIP_RENEWAL') {
            const renewalSubId = customer.membership?.subscriptionId;
            if (renewalSubId) {
              renewalSub = await MembershipSubscription.findById(renewalSubId);
            }
          }

          let startDate = now;
          let previousExpiration = null;
          if (renewalSub && renewalSub.status === 'ACTIVE' && renewalSub.expirationDate > now) {
            startDate = renewalSub.expirationDate;
            previousExpiration = renewalSub.expirationDate;
          }

          let expirationDate = new Date(startDate.getTime() + (plan.validityDuration || 30) * msPerDay);
          if (plan.validityUnit === 'MONTHS') {
            expirationDate = new Date(startDate);
            expirationDate.setMonth(expirationDate.getMonth() + (plan.validityDuration || 1));
          } else if (plan.validityUnit === 'YEARS') {
            expirationDate = new Date(startDate);
            expirationDate.setFullYear(expirationDate.getFullYear() + (plan.validityDuration || 1));
          }

          let subscription = null;
          if (renewalSub) {
            subscription = renewalSub;
            subscription.expirationDate = expirationDate;
            subscription.status = 'ACTIVE';
            subscription.renewalHistory.push({
              renewedAt: now,
              previousExpirationDate: previousExpiration || renewalSub.expirationDate,
              newExpirationDate: expirationDate,
              payment: payment._id,
              renewedBy: customer._id,
              notes: `Webhook automated renewal (${event})`,
            });
            await subscription.save();
          } else {
            subscription = await MembershipSubscription.create({
              subscriptionId: `SUB-${Date.now().toString().slice(-8)}`,
              customer: customer._id,
              membershipPlan: plan._id,
              status: 'ACTIVE',
              startDate: now,
              expirationDate,
              payment: payment._id,
              paymentReference: payment.paymentId,
              notes: `Webhook automated activation (${event})`,
            });
          }

          payment.membershipSubscription = subscription._id;
          await payment.save();

          // Update user membership profile
          customer.membership = {
            status: 'ACTIVE',
            planId: plan._id,
            planName: plan.name,
            planPrice: plan.price,
            subscriptionId: subscription._id,
            expiresAt: expirationDate,
            remainingHours: plan.isUnlimited ? 9999 : (plan.dailyUsageLimit || 120) / 60,
          };
          await customer.save();

          // Send membership activation email
          if (customer.email) {
            sendMembershipActivationEmail({
              membership: subscription,
              user: customer,
              plan,
              eventKey: `MEMBERSHIP_ACTIVATION_${subscription._id}`,
            }).catch((e) => console.error('[Webhook Membership Activation Email Error]:', e.message));
          }
        }
      } catch (subErr) {
        console.warn('[Webhook Membership Activation Error]:', subErr.message);
      }
    }

    return { status: 'success', event, paymentId: payment.paymentId };
  }

  // Process payment.failed
  if (event === 'payment.failed') {
    if (payment.paymentStatus !== 'PAID') {
      payment.paymentStatus = 'FAILED';
      payment.metadata = {
        ...payment.metadata,
        processedWebhooks: [...processedEvents, eventId],
      };
      payment.auditTrail.push({
        status: 'FAILED',
        reason: `Razorpay webhook event: ${event} (${paymentEntity?.error_description || 'Payment Failed'})`,
        timestamp: new Date(),
      });
      await payment.save();
    }
    return { status: 'failed_recorded', event, paymentId: payment.paymentId };
  }

  // Process refund.processed
  if (event === 'refund.processed') {
    const refundId = refundEntity?.id;
    const refundAmount = refundEntity?.amount || payment.amount;
    payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
    payment.paymentStatus =
      payment.refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    payment.metadata = {
      ...payment.metadata,
      processedWebhooks: [...processedEvents, eventId],
      gatewayRefundId: refundId,
    };
    payment.auditTrail.push({
      status: payment.paymentStatus,
      reason: `Razorpay webhook event: ${event} (${refundId})`,
      timestamp: new Date(),
    });
    await payment.save();

    return { status: 'refund_recorded', event, paymentId: payment.paymentId };
  }

  return { status: 'unhandled_event', event };
}

/**
 * Records an offline payment collected at reception desk (CASH or COUNTER_UPI)
 * Preserves full front-desk operational workflow
 */
export async function recordOfflinePayment({
  customerId,
  bookingId,
  amount,
  paymentMethod = 'CASH',
  transactionReference = '',
  collectedByUserId,
  notes = '',
}) {
  const staff = await User.findById(collectedByUserId);
  if (!staff || (staff.role !== 'admin' && staff.role !== 'receptionist')) {
    const err = new Error('Only authorized staff or administrators can record offline payments');
    err.status = 403;
    throw err;
  }

  const booking = await findBookingSafely(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  if (booking.bookingStatus === 'CANCELLED') {
    const err = new Error('Cannot collect payments for a cancelled reservation');
    err.status = 400;
    throw err;
  }

  let amountPaise = Math.round(Number(amount));
  if (amountPaise <= 0) {
    const err = new Error('Payment amount must be greater than zero');
    err.status = 400;
    throw err;
  }

  const remainingBalance = booking.balanceRemaining > 0 ? booking.balanceRemaining : booking.totalAmount;
  if (amountPaise * 100 <= remainingBalance) {
    amountPaise = amountPaise * 100;
  }

  if (amountPaise > remainingBalance) {
    const err = new Error(
      `Collected amount (₹${amountPaise / 100}) exceeds remaining balance of ₹${remainingBalance / 100}`
    );
    err.status = 400;
    throw err;
  }

  const targetCustomer = customerId || booking.customer?._id || booking.customer;
  const paymentId = generatePaymentId();
  const receiptNumber = generateReceiptNumber();

  const isAdvance =
    (booking.game?.isExclusive || booking.game?.name === 'GTA 6') && !booking.isAdvancePaid;

  const payment = new Payment({
    paymentId,
    customer: targetCustomer,
    booking: booking._id,
    paymentPurpose: isAdvance ? 'GTA6_ADVANCE' : 'BOOKING_BALANCE',
    paymentGateway: paymentMethod === 'CASH' ? 'OFFLINE_CASH' : 'OFFLINE_COUNTER_UPI',
    paymentMethod,
    amount: amountPaise,
    currency: 'INR',
    paymentStatus: 'PAID',
    transactionReference: transactionReference ? transactionReference.trim() : `COUNTER-${Date.now()}`,
    collectedBy: collectedByUserId,
    paidAt: new Date(),
    receiptNumber,
    metadata: {
      staffName: staff.name,
      staffRole: staff.role,
      notes: notes.trim(),
    },
    auditTrail: [
      {
        status: 'PAID',
        changedBy: collectedByUserId,
        reason: `Offline payment verified and collected by ${staff.name} (${staff.role})`,
        timestamp: new Date(),
      },
    ],
  });

  await payment.save();

  // Update Booking Financials
  booking.amountPaid = (booking.amountPaid || 0) + amountPaise;
  booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
  if (isAdvance) {
    booking.isAdvancePaid = true;
  }

  booking.paymentStatus = booking.balanceRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  booking.bookingStatus = 'CONFIRMED';
  booking.paymentExpiresAt = null;
  booking.payments.push(payment._id);
  await booking.save();

  // Audit Log
  await ActivityLog.create({
    userId: collectedByUserId,
    action: 'OFFLINE_PAYMENT_COLLECTED',
    category: 'PAYMENT',
    details: {
      paymentId: payment.paymentId,
      bookingId: booking.bookingId,
      amountRupees: amountPaise / 100,
      paymentMethod,
      staffName: staff.name,
    },
  });

  try {
    await createNotification({
      recipient: booking.customer?._id || booking.customer,
      recipientRole: 'customer',
      title: 'Counter Payment Received! 💵',
      message: `Payment of ₹${amountPaise / 100} (${paymentMethod}) recorded for reservation ${booking.bookingId} (Receipt: ${receiptNumber}).`,
      category: 'PAYMENT_CONFIRMED',
      relatedBooking: booking._id,
      idempotencyKey: `PAYMENT_COUNTER_${payment._id}`,
      deliveryChannels: ['IN_APP'],
    });
  } catch (notifErr) {
    console.warn('Counter payment notification error:', notifErr.message);
  }

  return { payment, booking };
}

/**
 * Initiates an eligible refund for a verified payment
 */
export async function processRefund({ paymentId, amount, reason, initiatedByUserId, userRole }) {
  if (userRole !== 'admin') {
    const err = new Error('Access denied: Only lounge administrators can issue refunds');
    err.status = 403;
    throw err;
  }

  const payment = await Payment.findOne({
    $or: [{ _id: paymentId }, { paymentId }],
  }).populate('booking customer');

  if (!payment) {
    const err = new Error('Payment record not found');
    err.status = 404;
    throw err;
  }

  if (payment.paymentStatus !== 'PAID' && payment.paymentStatus !== 'PARTIALLY_REFUNDED') {
    const err = new Error(
      `Cannot refund payment with status '${payment.paymentStatus}'. Only verified successful payments can be refunded.`
    );
    err.status = 400;
    throw err;
  }

  const refundAmountPaise = Math.round(Number(amount));
  if (refundAmountPaise <= 0) {
    const err = new Error('Refund amount must be greater than zero');
    err.status = 400;
    throw err;
  }

  const maxRefundablePaise = payment.amount - (payment.refundedAmount || 0);
  if (refundAmountPaise > maxRefundablePaise) {
    const err = new Error(
      `Requested refund (₹${refundAmountPaise / 100}) exceeds maximum eligible amount of ₹${
        maxRefundablePaise / 100
      }`
    );
    err.status = 400;
    throw err;
  }

  let gatewayRefund = null;
  if (payment.paymentGateway === 'RAZORPAY' && payment.gatewayPaymentId) {
    gatewayRefund = await initiateRazorpayRefund({
      paymentId: payment.gatewayPaymentId,
      amount: refundAmountPaise,
      notes: { reason, refundBy: initiatedByUserId.toString() },
    });
  }

  const refundId = generateRefundId();
  const refund = new Refund({
    refundId,
    payment: payment._id,
    booking: payment.booking?._id || payment.booking,
    customer: payment.customer?._id || payment.customer,
    amount: refundAmountPaise,
    currency: payment.currency || 'INR',
    reason: reason.trim(),
    refundType: payment.paymentGateway === 'RAZORPAY' ? 'ONLINE' : 'OFFLINE',
    status: 'COMPLETED',
    gatewayRefundId: gatewayRefund?.id || null,
    initiatedBy: initiatedByUserId,
    metadata: {
      originalPaymentId: payment.paymentId,
      gatewayRefund,
    },
  });

  await refund.save();

  // Update Payment Record
  payment.refundedAmount = (payment.refundedAmount || 0) + refundAmountPaise;
  payment.refundReference = refund.refundId;
  payment.paymentStatus =
    payment.refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  payment.auditTrail.push({
    status: payment.paymentStatus,
    changedBy: initiatedByUserId,
    reason: `Refund of ₹${refundAmountPaise / 100} issued: ${reason}`,
    timestamp: new Date(),
  });

  await payment.save();

  // Update Booking Financials
  if (payment.booking) {
    const booking = await Booking.findById(payment.booking._id || payment.booking);
    if (booking) {
      booking.amountPaid = Math.max(0, (booking.amountPaid || 0) - refundAmountPaise);
      booking.balanceRemaining = Math.max(0, booking.totalAmount - booking.amountPaid);
      booking.paymentStatus =
        booking.amountPaid === 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await booking.save();
    }
  }

  // Audit Log
  await ActivityLog.create({
    userId: initiatedByUserId,
    action: 'REFUND_PROCESSED',
    category: 'PAYMENT',
    details: {
      refundId: refund.refundId,
      paymentId: payment.paymentId,
      amountRupees: refundAmountPaise / 100,
      reason,
    },
  });

  // Notify customer
  try {
    const customerId = payment.customer?._id || payment.customer;
    if (customerId) {
      await createNotification({
        recipient: customerId,
        recipientRole: 'customer',
        title: 'Refund Processed 🔄',
        message: `A refund of ₹${refundAmountPaise / 100} has been processed for ${payment.paymentId} (${reason}).`,
        category: 'REFUND_PROCESSED',
        relatedBooking: payment.booking?._id || payment.booking,
        idempotencyKey: `REFUND_${refund._id}`,
        deliveryChannels: ['IN_APP'],
      });
    }
  } catch (notifErr) {
    console.warn('Refund notification error:', notifErr.message);
  }

  return { refund, payment };
}

/**
 * Sweeps and releases expired temporary reservations (older than hold deadline)
 */
export async function releaseExpiredReservations() {
  const now = new Date();
  const expiredBookings = await Booking.find({
    bookingStatus: 'PENDING',
    paymentExpiresAt: { $lt: now, $ne: null },
  });

  let releasedCount = 0;
  for (const b of expiredBookings) {
    b.bookingStatus = 'CANCELLED';
    b.paymentStatus = 'FAILED';
    b.cancellationReason = 'Temporary payment reservation expired without completion';
    b.cancelledAt = new Date();
    b.paymentExpiresAt = null;
    await b.save();
    releasedCount++;
  }

  return { releasedCount };
}
