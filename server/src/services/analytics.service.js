import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipUpgrade from '../models/MembershipUpgrade.js';
import DeviceMaintenance from '../models/DeviceMaintenance.js';
import ActivityLog from '../models/ActivityLog.js';
import Refund from '../models/Refund.js';
import { TIMEZONE } from '../config/constants.js';
import { parseISTDateTime, formatISTDate } from '../utils/timeSlots.js';
import { calculateRevenueMetrics } from './revenue.service.js';

/**
 * Standardizes date range filtering using Indian Standard Time (Asia/Kolkata).
 * Default operating window: 10:00 to 23:00 IST (13 operating hours per day).
 */
export function getISTDateRange(range = '30d', customStart = null, customEnd = null) {
  const now = new Date();
  const todayISTStr = formatISTDate(now);

  let startISTStr = todayISTStr;
  let endISTStr = todayISTStr;

  if (range === 'today') {
    startISTStr = todayISTStr;
    endISTStr = todayISTStr;
  } else if (range === '7d') {
    const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    startISTStr = formatISTDate(past);
    endISTStr = todayISTStr;
  } else if (range === '30d') {
    const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    startISTStr = formatISTDate(past);
    endISTStr = todayISTStr;
  } else if (range === '6m') {
    const past = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    startISTStr = formatISTDate(past);
    endISTStr = todayISTStr;
  } else if (range === '1y') {
    const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    startISTStr = formatISTDate(past);
    endISTStr = todayISTStr;
  } else if (range === 'all') {
    startISTStr = '2020-01-01';
    endISTStr = '2099-12-31';
  } else if (range === 'custom' && customStart && customEnd) {
    startISTStr = customStart;
    endISTStr = customEnd;
  }

  const startUTC = range === 'all' ? new Date(0) : parseISTDateTime(startISTStr, '00:00');
  const endUTC = range === 'all' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : parseISTDateTime(endISTStr, '23:59:59');

  const diffMs = Math.max(0, endUTC.getTime() - startUTC.getTime());
  const dayCount = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));

  return {
    range,
    startISTStr,
    endISTStr,
    startUTC,
    endUTC,
    dayCount,
    todayISTStr,
  };
}

/**
 * 1. Administrator Dashboard Overview & KPIs
 */
export async function getDashboardKPIs() {
  const now = new Date();
  const todayISTStr = formatISTDate(now);

  // Run financial calculations & operational queries in parallel using centralized revenue service
  const [
    allTimeMetrics,
    todayMetrics,
    weekMetrics,
    monthMetrics,
    bookingCounts,
    todayBookingCounts,
    customerCounts,
    activeMembershipsCount,
    pendingPaymentsAgg,
  ] = await Promise.all([
    calculateRevenueMetrics({ range: 'all_time' }),
    calculateRevenueMetrics({ range: 'today' }),
    calculateRevenueMetrics({ range: '7d' }),
    calculateRevenueMetrics({ range: 'this_month' }),
    // Bookings Status Counts
    Booking.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          confirmed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'CONFIRMED'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'CANCELLED'] }, 1, 0] } },
          activeSessions: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$sessionStatus', 'ACTIVE'] },
                    { $eq: ['$sessionStatus', 'EXTENDED'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    // Today's Bookings
    Booking.countDocuments({ bookingDate: todayISTStr }),
    // Registered Customers
    User.countDocuments({ role: 'customer' }),
    // Active Memberships (unique pass holders)
    MembershipSubscription.distinct('customer', {
      status: 'ACTIVE',
      expirationDate: { $gte: now },
    }).then((ids) => ids.length),
    // Pending Payments
    Payment.aggregate([
      { $match: { paymentStatus: 'PENDING' } },
      { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amount' } } },
    ]),
  ]);

  const grossAllTime = allTimeMetrics.grossCollectedPaise;
  const refundsAllTime = allTimeMetrics.refundsDeductedPaise;
  const netRevenuePaise = allTimeMetrics.netCollectedPaise;

  const grossToday = todayMetrics.grossCollectedPaise;
  const refundsToday = todayMetrics.refundsDeductedPaise;
  const netTodayPaise = todayMetrics.netCollectedPaise;

  const grossWeek = weekMetrics.grossCollectedPaise;
  const refundsWeek = weekMetrics.refundsDeductedPaise;
  const netWeekPaise = weekMetrics.netCollectedPaise;

  const grossMonth = monthMetrics.grossCollectedPaise;
  const refundsMonth = monthMetrics.refundsDeductedPaise;
  const netMonthPaise = monthMetrics.netCollectedPaise;

  const bCounts = bookingCounts[0] || {
    total: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    activeSessions: 0,
  };

  const pendingCount = pendingPaymentsAgg[0]?.count || 0;
  const pendingAmountPaise = pendingPaymentsAgg[0]?.totalPaise || 0;

  return {
    revenue: {
      totalRevenuePaise: netRevenuePaise,
      totalRevenueRupees: netRevenuePaise / 100,
      todayRevenuePaise: netTodayPaise,
      todayRevenueRupees: netTodayPaise / 100,
      weekRevenuePaise: netWeekPaise,
      weekRevenueRupees: netWeekPaise / 100,
      monthRevenuePaise: netMonthPaise,
      monthRevenueRupees: netMonthPaise / 100,
      grossCollectionsPaise: grossAllTime,
      grossCollectionsRupees: grossAllTime / 100,
      totalRefundsPaise: refundsAllTime,
      totalRefundsRupees: refundsAllTime / 100,
    },
    bookings: {
      totalBookings: bCounts.total,
      todayBookings: todayBookingCounts,
      activeSessions: bCounts.activeSessions,
      completedSessions: bCounts.completed,
      cancelledBookings: bCounts.cancelled,
      confirmedBookings: bCounts.confirmed,
    },
    customers: {
      registeredCustomers: customerCounts,
      activeMemberships: activeMembershipsCount,
    },
    pendingPayments: {
      count: pendingCount,
      amountPaise: pendingAmountPaise,
      amountRupees: pendingAmountPaise / 100,
    },
    kpis: {
      totalRevenuePaise: netRevenuePaise,
      totalRevenueRupees: netRevenuePaise / 100,
      todayRevenuePaise: netTodayPaise,
      todayRevenueRupees: netTodayPaise / 100,
      weekRevenuePaise: netWeekPaise,
      weekRevenueRupees: netWeekPaise / 100,
      monthRevenuePaise: netMonthPaise,
      monthRevenueRupees: netMonthPaise / 100,
      grossCollectionsPaise: grossAllTime,
      grossCollectionsRupees: grossAllTime / 100,
      totalRefundsPaise: refundsAllTime,
      totalRefundsRupees: refundsAllTime / 100,
      totalBookings: bCounts.total,
      todayBookings: todayBookingCounts,
      activeSessions: bCounts.activeSessions,
      completedSessions: bCounts.completed,
      cancelledBookings: bCounts.cancelled,
      confirmedBookings: bCounts.confirmed,
      registeredCustomers: customerCounts,
      activeMemberships: activeMembershipsCount,
    },
  };
}

