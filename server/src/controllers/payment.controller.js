import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import GamingSession from '../models/GamingSession.js';
import {
  createOnlineOrder,
  verifyOnlinePayment,
  processWebhookEvent,
  recordOfflinePayment,
} from '../services/payment.service.js';
import { generateReceipt } from '../utils/receiptGenerator.js';
import { generatePdfReceipt } from '../services/pdfReceipt.service.js';
import { generateTestPaymentSignature, getRazorpayKeyId } from '../services/razorpay.service.js';

/**
 * GET /api/payments/config
 * Returns public Razorpay configuration for checkout initialization (Key ID only)
 */
export const getPublicConfig = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        keyId: getRazorpayKeyId(),
        mode: 'test',
        isTestMode: true,
        businessName: 'NOAH GAMING',
        currency: 'INR',
        themeColor: '#851B2B',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/payments/create-order
 * Customer creates Razorpay Order for a booking
 */
export const createOrder = async (req, res) => {
  try {
    const { bookingId, paymentPurpose } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId is required to create a payment order',
      });
    }

    const orderData = await createOnlineOrder({
      customerId: req.user._id,
      bookingId,
      paymentPurpose,
    });

    res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: orderData,
    });
  } catch (err) {
    console.error('[Create Order Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to create payment order',
    });
  }
};

/**
 * POST /api/payments/verify
 * Verifies Razorpay HMAC signature and confirms payment
 */
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'orderId, paymentId, and signature are required for payment verification',
      });
    }

    const result = await verifyOnlinePayment({
      orderId,
      paymentId,
      signature,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: result.alreadyVerified
        ? 'Payment was already verified'
        : 'Payment successfully verified and booking confirmed!',
      data: {
        payment: result.payment,
        booking: result.booking,
      },
    });
  } catch (err) {
    console.error('[Verify Payment Error]:', err);
    res.status(err.status || 400).json({
      success: false,
      message: err.message || 'Payment signature verification failed',
    });
  }
};

/**
 * POST /api/payments/test-signature
 * Developer / Test helper for Razorpay HMAC cryptographic verification simulation
 */
export const getTestSignature = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }
    const paymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const signature = generateTestPaymentSignature(orderId, paymentId);
    res.status(200).json({
      success: true,
      data: {
        paymentId,
        signature,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/payments/webhook
 * Handles incoming Razorpay webhook notifications
 */
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const event = req.body?.event;
    const payload = req.body?.payload;

    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await processWebhookEvent({
      event,
      payload,
      signature,
      rawBody,
    });

    res.status(200).json({
      success: true,
      message: 'Webhook processed',
      data: result,
    });
  } catch (err) {
    console.error('[Webhook Processing Error]:', err);
    res.status(err.status || 400).json({
      success: false,
      message: err.message || 'Webhook verification failed',
    });
  }
};

/**
 * POST /api/payments/offline
 * Front-desk staff records cash or counter UPI payment
 */
export const recordOffline = async (req, res) => {
  try {
    const {
      customerId,
      bookingId,
      amount,
      paymentMethod = 'CASH',
      transactionReference,
      notes,
    } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and amount are required for offline collection',
      });
    }

    const result = await recordOfflinePayment({
      customerId,
      bookingId,
      amount,
      paymentMethod,
      transactionReference,
      collectedByUserId: req.user._id,
      notes,
    });

    res.status(201).json({
      success: true,
      message: `Offline ${paymentMethod} payment of ₹${result.payment.amount / 100} successfully recorded!`,
      data: result,
    });
  } catch (err) {
    console.error('[Offline Payment Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to record offline payment',
    });
  }
};

/**
 * GET /api/payments/:paymentId
 * Retrieves single payment record
 */
export const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const query = mongoose.isValidObjectId(paymentId)
      ? { $or: [{ paymentId }, { _id: paymentId }] }
      : { paymentId };
    const payment = await Payment.findOne(query)
      .populate('customer', 'name email phone')
      .populate('booking')
      .populate('collectedBy', 'name role');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Role security: customer can only view their own payment
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'receptionist' &&
      payment.customer?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot view another customer payment record',
      });
    }

    res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment',
      error: err.message,
    });
  }
};

/**
 * GET /api/payments/booking/:bookingId
 * Retrieves all payment transactions for a given booking
 */
