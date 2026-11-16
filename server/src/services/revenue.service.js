import Payment from '../models/Payment.js';
import Refund from '../models/Refund.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { TIMEZONE } from '../config/constants.js';
import { formatISTDate, parseISTDateTime } from '../utils/timeSlots.js';

/**
 * Standardizes date range filtering using Indian Standard Time (Asia/Kolkata).
 * Converts local IST calendar-day boundaries (00:00:00.000 to 23:59:59.999) to UTC.
 */
export function getISTDateBoundaries(range = 'today', customStart = null, customEnd = null) {
  const now = new Date();
  const todayISTStr = formatISTDate(now);

  let startISTStr = todayISTStr;
  let endISTStr = todayISTStr;

  switch (range) {
    case 'today':
      startISTStr = todayISTStr;
      endISTStr = todayISTStr;
      break;

    case 'yesterday': {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startISTStr = formatISTDate(yesterday);
      endISTStr = startISTStr;
      break;
    }

    case '7d': {
      const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startISTStr = formatISTDate(past7);
      endISTStr = todayISTStr;
      break;
    }

    case '30d': {
      const past30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      startISTStr = formatISTDate(past30);
      endISTStr = todayISTStr;
      break;
    }

    case 'this_month': {
      const [year, month] = todayISTStr.split('-');
      startISTStr = `${year}-${month}-01`;
      endISTStr = todayISTStr;
      break;
    }

    case 'last_month': {
      const [yearStr, monthStr] = todayISTStr.split('-');
      let y = parseInt(yearStr, 10);
      let m = parseInt(monthStr, 10) - 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      const padM = String(m).padStart(2, '0');
      const lastDay = new Date(y, m, 0).getDate();
      startISTStr = `${y}-${padM}-01`;
      endISTStr = `${y}-${padM}-${String(lastDay).padStart(2, '0')}`;
      break;
    }

    case 'all_time':
      startISTStr = '2020-01-01';
      endISTStr = '2099-12-31';
      break;

    case 'custom':
      if (customStart && customEnd) {
        startISTStr = customStart;
        endISTStr = customEnd;
      }
      break;

    default:
      startISTStr = todayISTStr;
      endISTStr = todayISTStr;
      break;
  }

  const startUTC = parseISTDateTime(startISTStr, '00:00');
  const endUTC = new Date(parseISTDateTime(endISTStr, '00:00').getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    range,
    startISTStr,
    endISTStr,
    startUTC,
    endUTC,
    todayISTStr,
  };
}

/**
 * Authoritative Revenue Calculation & Financial Reconciliation Engine
 *
 * Strict Accounting Rules:
 * 1. Gross Collected Revenue: Sum of successful transactions (PAID, PARTIALLY_PAID, PARTIALLY_REFUNDED).
 * 2. Refunds Deducted: Sum of completed refunds.
 * 3. Net Collected Revenue: Gross Collections - Completed Refunds.
 * 4. Outstanding Amount: Sum of remaining balance on confirmed/completed bookings (NEVER added to collected revenue).
 * 5. Booking Value: Total contract value of bookings (tracked separately, NOT treated as collected revenue).
 */
