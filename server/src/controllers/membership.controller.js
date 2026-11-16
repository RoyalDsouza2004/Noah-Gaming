import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipUpgrade from '../models/MembershipUpgrade.js';
import {
  createSubscriptionOrder,
  verifyMembershipPayment,
  recordOfflineMembershipPurchase,
  renewSubscription,
  calculateUpgradeQuote,
  getEligibleUpgradePlans,
  createUpgradeOrder,
  verifyMembershipUpgradePayment,
  recordOfflineMembershipUpgrade,
} from '../services/membership.service.js';

/**
 * GET /api/memberships/plans
 * Returns all active membership plans available for purchase
 */
export const getActivePlans = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ status: 'ACTIVE' })
      .populate('eligibleDevices', 'name deviceCode deviceType')
      .populate('eligibleGames', 'name thumbnail isExclusive')
      .populate('includedCategories', 'name')
      .sort({ price: 1 });

    res.status(200).json({
      success: true,
      data: { plans },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/memberships/plans/:id
 * Returns single plan details
 */
export const getPlanById = async (req, res) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id)
      .populate('eligibleDevices', 'name deviceCode deviceType')
      .populate('eligibleGames', 'name thumbnail isExclusive')
      .populate('includedCategories', 'name');

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    res.status(200).json({ success: true, data: { plan } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/purchase
 * Creates Razorpay order for online membership purchase
 */
export const purchaseMembership = async (req, res) => {
  try {
    const { planId, renewalSubscriptionId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required' });
    }

    const orderData = await createSubscriptionOrder({
      customerId: req.user._id,
      planId,
      renewalSubscriptionId,
    });

    res.status(200).json({
      success: true,
      message: 'Razorpay membership order generated',
      data: orderData,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/verify
 * Cryptographically verifies signature and activates membership
 */
export const verifyMembership = async (req, res) => {
  try {
    const { orderId, paymentId, signature, renewalSubscriptionId, planId } = req.body;
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'orderId, paymentId, and signature are required for membership activation',
      });
    }

    const result = await verifyMembershipPayment({
      orderId,
      paymentId,
      signature,
      userId: req.user._id,
      renewalSubscriptionId,
      planId,
    });

    res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? 'Membership was already verified'
        : 'Membership payment verified and subscription successfully activated!',
      data: result,
    });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/offline-purchase
 * Front Desk Staff (Admin/Receptionist) records cash or counter UPI membership purchase
 */
export const recordOfflinePurchase = async (req, res) => {
  try {
    const { customerId, planId, amount, paymentMethod, transactionReference, notes } = req.body;

    if (!customerId || !planId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'customerId, planId, and amount are required',
      });
    }

    const result = await recordOfflineMembershipPurchase({
      customerId,
      planId,
      amount,
      paymentMethod: paymentMethod || 'CASH',
      transactionReference,
      staffId: req.user._id,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Offline membership payment recorded and subscription activated!',
      data: result,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/memberships/my-subscriptions
 * Returns customer's subscription history
 */
export const getMySubscriptions = async (req, res) => {
  try {
    const subscriptions = await MembershipSubscription.find({ customer: req.user._id })
      .populate('membershipPlan')
      .populate('payment', 'paymentId receiptNumber amount paymentMethod paidAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { subscriptions },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/memberships/my-usage
 * Returns customer's membership usage records
 */
export const getMyUsage = async (req, res) => {
  try {
    const usages = await MembershipUsage.find({ customer: req.user._id })
      .populate('device', 'name deviceCode deviceType')
      .populate('game', 'name thumbnail isExclusive')
      .populate('booking', 'bookingId bookingDate startTime endTime bookingStatus')
      .sort({ createdAt: -1 });

    const totalMinutesUsed = usages
      .filter((u) => u.status !== 'CANCELLED')
      .reduce((sum, u) => sum + (u.duration || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        usages,
        totalMinutesUsed,
        totalHoursUsed: (totalMinutesUsed / 60).toFixed(1),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/:subscriptionId/renew
 * Initiates renewal order for active or expired subscription
 */
export const renewMySubscription = async (req, res) => {
  try {
    const orderData = await renewSubscription({
      subscriptionId: req.params.subscriptionId,
      customerId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: 'Razorpay membership renewal order generated',
      data: orderData,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/memberships/eligible-upgrades
 * Returns higher-tier plans eligible for upgrade with instant quotes
 */
export const getEligibleUpgrades = async (req, res) => {
  try {
    const customerId =
      ['admin', 'receptionist'].includes(req.user.role) && req.query.customerId
        ? req.query.customerId
        : req.user._id;
    const data = await getEligibleUpgradePlans({ customerId });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/memberships/upgrade-quote?targetPlanId=...
 * Calculates prorated credit breakdown for upgrading to target plan
 */
export const getUpgradeQuote = async (req, res) => {
  try {
    const { targetPlanId } = req.query;
    if (!targetPlanId) {
      return res.status(400).json({ success: false, message: 'targetPlanId query parameter is required' });
    }

    const customerId =
      ['admin', 'receptionist'].includes(req.user.role) && req.query.customerId
        ? req.query.customerId
        : req.user._id;

    const quote = await calculateUpgradeQuote({
      customerId,
      targetPlanId,
    });

    res.status(200).json({ success: true, data: quote });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/upgrade/initiate
 * Generates upgrade order with Razorpay integration and PENDING transaction
 */
export const initiateUpgrade = async (req, res) => {
  try {
    const { targetPlanId } = req.body;
    if (!targetPlanId) {
      return res.status(400).json({ success: false, message: 'targetPlanId is required' });
    }

    const orderData = await createUpgradeOrder({
      customerId: req.user._id,
      targetPlanId,
    });

    res.status(200).json({
      success: true,
      message: 'Membership upgrade initiated',
      data: orderData,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/upgrade/verify
 * Cryptographically verifies Razorpay payment and completes upgrade
 */
export const verifyUpgrade = async (req, res) => {
  try {
    const {
      upgradeTransactionId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    } = req.body;

    if (!upgradeTransactionId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'upgradeTransactionId, razorpayPaymentId, razorpayOrderId, and razorpaySignature are required',
      });
    }

    const result = await verifyMembershipUpgradePayment({
      customerId: req.user._id,
      upgradeTransactionId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    });

    res.status(200).json({
      success: true,
      message: 'Membership upgraded successfully!',
      data: result,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/memberships/upgrade/offline
 * Front-desk offline upgrade registration (Staff / Admin only)
 */
export const offlineUpgrade = async (req, res) => {
  try {
    const { customerId, targetPlanId, paymentMethod, referenceNumber, notes } = req.body;
    if (!customerId || !targetPlanId) {
      return res.status(400).json({ success: false, message: 'customerId and targetPlanId are required' });
    }

    const result = await recordOfflineMembershipUpgrade({
      customerId,
      targetPlanId,
      paymentMethod,
      referenceNumber,
      cashierId: req.user._id,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Offline membership upgrade completed successfully',
      data: result,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};
