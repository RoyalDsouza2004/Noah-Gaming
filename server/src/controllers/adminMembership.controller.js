import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import User from '../models/User.js';
import { adminUpdateSubscription } from '../services/membership.service.js';

/**
 * GET /api/admin/memberships/plans
 * Returns all plans (active and inactive) for admin management
 */
export const getAdminPlans = async (req, res) => {
  try {
    const plans = await MembershipPlan.find()
      .populate('eligibleDevices', 'name deviceCode deviceType')
      .populate('eligibleGames', 'name thumbnail isExclusive')
      .populate('includedCategories', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: { plans } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/admin/memberships/plans
 * Admin creates a new membership plan
 */
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      priceInRupees,
      price,
      currency,
      validityDuration,
      validityUnit,
      eligibleDevices,
      eligibleGames,
      includedCategories,
      isUnlimited,
      dailyUsageLimit,
      maximumSessionDuration,
      maximumBookingsPerDay,
      advanceBookingLimit,
      peakHourRestrictions,
      privateBookingAllowed,
      sharedBookingAllowed,
      includesExclusiveGames,
      discountPercentage,
      renewalEnabled,
      status,
    } = req.body;

    if (!name || (!price && !priceInRupees)) {
      return res.status(400).json({
        success: false,
        message: 'Plan name and price are required',
      });
    }

    const priceInPaise = priceInRupees ? Math.round(Number(priceInRupees) * 100) : Number(price);

    const plan = await MembershipPlan.create({
      name: name.trim(),
      description: description || '',
      price: priceInPaise,
      currency: currency || 'INR',
      validityDuration: Number(validityDuration) || 30,
      validityUnit: validityUnit || 'DAYS',
      eligibleDevices: eligibleDevices || [],
      eligibleGames: eligibleGames || [],
      includedCategories: includedCategories || [],
      isUnlimited: !!isUnlimited,
      dailyUsageLimit: dailyUsageLimit !== undefined ? Number(dailyUsageLimit) : 120,
      maximumSessionDuration: maximumSessionDuration !== undefined ? Number(maximumSessionDuration) : 120,
      maximumBookingsPerDay: maximumBookingsPerDay !== undefined ? Number(maximumBookingsPerDay) : 2,
      advanceBookingLimit: advanceBookingLimit !== undefined ? Number(advanceBookingLimit) : 7,
      peakHourRestrictions: peakHourRestrictions || { enabled: false, restrictedHours: [] },
      privateBookingAllowed: !!privateBookingAllowed,
      sharedBookingAllowed: sharedBookingAllowed !== undefined ? !!sharedBookingAllowed : true,
      includesExclusiveGames: !!includesExclusiveGames,
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : 100,
      renewalEnabled: renewalEnabled !== undefined ? !!renewalEnabled : true,
      status: status || 'ACTIVE',
    });

    res.status(201).json({
      success: true,
      message: `Membership plan '${plan.name}' created successfully`,
      data: { plan },
    });
  } catch (err) {
    res.status(err.code === 11000 ? 400 : 500).json({
      success: false,
      message: err.code === 11000 ? 'A plan with this name already exists' : err.message,
    });
  }
};

/**
 * PUT /api/admin/memberships/plans/:id
 * Admin updates an existing plan
 */
export const updatePlan = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.priceInRupees !== undefined) {
      updateData.price = Math.round(Number(updateData.priceInRupees) * 100);
      delete updateData.priceInRupees;
    }

    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    res.status(200).json({
      success: true,
      message: `Membership plan '${plan.name}' updated successfully`,
      data: { plan },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/admin/memberships/plans/:id
 * Deactivates or removes a plan
 */
export const deletePlan = async (req, res) => {
  try {
    const activeSubCount = await MembershipSubscription.countDocuments({
      membershipPlan: req.params.id,
      status: 'ACTIVE',
    });

    if (activeSubCount > 0) {
      // Soft-deactivate if active members exist
      const plan = await MembershipPlan.findByIdAndUpdate(
        req.params.id,
        { status: 'INACTIVE' },
        { new: true }
      );
      return res.status(200).json({
        success: true,
        message: `Plan has ${activeSubCount} active subscriber(s). Status transitioned to INACTIVE instead of deletion.`,
        data: { plan },
      });
    }

    await MembershipPlan.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/memberships/subscriptions
 * Admin lists all subscriptions with filtering and pagination
 */
export const getAdminSubscriptions = async (req, res) => {
  try {
    const { status, planId, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (planId) query.membershipPlan = planId;

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { customerId: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.customer = { $in: matchingUsers.map((u) => u._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [subscriptions, total] = await Promise.all([
      MembershipSubscription.find(query)
        .populate('customer', 'name email phone customerId')
        .populate('membershipPlan')
        .populate('payment', 'paymentId receiptNumber amount paymentMethod')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MembershipSubscription.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/admin/memberships/subscriptions/:id
 * Admin updates subscription (Suspend, Reactivate, Cancel, Extend Days)
 */
export const updateSubscription = async (req, res) => {
  try {
    const { status, extendDays, notes } = req.body;

    const subscription = await adminUpdateSubscription({
      subscriptionId: req.params.id,
      status,
      extendDays,
      notes,
      adminId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: { subscription },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/memberships/usage
 * Returns lounge-wide membership usage tracking logs
 */
export const getAdminUsage = async (req, res) => {
  try {
    const { date, customerId, page = 1, limit = 30 } = req.query;
    const query = {};

    if (date) query.usageDate = date;
    if (customerId) query.customer = customerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [usages, total] = await Promise.all([
      MembershipUsage.find(query)
        .populate('customer', 'name email phone customerId')
        .populate('device', 'name deviceCode deviceType')
        .populate('game', 'name thumbnail isExclusive')
        .populate('subscription', 'subscriptionId')
        .populate('booking', 'bookingId bookingStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MembershipUsage.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        usages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