export async function calculateRevenueMetrics({
  range = 'today',
  startDate = null,
  endDate = null,
  paymentMethod = null,
  paymentGateway = null,
} = {}) {
  const bounds = getISTDateBoundaries(range, startDate, endDate);
  const { startUTC, endUTC, startISTStr, endISTStr, range: resolvedRange } = bounds;

  // Build filter for successful payments
  // Checks effective payment timestamp: paidAt if set, otherwise createdAt
  const paymentFilter = {
    paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] },
    $or: [
      { paidAt: { $gte: startUTC, $lte: endUTC } },
      { paidAt: null, createdAt: { $gte: startUTC, $lte: endUTC } },
    ],
  };

  if (paymentMethod) {
    paymentFilter.paymentMethod = paymentMethod;
  }
  if (paymentGateway) {
    paymentFilter.paymentGateway = paymentGateway;
  }

  // 1. Fetch matching payments
  const qualifyingPayments = await Payment.find(paymentFilter)
    .populate('customer', 'name email phone role')
    .populate('booking', 'bookingReference totalAmount balanceRemaining bookingDate startTime')
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();

  let grossCollectedPaise = 0;
  let refundsDeductedPaise = 0;
  let onlineRevenuePaise = 0;
  let offlineRevenuePaise = 0;

  const methodBreakdown = {
    UPI: { paise: 0, rupees: 0, count: 0 },
    CASH: { paise: 0, rupees: 0, count: 0 },
    COUNTER_UPI: { paise: 0, rupees: 0, count: 0 },
    CARD: { paise: 0, rupees: 0, count: 0 },
    NETBANKING: { paise: 0, rupees: 0, count: 0 },
    WALLET: { paise: 0, rupees: 0, count: 0 },
    OTHER: { paise: 0, rupees: 0, count: 0 },
  };

  const purposeBreakdown = {
    BOOKING_FULL: { paise: 0, rupees: 0, count: 0 },
    BOOKING_BALANCE: { paise: 0, rupees: 0, count: 0 },
    GTA6_ADVANCE: { paise: 0, rupees: 0, count: 0 },
    MEMBERSHIP_NEW: { paise: 0, rupees: 0, count: 0 },
    MEMBERSHIP_RENEWAL: { paise: 0, rupees: 0, count: 0 },
    MEMBERSHIP_UPGRADE: { paise: 0, rupees: 0, count: 0 },
    WALKIN_OFFLINE: { paise: 0, rupees: 0, count: 0 },
  };

  for (const p of qualifyingPayments) {
    const amount = p.amount || 0;
    const refAmount = p.refundedAmount || 0;

    grossCollectedPaise += amount;
    refundsDeductedPaise += refAmount;

    if (p.paymentGateway === 'RAZORPAY') {
      onlineRevenuePaise += (amount - refAmount);
    } else {
      offlineRevenuePaise += (amount - refAmount);
    }

    // Method breakdown
    const m = p.paymentMethod || 'OTHER';
    if (!methodBreakdown[m]) {
      methodBreakdown[m] = { paise: 0, rupees: 0, count: 0 };
    }
    methodBreakdown[m].paise += amount;
    methodBreakdown[m].count += 1;

    // Purpose breakdown
    const pur = p.paymentPurpose || 'BOOKING_FULL';
    if (!purposeBreakdown[pur]) {
      purposeBreakdown[pur] = { paise: 0, rupees: 0, count: 0 };
    }
    purposeBreakdown[pur].paise += amount;
    purposeBreakdown[pur].count += 1;
  }

  // Convert breakdowns to rupees
  for (const k of Object.keys(methodBreakdown)) {
    methodBreakdown[k].rupees = methodBreakdown[k].paise / 100;
  }
  for (const k of Object.keys(purposeBreakdown)) {
    purposeBreakdown[k].rupees = purposeBreakdown[k].paise / 100;
  }

  // 2. Fetch completed refunds in range
  const refundFilter = {
    status: 'COMPLETED',
    createdAt: { $gte: startUTC, $lte: endUTC },
  };
  const [refundCount, refundAgg] = await Promise.all([
    Refund.countDocuments(refundFilter),
    Refund.aggregate([
      { $match: refundFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const standaloneRefundsPaise = refundAgg[0]?.total || 0;
  // Use the larger of direct payment refunds or standalone refund audit records
  const effectiveRefundsPaise = Math.max(refundsDeductedPaise, standaloneRefundsPaise);
  const netCollectedPaise = Math.max(0, grossCollectedPaise - effectiveRefundsPaise);

  // 3. Outstanding Balances & Booking Values in Range
  const bookingFilter = {
    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] },
    bookingDate: { $gte: startISTStr, $lte: endISTStr },
  };

  const [outstandingAgg, bookingGrossAgg, pendingCount, failedCount] = await Promise.all([
    Booking.aggregate([
      { $match: { ...bookingFilter, balanceRemaining: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$balanceRemaining' }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { bookingStatus: { $ne: 'CANCELLED' }, bookingDate: { $gte: startISTStr, $lte: endISTStr } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Payment.countDocuments({
      paymentStatus: 'PENDING',
      createdAt: { $gte: startUTC, $lte: endUTC },
    }),
    Payment.countDocuments({
      paymentStatus: 'FAILED',
      createdAt: { $gte: startUTC, $lte: endUTC },
    }),
  ]);

  const outstandingPaise = outstandingAgg[0]?.total || 0;
  const outstandingCount = outstandingAgg[0]?.count || 0;
  const bookingGrossPaise = bookingGrossAgg[0]?.total || 0;
  const bookingGrossCount = bookingGrossAgg[0]?.count || 0;

  return {
    period: {
      range: resolvedRange,
      startISTStr,
      endISTStr,
      startUTC: startUTC.toISOString(),
      endUTC: endUTC.toISOString(),
      timezone: TIMEZONE,
    },
    // Headline Net & Gross
    grossCollectedPaise,
    grossCollectedRupees: grossCollectedPaise / 100,
    refundsDeductedPaise: effectiveRefundsPaise,
    refundsDeductedRupees: effectiveRefundsPaise / 100,
    netCollectedPaise,
    netCollectedRupees: netCollectedPaise / 100,
    // Separate Unpaid & Contract Values
    outstandingBalancesPaise: outstandingPaise,
    outstandingBalancesRupees: outstandingPaise / 100,
    outstandingCount,
    bookingGrossValuePaise: bookingGrossPaise,
    bookingGrossValueRupees: bookingGrossPaise / 100,
    bookingGrossCount,
    // Channel Breakdown
    channels: {
      online: {
        paise: onlineRevenuePaise,
        rupees: onlineRevenuePaise / 100,
      },
      offline: {
        paise: offlineRevenuePaise,
        rupees: offlineRevenuePaise / 100,
      },
    },
    // Transaction status counts
    counts: {
      successfulPayments: qualifyingPayments.length,
      failedPayments: failedCount,
      pendingPayments: pendingCount,
      refundsCount: refundCount || (effectiveRefundsPaise > 0 ? 1 : 0),
    },
    methodBreakdown,
    purposeBreakdown,
    qualifyingPayments,
  };
}

/**
 * Formats individual qualifying payments for administrator reconciliation audit trail
 */
export function formatReconciliationAuditTrail(payments) {
  return payments.map((p) => {
    const rawDate = p.paidAt || p.createdAt;
    const effectiveIST = rawDate
      ? new Intl.DateTimeFormat('en-IN', {
          timeZone: TIMEZONE,
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date(rawDate))
      : 'N/A';

    const grossRupees = (p.amount || 0) / 100;
    const refundedRupees = (p.refundedAmount || 0) / 100;
    const netRupees = grossRupees - refundedRupees;

    return {
      paymentId: p.paymentId,
      receiptNumber: p.receiptNumber || 'N/A',
      customerName: p.customer?.name || 'Guest Gamer',
      customerEmail: p.customer?.email || 'N/A',
      bookingReference: p.booking?.bookingReference || 'N/A',
      purpose: p.paymentPurpose,
      method: p.paymentMethod,
      gateway: p.paymentGateway,
      grossRupees,
      refundedRupees,
      netRupees,
      status: p.paymentStatus,
      paidAtIST: effectiveIST,
      createdAtUTC: p.createdAt,
    };
  });
}