/**
 * 2. Revenue Analytics & Financial Reconciliation
 */
export async function getRevenueAnalytics({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC, startISTStr, endISTStr } = getISTDateRange(range, startDate, endDate);

  const paidMatch = {
    paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] },
    $or: [
      { paidAt: { $gte: startUTC, $lte: endUTC } },
      { paidAt: null, createdAt: { $gte: startUTC, $lte: endUTC } },
    ],
  };

  const [
    grossAgg,
    refundsAgg,
    membershipAgg,
    advanceAgg,
    outstandingAgg,
    dailyTrendsAgg,
  ] = await Promise.all([
    // Gross Collections in range
    Payment.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: null,
          totalPaise: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    // Refunds in range
    Refund.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          createdAt: { $gte: startUTC, $lte: endUTC },
        },
      },
      {
        $group: {
          _id: null,
          totalPaise: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    // Membership Revenue (Purchases, Renewals, Upgrades)
    Payment.aggregate([
      {
        $match: {
          ...paidMatch,
          paymentPurpose: {
            $in: ['MEMBERSHIP_NEW', 'MEMBERSHIP_RENEWAL', 'MEMBERSHIP_UPGRADE'],
          },
        },
      },
      {
        $group: {
          _id: '$paymentPurpose',
          totalPaise: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    // Advance Payments (e.g. GTA 6 advance payments)
    Payment.aggregate([
      {
        $match: {
          ...paidMatch,
          paymentPurpose: 'GTA6_ADVANCE',
        },
      },
      {
        $group: {
          _id: null,
          totalPaise: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    // Outstanding Booking Balances for bookings active or completed in range
    Booking.aggregate([
      {
        $match: {
          bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] },
          balanceRemaining: { $gt: 0 },
          bookingDate: { $gte: startISTStr, $lte: endISTStr },
        },
      },
      {
        $group: {
          _id: null,
          totalPaise: { $sum: '$balanceRemaining' },
          count: { $sum: 1 },
        },
      },
    ]),
    // Daily revenue trends using IST grouping
    Payment.aggregate([
      { $match: paidMatch },
      {
        $project: {
          amount: 1,
          refundedAmount: 1,
          dateStr: {
            $dateToString: {
              date: { $ifNull: ['$paidAt', '$createdAt'] },
              timezone: '+05:30',
              format: '%Y-%m-%d',
            },
          },
        },
      },
      {
        $group: {
          _id: '$dateStr',
          grossPaise: { $sum: '$amount' },
          refundsPaise: { $sum: '$refundedAmount' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const grossCollectionsPaise = grossAgg[0]?.totalPaise || 0;
  const totalRefundsPaise = refundsAgg[0]?.totalPaise || 0;
  const netCollectionsPaise = Math.max(0, grossCollectionsPaise - totalRefundsPaise);
  const outstandingPaise = outstandingAgg[0]?.totalPaise || 0;
  const advancePaise = advanceAgg[0]?.totalPaise || 0;

  let membershipNewPaise = 0;
  let membershipRenewPaise = 0;
  let membershipUpgradePaise = 0;
  membershipAgg.forEach((item) => {
    if (item._id === 'MEMBERSHIP_NEW') membershipNewPaise = item.totalPaise;
    if (item._id === 'MEMBERSHIP_RENEWAL') membershipRenewPaise = item.totalPaise;
    if (item._id === 'MEMBERSHIP_UPGRADE') membershipUpgradePaise = item.totalPaise;
  });
  const totalMembershipRevenuePaise =
    membershipNewPaise + membershipRenewPaise + membershipUpgradePaise;

  const trends = dailyTrendsAgg.map((d) => ({
    date: d._id,
    grossPaise: d.grossPaise,
    grossRupees: d.grossPaise / 100,
    refundsPaise: d.refundsPaise,
    refundsRupees: d.refundsPaise / 100,
    netPaise: Math.max(0, d.grossPaise - d.refundsPaise),
    netRupees: Math.max(0, d.grossPaise - d.refundsPaise) / 100,
    transactions: d.transactionCount,
  }));

  return {
    dateRange: { start: startISTStr, end: endISTStr, range },
    grossCollectionsPaise,
    grossCollectionsRupees: grossCollectionsPaise / 100,
    totalRefundsPaise,
    totalRefundsRupees: totalRefundsPaise / 100,
    netCollectionsPaise,
    netCollectionsRupees: netCollectionsPaise / 100,
    outstandingBalancesPaise: outstandingPaise,
    outstandingBalancesRupees: outstandingPaise / 100,
    advancePaymentsPaise: advancePaise,
    advancePaymentsRupees: advancePaise / 100,
    membershipRevenue: {
      totalPaise: totalMembershipRevenuePaise,
      totalRupees: totalMembershipRevenuePaise / 100,
      newPaise: membershipNewPaise,
      newRupees: membershipNewPaise / 100,
      renewalPaise: membershipRenewPaise,
      renewalRupees: membershipRenewPaise / 100,
      upgradePaise: membershipUpgradePaise,
      upgradeRupees: membershipUpgradePaise / 100,
    },
    trends,
  };
}

/**
 * 3. Revenue Breakdown By Physical Device & GTA 6
 */
export async function getRevenueByDevice({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC } = getISTDateRange(range, startDate, endDate);

  // Aggregate paid payments linked to bookings
  const deviceAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] },
        $or: [
          { paidAt: { $gte: startUTC, $lte: endUTC } },
          { paidAt: null, createdAt: { $gte: startUTC, $lte: endUTC } },
        ],
        booking: { $ne: null },
      },
    },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bookingDoc',
      },
    },
    { $unwind: '$bookingDoc' },
    {
      $lookup: {
        from: 'devices',
        localField: 'bookingDoc.device',
        foreignField: '_id',
        as: 'deviceDoc',
      },
    },
    { $unwind: '$deviceDoc' },
    {
      $lookup: {
        from: 'games',
        localField: 'bookingDoc.game',
        foreignField: '_id',
        as: 'gameDoc',
      },
    },
    {
      $project: {
        amount: 1,
        refundedAmount: 1,
        deviceCode: '$deviceDoc.deviceCode',
        deviceName: '$deviceDoc.name',
        isGTA6: {
          $cond: [
            {
              $and: [
                { $gt: [{ $size: '$gameDoc' }, 0] },
                { $eq: [{ $arrayElemAt: ['$gameDoc.name', 0] }, 'GTA 6'] },
              ],
            },
            true,
            false,
          ],
        },
      },
    },
    {
      $group: {
        _id: { deviceCode: '$deviceCode', deviceName: '$deviceName', isGTA6: '$isGTA6' },
        totalPaise: { $sum: '$amount' },
        refundsPaise: { $sum: '$refundedAmount' },
        paymentCount: { $sum: 1 },
      },
    },
  ]);

  // Aggregate membership revenue (separate from physical devices)
  const membershipAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID'] },
        createdAt: { $gte: startUTC, $lte: endUTC },
        paymentPurpose: {
          $in: ['MEMBERSHIP_NEW', 'MEMBERSHIP_RENEWAL', 'MEMBERSHIP_UPGRADE'],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalPaise: { $sum: '$amount' },
        refundsPaise: { $sum: '$refundedAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Map to the 3 physical devices and GTA 6 breakdown
  let ps5_01 = { name: 'PS5 Station 1', code: 'PS5-01', totalPaise: 0, count: 0 };
  let ps5_02 = { name: 'PS5 Station 2', code: 'PS5-02', totalPaise: 0, count: 0 };
  let pool_01 = { name: '8-Ball Pool Table', code: 'POOL-01', totalPaise: 0, count: 0 };
  let gta6Exclusive = { name: 'GTA 6 (Exclusive on PS5)', totalPaise: 0, count: 0 };

  deviceAgg.forEach((item) => {
    const net = Math.max(0, item.totalPaise - item.refundsPaise);
    if (item._id.isGTA6) {
      gta6Exclusive.totalPaise += net;
      gta6Exclusive.count += item.paymentCount;
    }
    if (item._id.deviceCode === 'PS5-01') {
      ps5_01.totalPaise += net;
      ps5_01.count += item.paymentCount;
    } else if (item._id.deviceCode === 'PS5-02') {
      ps5_02.totalPaise += net;
      ps5_02.count += item.paymentCount;
    } else if (item._id.deviceCode === 'POOL-01') {
      pool_01.totalPaise += net;
      pool_01.count += item.paymentCount;
    }
  });

  const memberNet = Math.max(
    0,
    (membershipAgg[0]?.totalPaise || 0) - (membershipAgg[0]?.refundsPaise || 0)
  );

  return {
    devices: [
      {
        ...ps5_01,
        totalRupees: ps5_01.totalPaise / 100,
      },
      {
        ...ps5_02,
        totalRupees: ps5_02.totalPaise / 100,
      },
      {
        ...pool_01,
        totalRupees: pool_01.totalPaise / 100,
      },
    ],
    gta6Breakdown: {
      ...gta6Exclusive,
      totalRupees: gta6Exclusive.totalPaise / 100,
      note: 'GTA 6 is a game played on physical PS5 consoles, not a separate device.',
    },
    memberships: {
      name: 'Monthly Memberships',
      totalPaise: memberNet,
      totalRupees: memberNet / 100,
      count: membershipAgg[0]?.count || 0,
    },
  };
}

/**
 * 4. Revenue Breakdown By Game
 */
export async function getRevenueByGame({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC } = getISTDateRange(range, startDate, endDate);

  const gameAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] },
        $or: [
          { paidAt: { $gte: startUTC, $lte: endUTC } },
          { paidAt: null, createdAt: { $gte: startUTC, $lte: endUTC } },
        ],
        booking: { $ne: null },
      },
    },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bookingDoc',
      },
    },
    { $unwind: '$bookingDoc' },
    {
      $lookup: {
        from: 'games',
        localField: 'bookingDoc.game',
        foreignField: '_id',
        as: 'gameDoc',
      },
    },
    {
      $project: {
        amount: 1,
        refundedAmount: 1,
        gameId: { $arrayElemAt: ['$gameDoc._id', 0] },
        gameName: {
          $ifNull: [{ $arrayElemAt: ['$gameDoc.name', 0] }, 'Pool / Free Play'],
        },
        isExclusive: {
          $ifNull: [{ $arrayElemAt: ['$gameDoc.isExclusive', 0] }, false],
        },
        duration: '$bookingDoc.duration',
      },
    },
    {
      $group: {
        _id: { gameId: '$gameId', gameName: '$gameName', isExclusive: '$isExclusive' },
        totalPaise: { $sum: '$amount' },
        refundsPaise: { $sum: '$refundedAmount' },
        paymentCount: { $sum: 1 },
        totalHours: { $sum: '$duration' },
      },
    },
    { $sort: { totalPaise: -1 } },
  ]);

  return gameAgg.map((g) => {
    const net = Math.max(0, g.totalPaise - g.refundsPaise);
    return {
      gameId: g._id.gameId,
      gameName: g._id.gameName,
      isExclusive: g._id.isExclusive,
      totalPaise: net,
      totalRupees: net / 100,
      bookingsCount: g.paymentCount,
      totalHours: g.totalHours || 0,
      isGTA6: g._id.gameName === 'GTA 6',
    };
  });
}