export const getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const query = mongoose.isValidObjectId(bookingId)
      ? { $or: [{ bookingId }, { _id: bookingId }] }
      : { bookingId };
    const booking = await Booking.findOne(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Security check
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'receptionist' &&
      booking.customer?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this booking financial records',
      });
    }

    const payments = await Payment.find({ booking: booking._id })
      .populate('collectedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        totalAmount: booking.totalAmount,
        amountPaid: booking.amountPaid,
        balanceRemaining: booking.balanceRemaining,
        paymentStatus: booking.paymentStatus,
        payments,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking payments',
      error: err.message,
    });
  }
};

/**
 * GET /api/payments/my-payments
 * Customer views their personal payment history
 */
export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ customer: req.user._id })
      .populate({
        path: 'booking',
        populate: [{ path: 'device', select: 'name deviceCode' }, { path: 'game', select: 'name' }],
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        payments,
        total: payments.length,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer payment history',
      error: err.message,
    });
  }
};

/**
 * GET /api/payments/:paymentId/receipt
 * Retrieves or renders official receipt (JSON or HTML)
 */
export const getPaymentReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { format } = req.query; // 'html' or 'json'

    const query = mongoose.isValidObjectId(paymentId)
      ? { $or: [{ paymentId }, { _id: paymentId }] }
      : { paymentId };

    const payment = await Payment.findOne(query)
      .populate('customer', 'name email phone customerId')
      .populate({
        path: 'booking',
        populate: [
          { path: 'device', select: 'name deviceCode deviceType' },
          { path: 'game', select: 'name isExclusive thumbnail' },
        ],
      })
      .populate('membershipPlan')
      .populate('membershipSubscription')
      .populate('collectedBy', 'name role');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (
      payment.paymentStatus !== 'PAID' &&
      payment.paymentStatus !== 'PARTIALLY_REFUNDED' &&
      payment.paymentStatus !== 'PARTIALLY_PAID'
    ) {
      return res.status(400).json({
        success: false,
        message: `Receipt is only available for successful payments (current status: ${payment.paymentStatus})`,
      });
    }

    // Role check: Admin, Receptionist, or the payment's Customer
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'receptionist' &&
      payment.customer?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this receipt',
      });
    }

    // Find linked GamingSession if booking exists
    let session = null;
    if (payment.booking) {
      session = await GamingSession.findOne({ booking: payment.booking._id || payment.booking });
    }

    // Precise Chronological Partial Payment Calculations
    let totalBookingAmountPaise = payment.amount;
    let cumulativePaidPaise = payment.amount;
    let balanceRemainingPaise = 0;

    if (payment.booking) {
      const booking = payment.booking;
      totalBookingAmountPaise = booking.totalAmount || payment.amount;

      // Find all successful payments for this booking sorted chronologically
      const allBookingPayments = await Payment.find({
        booking: booking._id,
        paymentStatus: { $in: ['PAID', 'PARTIALLY_REFUNDED', 'PARTIALLY_PAID'] },
      }).sort({ paidAt: 1, createdAt: 1, _id: 1 });

      let runningTotalPaise = 0;
      let currentPaymentFound = false;

      for (const p of allBookingPayments) {
        runningTotalPaise += p.amount || 0;
        if (p._id.toString() === payment._id.toString() || p.paymentId === payment.paymentId) {
          cumulativePaidPaise = runningTotalPaise;
          currentPaymentFound = true;
          break;
        }
      }

      if (!currentPaymentFound) {
        cumulativePaidPaise = Math.min(totalBookingAmountPaise, booking.amountPaid || payment.amount);
      }

      balanceRemainingPaise = Math.max(0, totalBookingAmountPaise - cumulativePaidPaise);
    }

    const { receiptData, html } = generateReceipt({
      payment,
      booking: payment.booking,
      customer: payment.customer,
      session,
      financialsOverride: {
        totalBookingAmountPaise,
        cumulativePaidPaise,
        balanceRemainingPaise,
      },
    });

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    if (format === 'pdf') {
      const pdfBuffer = await generatePdfReceipt(receiptData);
      const filename = `NOAH_GAMING_Receipt_${receiptData.receiptNumber || payment.paymentId}.pdf`;
      const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    res.status(200).json({
      success: true,
      data: {
        receipt: receiptData,
        printableUrl: `/api/payments/${payment.paymentId}/receipt?format=html`,
        pdfUrl: `/api/payments/${payment.paymentId}/receipt?format=pdf`,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate receipt',
      error: err.message,
    });
  }
};
