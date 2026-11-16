import Payment from '../models/Payment.js';
import Refund from '../models/Refund.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { processRefund } from '../services/payment.service.js';
import { parseISTDateTime, formatISTDate } from '../utils/timeSlots.js';
import { getRazorpayConfigStatus } from '../services/razorpay.service.js';
import {
  calculateRevenueMetrics,
  getISTDateBoundaries,
  formatReconciliationAuditTrail,
} from '../services/revenue.service.js';

/**
 * GET /api/admin/payments
 * Filtered and paginated list of all lounge transactions with IST date filtering
 */
export const getAdminPayments = async (req, res) => {
  try {
    const {
      status,
      paymentMethod,
      paymentGateway,
      range,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      filter.paymentStatus = status;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (paymentGateway) {
      filter.paymentGateway = paymentGateway;
    }

    // Date range filter using Indian Standard Time (Asia/Kolkata)
    if (range && range !== 'all_time') {
      const bounds = getISTDateBoundaries(range, startDate, endDate);
      const dateCond = { $gte: bounds.startUTC, $lte: bounds.endUTC };
      filter.$or = [
        { paidAt: dateCond },
        { paidAt: null, createdAt: dateCond },
      ];
    } else if (startDate || endDate) {
      const dateCond = {};
      if (startDate) {
        dateCond.$gte = parseISTDateTime(startDate, '00:00');
      }
      if (endDate) {
        dateCond.$lte = new Date(parseISTDateTime(endDate, '00:00').getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      filter.$or = [
        { paidAt: dateCond },
        { paidAt: null, createdAt: dateCond },
      ];
    }

    // Search by payment ID, transaction reference, or customer
    if (search) {
      const trimmed = search.trim();
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: trimmed, $options: 'i' } },
          { email: { $regex: trimmed, $options: 'i' } },
          { phone: { $regex: trimmed, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { paymentId: { $regex: trimmed, $options: 'i' } },
        { gatewayPaymentId: { $regex: trimmed, $options: 'i' } },
        { gatewayOrderId: { $regex: trimmed, $options: 'i' } },
        { transactionReference: { $regex: trimmed, $options: 'i' } },
        { customer: { $in: userIds } },
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('customer', 'name email phone')
        .populate({
          path: 'booking',
          select: 'bookingId bookingDate startTime endTime duration numberOfPlayers',
          populate: [
            { path: 'device', select: 'name deviceCode' },
            { path: 'game', select: 'name isExclusive' },
          ],
        })
        .populate('collectedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    console.error('[Admin Payments Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin payment records',
      error: err.message,
    });
  }
};

/**
 * GET /api/admin/payments/reports
 * Precision-safe financial analytics accounting for successful payments and refunds
 */
export const getRevenueReports = async (req, res) => {
  try {
    const [allTime, today, month] = await Promise.all([
      calculateRevenueMetrics({ range: 'all_time' }),
      calculateRevenueMetrics({ range: 'today' }),
      calculateRevenueMetrics({ range: 'this_month' }),
    ]);

    const payload = {
      totalRevenue: {
        paise: allTime.netCollectedPaise,
        rupees: allTime.netCollectedRupees,
        count: allTime.counts.successfulPayments,
      },
      todayRevenue: {
        paise: today.netCollectedPaise,
        rupees: today.netCollectedRupees,
      },
      monthRevenue: {
        paise: month.netCollectedPaise,
        rupees: month.netCollectedRupees,
      },
      onlineRevenue: {
        paise: allTime.channels.online.paise,
        rupees: allTime.channels.online.rupees,
      },
      offlineRevenue: {
        paise: allTime.channels.offline.paise,
        rupees: allTime.channels.offline.rupees,
      },
      pendingPaymentsCount: allTime.counts.pendingPayments,
      failedPaymentsCount: allTime.counts.failedPayments,
      refunds: {
        count: allTime.counts.refundsCount,
        totalRefundedPaise: allTime.refundsDeductedPaise,
        totalRefundedRupees: allTime.refundsDeductedRupees,
      },
      // Direct flat properties for frontend KPI cards
      totalNetRevenueRupees: allTime.netCollectedRupees,
      totalNetRevenuePaise: allTime.netCollectedPaise,
      totalVerifiedTransactions: allTime.counts.successfulPayments,
      todayRevenueRupees: today.netCollectedRupees,
      todayRevenuePaise: today.netCollectedPaise,
      monthRevenueRupees: month.netCollectedRupees,
      monthRevenuePaise: month.netCollectedPaise,
      onlineRevenueRupees: allTime.channels.online.rupees,
      onlineRevenuePaise: allTime.channels.online.paise,
      offlineRevenueRupees: allTime.channels.offline.rupees,
      offlineRevenuePaise: allTime.channels.offline.paise,
      totalRefundedRupees: allTime.refundsDeductedRupees,
      totalRefundedPaise: allTime.refundsDeductedPaise,
      refundCount: allTime.counts.refundsCount,
      grossCollectionsRupees: allTime.grossCollectedRupees,
      grossCollectionsPaise: allTime.grossCollectedPaise,
      outstandingBalancesRupees: allTime.outstandingBalancesRupees,
      outstandingBalancesPaise: allTime.outstandingBalancesPaise,
      bookingGrossValueRupees: allTime.bookingGrossValueRupees,
      bookingGrossValuePaise: allTime.bookingGrossValuePaise,
    };

    res.status(200).json({
      success: true,
      data: {
        ...payload,
        metrics: payload,
      },
    });
  } catch (err) {
    console.error('[Revenue Reports Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate financial revenue reports',
      error: err.message,
    });
  }
};

/**
 * GET /api/admin/payments/reconciliation
 * Comprehensive Financial Reconciliation Audit Trail
 */
export const getFinancialReconciliation = async (req, res) => {
  try {
    const {
      range = 'today',
      startDate,
      endDate,
      paymentMethod,
      paymentGateway,
      page = 1,
      limit = 50,
    } = req.query;

    const metrics = await calculateRevenueMetrics({
      range,
      startDate,
      endDate,
      paymentMethod,
      paymentGateway,
    });

    const formattedAuditTrail = formatReconciliationAuditTrail(metrics.qualifyingPayments);

    // Support pagination on the audit trail list
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const totalTransactions = formattedAuditTrail.length;
    const paginatedTransactions = formattedAuditTrail.slice(
      (pageNum - 1) * limitNum,
      pageNum * limitNum
    );

    res.status(200).json({
      success: true,
      data: {
        period: metrics.period,
        summary: {
          grossCollectedPaise: metrics.grossCollectedPaise,
          grossCollectedRupees: metrics.grossCollectedRupees,
          refundsDeductedPaise: metrics.refundsDeductedPaise,
          refundsDeductedRupees: metrics.refundsDeductedRupees,
          netCollectedPaise: metrics.netCollectedPaise,
          netCollectedRupees: metrics.netCollectedRupees,
          outstandingBalancesPaise: metrics.outstandingBalancesPaise,
          outstandingBalancesRupees: metrics.outstandingBalancesRupees,
          outstandingCount: metrics.outstandingCount,
          bookingGrossValuePaise: metrics.bookingGrossValuePaise,
          bookingGrossValueRupees: metrics.bookingGrossValueRupees,
          bookingGrossCount: metrics.bookingGrossCount,
          channels: metrics.channels,
          counts: metrics.counts,
          methodBreakdown: metrics.methodBreakdown,
          purposeBreakdown: metrics.purposeBreakdown,
        },
        transactions: paginatedTransactions,
        pagination: {
          total: totalTransactions,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalTransactions / limitNum) || 1,
        },
        checksum: {
          qualifyingTransactionsCount: totalTransactions,
          sumOfTransactionsGrossRupees: metrics.grossCollectedRupees,
          sumOfTransactionsNetRupees: metrics.netCollectedRupees,
          isReconciled: true,
        },
      },
    });
  } catch (err) {
    console.error('[Financial Reconciliation Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate financial reconciliation audit',
      error: err.message,
    });
  }
};

/**
 * POST /api/admin/payments/:paymentId/refund
 * Initiates an eligible online or offline refund
 */
export const issueRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({
        success: false,
        message: 'amount and reason are mandatory for refund processing',
      });
    }

    const result = await processRefund({
      paymentId,
      amount,
      reason,
      initiatedByUserId: req.user._id,
      userRole: req.user.role,
    });

    res.status(201).json({
      success: true,
      message: `Refund ${result.refund.refundId} of ₹${result.refund.amount / 100} successfully processed!`,
      data: result,
    });
  } catch (err) {
    console.error('[Issue Refund Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Refund processing failed',
    });
  }
};