/**
 * 5. Revenue Breakdown By Payment Method & Online vs Offline
 */
export async function getRevenueByPaymentMethod({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC } = getISTDateRange(range, startDate, endDate);

  const methodAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] },
        $or: [
          { paidAt: { $gte: startUTC, $lte: endUTC } },
          { paidAt: null, createdAt: { $gte: startUTC, $lte: endUTC } },
        ],
      },
    },
    {
      $group: {
        _id: {
          gateway: '$paymentGateway',
          method: '$paymentMethod',
        },
        totalPaise: { $sum: '$amount' },
        refundsPaise: { $sum: '$refundedAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  let cashPaise = 0,
    cashCount = 0;
  let counterUpiPaise = 0,
    counterUpiCount = 0;
  let razorpayUpiPaise = 0,
    razorpayUpiCount = 0;
  let cardsPaise = 0,
    cardsCount = 0;
  let otherPaise = 0,
    otherCount = 0;

  let offlineTotalPaise = 0;
  let onlineTotalPaise = 0;

  methodAgg.forEach((item) => {
    const net = Math.max(0, item.totalPaise - item.refundsPaise);
    const { gateway, method } = item._id;

    if (gateway === 'OFFLINE_CASH' || method === 'CASH') {
      cashPaise += net;
      cashCount += item.count;
      offlineTotalPaise += net;
    } else if (gateway === 'OFFLINE_COUNTER_UPI' || method === 'COUNTER_UPI') {
      counterUpiPaise += net;
      counterUpiCount += item.count;
      offlineTotalPaise += net;
    } else if (gateway === 'RAZORPAY') {
      onlineTotalPaise += net;
      if (method === 'UPI') {
        razorpayUpiPaise += net;
        razorpayUpiCount += item.count;
      } else if (method === 'CARD') {
        cardsPaise += net;
        cardsCount += item.count;
      } else {
        otherPaise += net;
        otherCount += item.count;
      }
    } else {
      otherPaise += net;
      otherCount += item.count;
    }
  });

  return {
    methods: [
      {
        method: 'Cash (Counter)',
        type: 'OFFLINE',
        amountPaise: cashPaise,
        amountRupees: cashPaise / 100,
        count: cashCount,
      },
      {
        method: 'UPI (Counter QR)',
        type: 'OFFLINE',
        amountPaise: counterUpiPaise,
        amountRupees: counterUpiPaise / 100,
        count: counterUpiCount,
      },
      {
        method: 'Razorpay UPI',
        type: 'ONLINE',
        amountPaise: razorpayUpiPaise,
        amountRupees: razorpayUpiPaise / 100,
        count: razorpayUpiCount,
      },
      {
        method: 'Debit / Credit Cards',
        type: 'ONLINE',
        amountPaise: cardsPaise,
        amountRupees: cardsPaise / 100,
        count: cardsCount,
      },
      {
        method: 'Netbanking / Other',
        type: 'ONLINE',
        amountPaise: otherPaise,
        amountRupees: otherPaise / 100,
        count: otherCount,
      },
    ],
    collectionChannels: {
      onlinePaise: onlineTotalPaise,
      onlineRupees: onlineTotalPaise / 100,
      offlinePaise: offlineTotalPaise,
      offlineRupees: offlineTotalPaise / 100,
      totalNetPaise: onlineTotalPaise + offlineTotalPaise,
      totalNetRupees: (onlineTotalPaise + offlineTotalPaise) / 100,
      offlineSharePct:
        onlineTotalPaise + offlineTotalPaise > 0
          ? ((offlineTotalPaise / (onlineTotalPaise + offlineTotalPaise)) * 100).toFixed(1)
          : 0,
      onlineSharePct:
        onlineTotalPaise + offlineTotalPaise > 0
          ? ((onlineTotalPaise / (onlineTotalPaise + offlineTotalPaise)) * 100).toFixed(1)
          : 0,
    },
  };
}

/**
 * 6. Booking Analytics & Trends
 */
export async function getBookingAnalytics({ range = '30d', startDate, endDate }) {
  const { startISTStr, endISTStr } = getISTDateRange(range, startDate, endDate);

  const matchCondition = {
    bookingDate: { $gte: startISTStr, $lte: endISTStr },
  };

  const [
    statusCounts,
    typeCounts,
    sourceCounts,
    durationStats,
    dayOfWeekAgg,
    hourOfDayAgg,
    topDevicesAgg,
    topGamesAgg,
  ] = await Promise.all([
    // Status counts
    Booking.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 },
        },
      },
    ]),
    // Type counts (SHARED vs PRIVATE)
    Booking.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$bookingType',
          count: { $sum: 1 },
        },
      },
    ]),
    // Source counts (Walk-in vs Online)
    Booking.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$isWalkIn',
          count: { $sum: 1 },
        },
      },
    ]),
    // Duration stats
    Booking.aggregate([
      { $match: { ...matchCondition, bookingStatus: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          totalDuration: { $sum: '$duration' },
          totalBookings: { $sum: 1 },
        },
      },
    ]),
    // Day of Week Distribution (using IST startAt)
    Booking.aggregate([
      { $match: { ...matchCondition, bookingStatus: { $ne: 'CANCELLED' } } },
      {
        $project: {
          dayOfWeek: {
            $dayOfWeek: {
              date: '$startAt',
              timezone: '+05:30',
            },
          },
        },
      },
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // Hour of Day Distribution (Peak hours)
    Booking.aggregate([
      { $match: { ...matchCondition, bookingStatus: { $ne: 'CANCELLED' } } },
      {
        $project: {
          hour: {
            $hour: {
              date: '$startAt',
              timezone: '+05:30',
            },
          },
        },
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // Top Devices
    Booking.aggregate([
      { $match: { ...matchCondition, bookingStatus: { $ne: 'CANCELLED' } } },
      {
        $lookup: {
          from: 'devices',
          localField: 'device',
          foreignField: '_id',
          as: 'deviceDoc',
        },
      },
      { $unwind: '$deviceDoc' },
      {
        $group: {
          _id: '$deviceDoc.name',
          code: { $first: '$deviceDoc.deviceCode' },
          count: { $sum: 1 },
          totalHours: { $sum: '$duration' },
        },
      },
      { $sort: { count: -1 } },
    ]),
    // Top Games
    Booking.aggregate([
      { $match: { ...matchCondition, bookingStatus: { $ne: 'CANCELLED' } } },
      {
        $lookup: {
          from: 'games',
          localField: 'game',
          foreignField: '_id',
          as: 'gameDoc',
        },
      },
      {
        $group: {
          _id: {
            $ifNull: [{ $arrayElemAt: ['$gameDoc.name', 0] }, 'Free Play / Pool'],
          },
          count: { $sum: 1 },
          totalHours: { $sum: '$duration' },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  let totalBookings = 0;
  let confirmed = 0;
  let completed = 0;
  let cancelled = 0;
  statusCounts.forEach((s) => {
    totalBookings += s.count;
    if (s._id === 'CONFIRMED') confirmed = s.count;
    if (s._id === 'COMPLETED') completed = s.count;
    if (s._id === 'CANCELLED') cancelled = s.count;
  });

  const noShowCount = await Booking.countDocuments({
    ...matchCondition,
    checkInStatus: 'NO_SHOW',
  });

  let sharedBookings = 0;
  let privateBookings = 0;
  typeCounts.forEach((t) => {
    if (t._id === 'SHARED') sharedBookings = t.count;
    if (t._id === 'PRIVATE') privateBookings = t.count;
  });

  let walkInBookings = 0;
  let onlineBookings = 0;
  sourceCounts.forEach((sc) => {
    if (sc._id === true) walkInBookings = sc.count;
    if (sc._id === false) onlineBookings = sc.count;
  });

  const avgDurationHours = durationStats[0]?.avgDuration || 0;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayDistribution = dayNames.map((name, idx) => {
    const mongoDay = idx + 1; // 1 is Sunday in Mongo $dayOfWeek
    const found = dayOfWeekAgg.find((d) => d._id === mongoDay);
    return { day: name, bookings: found ? found.count : 0 };
  });

  const hourDistribution = [];
  for (let h = 10; h <= 23; h++) {
    const found = hourOfDayAgg.find((item) => item._id === h);
    const label = `${h.toString().padStart(2, '0')}:00`;
    hourDistribution.push({
      hour: label,
      rawHour: h,
      bookings: found ? found.count : 0,
    });
  }

  return {
    metrics: {
      totalBookings,
      confirmedBookings: confirmed,
      completedBookings: completed,
      cancelledBookings: cancelled,
      noShowBookings: noShowCount,
      sharedBookings,
      privateBookings,
      walkInBookings,
      onlineBookings,
      averageDurationHours: Number(avgDurationHours.toFixed(2)),
      averageDurationMinutes: Math.round(avgDurationHours * 60),
    },
    peakDays: dayDistribution,
    peakHours: hourDistribution,
    topDevices: topDevicesAgg.map((d) => ({
      deviceName: d._id,
      deviceCode: d.code,
      bookings: d.count,
      hours: d.totalHours,
    })),
    topGames: topGamesAgg.map((g) => ({
      gameName: g._id,
      bookings: g.count,
      hours: g.totalHours,
    })),
  };
}

/**
 * 7. Device Utilization Analytics
 * Operating hours: 10:00 to 23:00 IST = 13 hours/day
 * Formula: Utilization % = (Booked Hours / Available Operating Hours) * 100
 * where Available Operating Hours = (Days * 13) - Maintenance Downtime Hours.
 */
export async function getDeviceUtilization({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC, startISTStr, endISTStr, dayCount } = getISTDateRange(
    range,
    startDate,
    endDate
  );

  const operatingHoursPerDay = 13;
  const nominalOperatingHours = dayCount * operatingHoursPerDay;

  // Retrieve physical devices
  const physicalDevices = await Device.find({}).sort({ deviceCode: 1 });

  // Get bookings per device in range
  const bookingAgg = await Booking.aggregate([
    {
      $match: {
        bookingDate: { $gte: startISTStr, $lte: endISTStr },
        bookingStatus: { $ne: 'CANCELLED' },
      },
    },
    {
      $group: {
        _id: '$device',
        totalBookedHours: { $sum: '$duration' },
        bookingsCount: { $sum: 1 },
        totalAmountPaidPaise: { $sum: '$amountPaid' },
        activeHours: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$sessionStatus', 'ACTIVE'] },
                  { $eq: ['$sessionStatus', 'EXTENDED'] },
                ],
              },
              '$duration',
              0,
            ],
          },
        },
      },
    },
  ]);

  // Get maintenance records overlapping with this period
  const maintenanceAgg = await DeviceMaintenance.aggregate([
    {
      $match: {
        status: { $in: ['IN_PROGRESS', 'COMPLETED', 'SCHEDULED'] },
        startDate: { $lte: endUTC },
        $or: [{ actualEndDate: { $gte: startUTC } }, { actualEndDate: null }],
      },
    },
  ]);

  const results = physicalDevices.map((dev) => {
    const bData = bookingAgg.find(
      (b) => b._id && b._id.toString() === dev._id.toString()
    ) || {
      totalBookedHours: 0,
      bookingsCount: 0,
      totalAmountPaidPaise: 0,
      activeHours: 0,
    };

    // Calculate maintenance downtime hours within window
    let downtimeHours = 0;
    maintenanceAgg
      .filter((m) => m.device && m.device.toString() === dev._id.toString())
      .forEach((m) => {
        const mStart = Math.max(m.startDate.getTime(), startUTC.getTime());
        const mEnd = m.actualEndDate
          ? Math.min(m.actualEndDate.getTime(), endUTC.getTime())
          : Math.min(Date.now(), endUTC.getTime());
        if (mEnd > mStart) {
          downtimeHours += (mEnd - mStart) / (1000 * 60 * 60);
        }
      });

    const maintenanceHours = Math.round(downtimeHours * 10) / 10;
    const availableHours = Math.max(0, nominalOperatingHours - maintenanceHours);
    const bookedHours = Math.round(bData.totalBookedHours * 10) / 10;

    const utilizationPct =
      availableHours > 0
        ? Math.min(100, Number(((bookedHours / availableHours) * 100).toFixed(1)))
        : 0;

    return {
      deviceId: dev._id,
      deviceName: dev.name,
      deviceCode: dev.deviceCode,
      deviceType: dev.deviceType,
      capacity: dev.capacity,
      status: dev.status,
      operatingHours: nominalOperatingHours,
      maintenanceHours,
      availableHours,
      bookedHours,
      activeHours: Math.round(bData.activeHours * 10) / 10,
      utilizationPercentage: utilizationPct,
      totalRevenuePaise: bData.totalAmountPaidPaise,
      totalRevenueRupees: bData.totalAmountPaidPaise / 100,
      bookingsCount: bData.bookingsCount,
    };
  });

  return {
    dateRange: { start: startISTStr, end: endISTStr, days: dayCount },
    operatingHoursPerDay,
    devices: results,
  };
}

/**
 * 8. Game Performance Analytics
 */
export async function getGamePerformance({ range = '30d', startDate, endDate, deviceId }) {
  const { startISTStr, endISTStr } = getISTDateRange(range, startDate, endDate);

  const matchCondition = {
    bookingDate: { $gte: startISTStr, $lte: endISTStr },
    bookingStatus: { $ne: 'CANCELLED' },
  };

  if (deviceId && mongoose.Types.ObjectId.isValid(deviceId)) {
    matchCondition.device = new mongoose.Types.ObjectId(deviceId);
  }

  const performanceAgg = await Booking.aggregate([
    { $match: matchCondition },
    {
      $lookup: {
        from: 'games',
        localField: 'game',
        foreignField: '_id',
        as: 'gameDoc',
      },
    },
    {
      $lookup: {
        from: 'devices',
        localField: 'device',
        foreignField: '_id',
        as: 'deviceDoc',
      },
    },
    {
      $project: {
        duration: 1,
        amountPaid: 1,
        totalAmount: 1,
        gameId: { $arrayElemAt: ['$gameDoc._id', 0] },
        gameName: {
          $ifNull: [{ $arrayElemAt: ['$gameDoc.name', 0] }, 'Standard Play / Pool'],
        },
        isExclusive: {
          $ifNull: [{ $arrayElemAt: ['$gameDoc.isExclusive', 0] }, false],
        },
        deviceCode: { $arrayElemAt: ['$deviceDoc.deviceCode', 0] },
        deviceName: { $arrayElemAt: ['$deviceDoc.name', 0] },
      },
    },
    {
      $group: {
        _id: {
          gameId: '$gameId',
          gameName: '$gameName',
          isExclusive: '$isExclusive',
        },
        totalHours: { $sum: '$duration' },
        bookingsCount: { $sum: 1 },
        totalRevenuePaise: { $sum: '$amountPaid' },
        devicesPlayedOn: { $addToSet: '$deviceName' },
      },
    },
    { $sort: { totalRevenuePaise: -1 } },
  ]);

  return performanceAgg.map((g) => ({
    gameId: g._id.gameId,
    gameName: g._id.gameName,
    isExclusive: g._id.isExclusive,
    isGTA6: g._id.gameName === 'GTA 6',
    totalHours: Number(g.totalHours.toFixed(1)),
    bookingsCount: g.bookingsCount,
    totalRevenuePaise: g.totalRevenuePaise,
    totalRevenueRupees: g.totalRevenuePaise / 100,
    devicesPlayedOn: g.devicesPlayedOn,
  }));
}

/**
 * 9. Customer Analytics
 */
export async function getCustomerAnalytics({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC, startISTStr, endISTStr } = getISTDateRange(range, startDate, endDate);
  const now = new Date();

  // 1. Core customer and membership counts (counting unique customers)
  const [
    totalCustomers,
    newCustomersCount,
    activePassCustomerIds,
    allPassCustomerIds,
    recentRegistrations,
  ] = await Promise.all([
    // Total Customers
    User.countDocuments({ role: 'customer' }),
    // New Customers registered in range
    User.countDocuments({ role: 'customer', createdAt: { $gte: startUTC, $lte: endUTC } }),
    // Unique customers with currently valid active membership
    MembershipSubscription.distinct('customer', {
      status: 'ACTIVE',
      expirationDate: { $gte: now },
    }),
    // Unique customers with any subscription history
    MembershipSubscription.distinct('customer', {
      status: { $in: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'UPGRADED'] },
    }),
    // Recent registrations
    User.find({ role: 'customer' })
      .select('name email phone createdAt isActive')
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  // Unique active members among customers
  const activeMembersCount = (
    await User.find({ _id: { $in: activePassCustomerIds }, role: 'customer' }).distinct('_id')
  ).length;

  // Unique expired members (customers with subscription history who have NO active membership)
  const expiredCustomerIds = allPassCustomerIds.filter(
    (id) => !activePassCustomerIds.some((actId) => String(actId) === String(id))
  );
  const expiredMembersCount = (
    await User.find({ _id: { $in: expiredCustomerIds }, role: 'customer' }).distinct('_id')
  ).length;

  // 2. Top Customers by spending
  const topSpendersAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] },
      },
    },
    {
      $group: {
        _id: '$customer',
        totalSpentPaise: { $sum: '$amount' },
        paymentsCount: { $sum: 1 },
        lastPaymentAt: { $max: { $ifNull: ['$paidAt', '$createdAt'] } },
      },
    },
    { $sort: { totalSpentPaise: -1 } },
    { $limit: 10 },
  ]);

  const topCustIds = topSpendersAgg.map((s) => s._id);

  // Fetch user docs, subscriptions, and plans for the top spenders
  const [topUsers, topSubs, allPlans] = await Promise.all([
    User.find({ _id: { $in: topCustIds } }).select('name email phone createdAt membership').lean(),
    MembershipSubscription.find({ customer: { $in: topCustIds } })
      .populate('membershipPlan', 'name planCode durationDays')
      .sort({ expirationDate: -1, createdAt: -1 })
      .lean(),
    MembershipPlan.find({}).select('name').lean(),
  ]);

  const userMap = new Map(topUsers.map((u) => [String(u._id), u]));
  const planMap = new Map(allPlans.map((p) => [String(p._id), p.name]));

  const subsByCustomer = new Map();
  for (const sub of topSubs) {
    const k = String(sub.customer);
    if (!subsByCustomer.has(k)) subsByCustomer.set(k, []);
    subsByCustomer.get(k).push(sub);
  }

  // Resolve customer membership classification from complete history
  const resolveCustomerMembership = (customerSubs, userDoc) => {
    if (!customerSubs || customerSubs.length === 0) {
      if (
        userDoc?.membership?.status === 'ACTIVE' &&
        userDoc.membership.expiresAt &&
        new Date(userDoc.membership.expiresAt) >= now
      ) {
        const pName = userDoc.membership.planId ? planMap.get(String(userDoc.membership.planId)) : null;
        return {
          status: 'ACTIVE',
          planName: pName || 'Active Pass',
          expirationDate: userDoc.membership.expiresAt,
        };
      }
      return { status: 'NONE', planName: 'Non-Member', expirationDate: null };
    }

    // Sort by expirationDate desc
    customerSubs.sort((a, b) => new Date(b.expirationDate || 0) - new Date(a.expirationDate || 0));

    // 1. Active membership
    const active = customerSubs.find(
      (s) => s.status === 'ACTIVE' && s.expirationDate && new Date(s.expirationDate) >= now
    );
    if (active) {
      return {
        status: 'ACTIVE',
        planName: active.membershipPlan?.name || 'Active Pass',
        expirationDate: active.expirationDate,
      };
    }

    // 2. Expired / Upgraded / Cancelled membership
    const expired = customerSubs.find(
      (s) =>
        s.status === 'EXPIRED' ||
        (s.expirationDate && new Date(s.expirationDate) < now) ||
        s.status === 'UPGRADED' ||
        s.status === 'CANCELLED'
    );
    if (expired) {
      return {
        status: 'EXPIRED',
        planName: expired.membershipPlan?.name || 'Previous Pass',
        expirationDate: expired.expirationDate,
      };
    }

    // 3. Suspended
    const suspended = customerSubs.find((s) => s.status === 'SUSPENDED');
    if (suspended) {
      return {
        status: 'SUSPENDED',
        planName: suspended.membershipPlan?.name || 'Suspended Pass',
        expirationDate: suspended.expirationDate,
      };
    }

    return { status: 'NONE', planName: 'Non-Member', expirationDate: null };
  };

  const topSpenders = topSpendersAgg.map((s) => {
    const u = userMap.get(String(s._id)) || {};
    const cSubs = subsByCustomer.get(String(s._id)) || [];
    const mem = resolveCustomerMembership(cSubs, u);

    return {
      customerId: s._id,
      name: u.name || 'Unknown Gamer',
      email: u.email || 'N/A',
      phone: u.phone || 'N/A',
      totalSpentPaise: s.totalSpentPaise,
      totalSpentRupees: s.totalSpentPaise / 100,
      transactionsCount: s.paymentsCount,
      lastPaymentAt: s.lastPaymentAt,
      membershipStatus: mem.status, // 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NONE'
      activePlan: mem.planName,
      expirationDate: mem.expirationDate,
    };
  });

  // Calculate active customers in period (had at least 1 booking)
  const activeCustomerIds = await Booking.distinct('customer', {
    bookingDate: { $gte: startISTStr, $lte: endISTStr },
    bookingStatus: { $ne: 'CANCELLED' },
  });

  const activeCustomersCount = activeCustomerIds.length;
  const inactiveCustomersCount = Math.max(0, totalCustomers - activeCustomersCount);

  // Overall spending averages
  const overallPaymentAgg = await Payment.aggregate([
    { $match: { paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID'] } } },
    { $group: { _id: null, totalPaise: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const totalPaise = overallPaymentAgg[0]?.totalPaise || 0;
  const avgSpendPaise = totalCustomers > 0 ? Math.round(totalPaise / totalCustomers) : 0;

  const totalBookingsCount = await Booking.countDocuments({ bookingStatus: { $ne: 'CANCELLED' } });
  const avgSessions = totalCustomers > 0 ? Number((totalBookingsCount / totalCustomers).toFixed(1)) : 0;

  return {
    overview: {
      totalCustomers,
      newCustomers: newCustomersCount,
      activeCustomers: activeCustomersCount,
      inactiveCustomers: inactiveCustomersCount,
      customersWithActiveMembership: activeMembersCount,
      customersWithExpiredMembership: expiredMembersCount,
      averageSpendPaise: avgSpendPaise,
      averageSpendRupees: avgSpendPaise / 100,
      averageSessionsPerCustomer: avgSessions,
    },
    topSpenders,
    recentRegistrations: recentRegistrations.map((u) => ({
      customerId: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone || 'N/A',
      registeredAt: u.createdAt,
      isActive: u.isActive,
    })),
  };
}

/**
 * 10. Membership Analytics
 */
export async function getMembershipAnalytics({ range = '30d', startDate, endDate }) {
  const { startUTC, endUTC } = getISTDateRange(range, startDate, endDate);

  const [
    allSubscriptions,
    activeCount,
    expiredCount,
    suspendedCount,
    upgradesCount,
    planSalesAgg,
    usageAgg,
  ] = await Promise.all([
    // All subscriptions
    MembershipSubscription.countDocuments({}),
    // Active
    MembershipSubscription.countDocuments({ status: 'ACTIVE', expirationDate: { $gte: new Date() } }),
    // Expired
    MembershipSubscription.countDocuments({ status: 'EXPIRED' }),
    // Suspended
    MembershipSubscription.countDocuments({ status: 'SUSPENDED' }),
    // Upgrades
    MembershipUpgrade.countDocuments({ status: 'COMPLETED' }),
    // Plan sales and revenue
    Payment.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID'] },
          paymentPurpose: {
            $in: ['MEMBERSHIP_NEW', 'MEMBERSHIP_RENEWAL', 'MEMBERSHIP_UPGRADE'],
          },
          createdAt: { $gte: startUTC, $lte: endUTC },
        },
      },
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'membershipPlan',
          foreignField: '_id',
          as: 'planDoc',
        },
      },
      {
        $group: {
          _id: {
            planId: '$membershipPlan',
            planName: {
              $ifNull: [{ $arrayElemAt: ['$planDoc.name', 0] }, 'Gaming Pass'],
            },
          },
          totalPaise: { $sum: '$amount' },
          salesCount: { $sum: 1 },
        },
      },
      { $sort: { totalPaise: -1 } },
    ]),
    // Usage stats
    MembershipUsage.aggregate([
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$minutesUsed' },
          sessionsCount: { $sum: 1 },
          avgMinutes: { $avg: '$minutesUsed' },
        },
      },
    ]),
  ]);

  const totalSalesPaise = planSalesAgg.reduce((acc, p) => acc + p.totalPaise, 0);
  const renewalCount = await Payment.countDocuments({
    paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID'] },
    paymentPurpose: 'MEMBERSHIP_RENEWAL',
    createdAt: { $gte: startUTC, $lte: endUTC },
  });

  const renewalRate =
    expiredCount + renewalCount > 0
      ? Number(((renewalCount / (expiredCount + renewalCount)) * 100).toFixed(1))
      : 0;

  return {
    metrics: {
      totalSubscriptions: allSubscriptions,
      activeSubscriptions: activeCount,
      expiredSubscriptions: expiredCount,
      suspendedSubscriptions: suspendedCount,
      membershipRenewals: renewalCount,
      membershipUpgrades: upgradesCount,
      renewalRatePercentage: renewalRate,
      totalRevenuePaise: totalSalesPaise,
      totalRevenueRupees: totalSalesPaise / 100,
      totalUsageMinutes: usageAgg[0]?.totalMinutes || 0,
      averageUsageMinutes: Math.round(usageAgg[0]?.avgMinutes || 0),
    },
    planPerformance: planSalesAgg.map((p) => ({
      planId: p._id.planId,
      planName: p._id.planName,
      salesCount: p.salesCount,
      revenuePaise: p.totalPaise,
      revenueRupees: p.totalPaise / 100,
    })),
  };
}

/**
 * 11. Receptionist Performance Monitoring
 */
export async function getReceptionistPerformance({ range = '30d', startDate, endDate, receptionistId }) {
  const { startUTC, endUTC } = getISTDateRange(range, startDate, endDate);

  // Find all receptionist and staff users
  const staffQuery = { role: { $in: ['receptionist', 'admin'] } };
  if (receptionistId && mongoose.Types.ObjectId.isValid(receptionistId)) {
    staffQuery._id = new mongoose.Types.ObjectId(receptionistId);
  }
  const staffUsers = await User.find(staffQuery).select('name email role');

  // Bookings created by staff
  const bookingsCreatedAgg = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startUTC, $lte: endUTC },
        $or: [{ walkInCreatedBy: { $ne: null } }],
      },
    },
    {
      $group: {
        _id: '$walkInCreatedBy',
        walkInCount: { $sum: { $cond: [{ $eq: ['$isWalkIn', true] }, 1, 0] } },
        totalCreated: { $sum: 1 },
      },
    },
  ]);

  // Check-ins performed by staff
  const checkinsAgg = await Booking.aggregate([
    {
      $match: {
        checkedInAt: { $gte: startUTC, $lte: endUTC },
        checkedInBy: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$checkedInBy',
        checkInsCount: { $sum: 1 },
      },
    },
  ]);

  // Sessions completed by staff
  const completionsAgg = await Booking.aggregate([
    {
      $match: {
        sessionCompletedAt: { $gte: startUTC, $lte: endUTC },
        sessionCompletedBy: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$sessionCompletedBy',
        completedCount: { $sum: 1 },
      },
    },
  ]);

  // Payments collected by staff at counter
  const paymentsAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID'] },
        createdAt: { $gte: startUTC, $lte: endUTC },
        collectedBy: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$collectedBy',
        cashPaise: {
          $sum: {
            $cond: [
              { $in: ['$paymentGateway', ['OFFLINE_CASH', 'CASH']] },
              '$amount',
              0,
            ],
          },
        },
        upiPaise: {
          $sum: {
            $cond: [
              { $in: ['$paymentGateway', ['OFFLINE_COUNTER_UPI', 'COUNTER_UPI']] },
              '$amount',
              0,
            ],
          },
        },
        totalPaise: { $sum: '$amount' },
        paymentsCount: { $sum: 1 },
      },
    },
  ]);

  // Recent activity audit logs
  const activityLogs = await ActivityLog.find({
    category: { $in: ['RECEPTIONIST', 'BOOKING', 'PAYMENT'] },
    createdAt: { $gte: startUTC, $lte: endUTC },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  const receptionistStats = staffUsers.map((staff) => {
    const sId = staff._id.toString();
    const bCreated = bookingsCreatedAgg.find((b) => b._id && b._id.toString() === sId);
    const cIn = checkinsAgg.find((c) => c._id && c._id.toString() === sId);
    const cOut = completionsAgg.find((co) => co._id && co._id.toString() === sId);
    const pColl = paymentsAgg.find((p) => p._id && p._id.toString() === sId);

    const cashPaise = pColl?.cashPaise || 0;
    const upiPaise = pColl?.upiPaise || 0;
    const totalOfflinePaise = pColl?.totalPaise || 0;

    return {
      staffId: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      bookingsCreated: bCreated?.totalCreated || 0,
      walkInsHandled: bCreated?.walkInCount || 0,
      checkInsPerformed: cIn?.checkInsCount || 0,
      sessionsCompleted: cOut?.completedCount || 0,
      paymentsCollectedCount: pColl?.paymentsCount || 0,
      cashCollectedPaise: cashPaise,
      cashCollectedRupees: cashPaise / 100,
      counterUpiCollectedPaise: upiPaise,
      counterUpiCollectedRupees: upiPaise / 100,
      totalOfflineCollectedPaise: totalOfflinePaise,
      totalOfflineCollectedRupees: totalOfflinePaise / 100,
    };
  });

  return {
    receptionists: receptionistStats,
    auditLogs: activityLogs.map((log) => ({
      id: log._id,
      action: log.action,
      userName: log.userName,
      bookingId: log.bookingId,
      description: log.description,
      status: log.status,
      timestamp: log.createdAt,
    })),
  };
}

/**
 * 12. Device Maintenance Analytics
 */
export async function getMaintenanceAnalytics() {
  const [records, devices] = await Promise.all([
    DeviceMaintenance.find({})
      .populate('device', 'name deviceCode deviceType')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 }),
    Device.find({}),
  ]);

  let totalDowntimeMs = 0;
  const deviceMaintenanceCounts = {};

  records.forEach((rec) => {
    const devCode = rec.device?.deviceCode || 'UNKNOWN';
    deviceMaintenanceCounts[devCode] = (deviceMaintenanceCounts[devCode] || 0) + 1;

    if (rec.startDate) {
      const end = rec.actualEndDate || new Date();
      totalDowntimeMs += Math.max(0, end.getTime() - rec.startDate.getTime());
    }
  });

  const totalDowntimeHours = Math.round((totalDowntimeMs / (1000 * 60 * 60)) * 10) / 10;

  let mostMaintainedDevice = 'None';
  let maxCount = 0;
  Object.entries(deviceMaintenanceCounts).forEach(([dev, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostMaintainedDevice = dev;
    }
  });

  return {
    totalIncidents: records.length,
    totalDowntimeHours,
    mostMaintainedDevice,
    activeIncidentsCount: records.filter((r) => r.status === 'IN_PROGRESS').length,
    scheduledIncidentsCount: records.filter((r) => r.status === 'SCHEDULED').length,
    completedIncidentsCount: records.filter((r) => r.status === 'COMPLETED').length,
    history: records.map((r) => ({
      id: r._id,
      device: r.device ? { name: r.device.name, code: r.device.deviceCode } : null,
      reason: r.reason,
      status: r.status,
      startDate: r.startDate,
      expectedEndDate: r.expectedEndDate,
      actualEndDate: r.actualEndDate,
      notes: r.notes,
      createdBy: r.createdBy?.name || 'Admin',
    })),
  };
}