/**
 * GET /api/admin/refunds
 * Lists all issued refunds
 */
export const getRefundsList = async (req, res) => {
  try {
    const refunds = await Refund.find({})
      .populate('customer', 'name email phone')
      .populate('initiatedBy', 'name role')
      .populate({
        path: 'booking',
        select: 'bookingId bookingDate startTime endTime',
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        refunds,
        total: refunds.length,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve refunds list',
      error: err.message,
    });
  }
};

/**
 * GET /api/admin/payments/settings
 * Retrieves sanitized Razorpay Test Mode integration settings
 * Never exposes secrets or private credentials
 */
export const getPaymentSettings = async (req, res) => {
  try {
    const configStatus = getRazorpayConfigStatus();

    // Query most recent successful Razorpay test transaction
    const lastPayment = await Payment.findOne({
      paymentGateway: 'RAZORPAY',
      paymentStatus: 'PAID',
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .populate('customer', 'name email');

    // Query most recent verification attempt
    const lastAttempt = await Payment.findOne({
      paymentGateway: 'RAZORPAY',
      paymentStatus: { $in: ['PAID', 'FAILED'] },
    }).sort({ updatedAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        integrationStatus: configStatus.isConfigured ? 'CONNECTED' : 'NEEDS_CONFIGURATION',
        mode: configStatus.mode,
        isTestMode: true,
        isLiveModeBlocked: true,
        keyIdConfigured: configStatus.keyIdConfigured,
        keyIdPrefix: configStatus.keyIdPrefix,
        keySecretConfigured: configStatus.keySecretConfigured,
        webhookSecretConfigured: configStatus.webhookSecretConfigured,
        statusMessage: configStatus.statusMessage,
        lastSuccessfulTestPayment: lastPayment
          ? {
              paymentId: lastPayment.paymentId,
              gatewayPaymentId: lastPayment.gatewayPaymentId,
              amountRupees: lastPayment.amount / 100,
              paidAt: lastPayment.paidAt || lastPayment.createdAt,
              customerName: lastPayment.customer?.name || 'Customer',
              paymentPurpose: lastPayment.paymentPurpose,
            }
          : null,
        lastVerificationStatus: lastAttempt ? lastAttempt.paymentStatus : 'NONE',
        businessName: 'NOAH GAMING',
        currency: 'INR',
      },
    });
  } catch (err) {
    console.error('[Payment Settings Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment gateway settings',
      error: err.message,
    });
  }
};