/**
 * 13. Financial Payments & Outstanding Balance Reports
 */
export async function getFinancialPaymentReports({
  range = '30d',
  startDate,
  endDate,
  status,
  method,
  search,
  page = 1,
  limit = 20,
}) {
  const { startUTC, endUTC } = getISTDateRange(range, startDate, endDate);

  const query = {
    createdAt: { $gte: startUTC, $lte: endUTC },
  };

  if (status) {
    query.paymentStatus = status.toUpperCase();
  }

  if (method) {
    query.paymentMethod = method.toUpperCase();
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const pageSize = parseInt(limit, 10);

  const [payments, totalCount, statusSummaryAgg, outstandingBookings] = await Promise.all([
    Payment.find(query)
      .populate('customer', 'name email phone')
      .populate('booking', 'bookingId bookingDate startTime endTime bookingStatus')
      .populate('collectedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Payment.countDocuments(query),
    // Status breakdown in range
    Payment.aggregate([
      { $match: { createdAt: { $gte: startUTC, $lte: endUTC } } },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalPaise: { $sum: '$amount' },
        },
      },
    ]),
    // Outstanding balances for confirmed or completed bookings
    Booking.find({
      bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] },
      balanceRemaining: { $gt: 0 },
    })
      .populate('customer', 'name email phone')
      .populate('device', 'name deviceCode')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const summary = {
    paidPaise: 0,
    paidCount: 0,
    pendingPaise: 0,
    pendingCount: 0,
    failedPaise: 0,
    failedCount: 0,
    refundedPaise: 0,
    refundedCount: 0,
  };

  statusSummaryAgg.forEach((s) => {
    if (s._id === 'PAID') {
      summary.paidPaise = s.totalPaise;
      summary.paidCount = s.count;
    } else if (s._id === 'PENDING') {
      summary.pendingPaise = s.totalPaise;
      summary.pendingCount = s.count;
    } else if (s._id === 'FAILED') {
      summary.failedPaise = s.totalPaise;
      summary.failedCount = s.count;
    } else if (s._id === 'REFUNDED') {
      summary.refundedPaise = s.totalPaise;
      summary.refundedCount = s.count;
    }
  });

  return {
    pagination: {
      total: totalCount,
      page: parseInt(page, 10),
      limit: pageSize,
      pages: Math.ceil(totalCount / pageSize),
    },
    summary: {
      ...summary,
      paidRupees: summary.paidPaise / 100,
      pendingRupees: summary.pendingPaise / 100,
      failedRupees: summary.failedPaise / 100,
      refundedRupees: summary.refundedPaise / 100,
    },
    outstandingBookings: outstandingBookings.map((b) => ({
      bookingId: b.bookingId,
      customerName: b.customer?.name || 'Walk-in Customer',
      customerEmail: b.customer?.email || 'N/A',
      customerPhone: b.customer?.phone || 'N/A',
      device: b.device ? `${b.device.name} (${b.device.deviceCode})` : 'N/A',
      bookingDate: b.bookingDate,
      totalAmountPaise: b.totalAmount,
      totalAmountRupees: b.totalAmount / 100,
      amountPaidPaise: b.amountPaid,
      amountPaidRupees: b.amountPaid / 100,
      balanceRemainingPaise: b.balanceRemaining,
      balanceRemainingRupees: b.balanceRemaining / 100,
      bookingStatus: b.bookingStatus,
    })),
    payments: payments.map((p) => ({
      id: p._id,
      paymentId: p.paymentId,
      receiptNumber: p.receiptNumber || 'N/A',
      customerName: p.customer?.name || 'N/A',
      customerEmail: p.customer?.email || 'N/A',
      bookingId: p.booking?.bookingId || 'N/A',
      purpose: p.paymentPurpose,
      gateway: p.paymentGateway,
      method: p.paymentMethod,
      amountPaise: p.amount,
      amountRupees: p.amount / 100,
      refundedAmountPaise: p.refundedAmount || 0,
      refundedAmountRupees: (p.refundedAmount || 0) / 100,
      status: p.paymentStatus,
      collectedBy: p.collectedBy?.name || 'Online Gateway',
      createdAt: p.createdAt,
    })),
  };
}
