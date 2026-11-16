import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';
import { formatISTDate } from '../utils/timeSlots.js';
import * as notificationService from '../services/notification.service.js';

/**
 * GET /api/users/profile
 * Returns authenticated customer profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('membership.planId')
      .populate('membership.subscriptionId');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: user._id,
          customerId: user.customerId || `CUST-${user._id.toString().slice(-6)}`,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profilePicture: user.profilePicture || '',
          role: user.role,
          accountStatus: user.accountStatus || 'ACTIVE',
          accountCreatedAt: user.createdAt,
          accountCreatedAtIST: new Date(user.createdAt).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
          }),
          membership: {
            status: user.membership?.status || 'NONE',
            plan: user.membership?.planId || null,
            subscription: user.membership?.subscriptionId || null,
            expiresAt: user.membership?.expiresAt || null,
            expiresAtIST: user.membership?.expiresAt
              ? new Date(user.membership.expiresAt).toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })
              : null,
            remainingHours: user.membership?.remainingHours || 0,
          },
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/users/profile
 * Updates personal profile details (Guards sensitive fields)
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, profilePicture } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name && name.trim()) user.name = name.trim();
    if (phone && phone.trim()) {
      if (!/^[0-9]{10}$/.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number must be a valid 10-digit number',
        });
      }
      // Check duplicate phone
      const existing = await User.findOne({
        phone: phone.trim(),
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered to another account',
        });
      }
      user.phone = phone.trim();
    }
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/users/change-password
 * Changes customer password with old password verification
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password provided is incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/users/gaming-history
 * Returns customer gaming history with rich date filters and session status breakdown
 */
export const getGamingHistory = async (req, res) => {
  try {
    const {
      filter = 'all', // 'today', '7days', '1month', '6months', '1year', 'custom'
      startDate,
      endDate,
      status, // 'UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'
      page = 1,
      limit = 20,
    } = req.query;

    const query = { customer: req.user._id };

    // Date range filter
    const now = new Date();
    if (filter === 'today') {
      const todayIST = formatISTDate(now);
      query.bookingDate = todayIST;
    } else if (filter === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.startAt = { $gte: past7 };
    } else if (filter === '1month') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.startAt = { $gte: past30 };
    } else if (filter === '6months') {
      const past180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      query.startAt = { $gte: past180 };
    } else if (filter === '1year') {
      const past365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      query.startAt = { $gte: past365 };
    } else if (filter === 'custom' && startDate) {
      query.bookingDate = {
        $gte: startDate,
        ...(endDate ? { $lte: endDate } : {}),
      };
    }

    // Session Status categorization
    if (status) {
      if (status === 'UPCOMING') {
        query.bookingStatus = 'CONFIRMED';
        query.startAt = { $gt: now };
      } else if (status === 'ACTIVE') {
        query.bookingStatus = 'CONFIRMED';
        query.startAt = { $lte: now };
        query.endAt = { $gte: now };
      } else if (status === 'COMPLETED') {
        query.$or = [{ bookingStatus: 'COMPLETED' }, { bookingStatus: 'CONFIRMED', endAt: { $lt: now } }];
      } else if (status === 'CANCELLED') {
        query.bookingStatus = 'CANCELLED';
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('device', 'name deviceCode deviceType')
        .populate('game', 'name thumbnail isExclusive')
        .populate('payments', 'paymentId receiptNumber amount paymentStatus paidAt')
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query),
    ]);

    // Categorized Summary Counts
    const [upcomingCount, activeCount, completedCount, cancelledCount] = await Promise.all([
      Booking.countDocuments({ customer: req.user._id, bookingStatus: 'CONFIRMED', startAt: { $gt: now } }),
      Booking.countDocuments({
        customer: req.user._id,
        bookingStatus: 'CONFIRMED',
        startAt: { $lte: now },
        endAt: { $gte: now },
      }),
      Booking.countDocuments({
        customer: req.user._id,
        $or: [{ bookingStatus: 'COMPLETED' }, { bookingStatus: 'CONFIRMED', endAt: { $lt: now } }],
      }),
      Booking.countDocuments({ customer: req.user._id, bookingStatus: 'CANCELLED' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        counts: {
          totalSessions: total,
          upcoming: upcomingCount,
          active: activeCount,
          completed: completedCount,
          cancelled: cancelledCount,
        },
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
 * GET /api/users/payment-history
 * Returns customer's complete payment transactions and receipts
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      Payment.find({ customer: req.user._id })
        .populate({
          path: 'booking',
          select: 'bookingId bookingDate startTime endTime duration numberOfPlayers device game totalAmount amountPaid balanceRemaining',
          populate: [
            { path: 'device', select: 'name deviceCode deviceType' },
            { path: 'game', select: 'name isExclusive thumbnail' },
          ],
        })
        .populate('membershipPlan', 'name validityDuration validityUnit isUnlimited price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments({ customer: req.user._id }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
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
 * GET /api/users/dashboard
 * Aggregated Customer Dashboard metrics & quick data
 */
export const getCustomerDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const todayIST = formatISTDate(now);

    const [user, totalSessions, upcomingBookings, recentBookings, payments, todayUsages] =
      await Promise.all([
        User.findById(userId)
          .populate('membership.planId')
          .populate('membership.subscriptionId'),
        Booking.countDocuments({ customer: userId }),
        Booking.find({ customer: userId, bookingStatus: 'CONFIRMED', startAt: { $gte: now } })
          .populate('device', 'name deviceCode')
          .populate('game', 'name thumbnail')
          .sort({ startAt: 1 })
          .limit(3),
        Booking.find({ customer: userId })
          .populate('device', 'name deviceCode')
          .populate('game', 'name thumbnail')
          .sort({ createdAt: -1 })
          .limit(5),
        Payment.find({ customer: userId, paymentStatus: 'PAID' })
          .sort({ paidAt: -1 })
          .limit(5),
        MembershipUsage.find({
          customer: userId,
          usageDate: todayIST,
          status: { $ne: 'CANCELLED' },
        }),
      ]);

    // Calculate daily allowance remaining
    let dailyAllowanceMinutes = 0;
    let dailyUsedMinutes = 0;
    let dailyRemainingMinutes = 0;

    if (user.membership?.planId?.dailyUsageLimit) {
      dailyAllowanceMinutes = user.membership.planId.dailyUsageLimit;
      dailyUsedMinutes = todayUsages.reduce((sum, u) => sum + (u.duration || 0), 0);
      dailyRemainingMinutes = Math.max(0, dailyAllowanceMinutes - dailyUsedMinutes);
    }

    // Calculate total spent
    const totalSpentPaise = (
      await Payment.aggregate([
        { $match: { customer: userId, paymentStatus: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
    )[0]?.total || 0;

    // Outstanding unpaid bookings
    const outstandingBookings = await Booking.find({
      customer: userId,
      bookingStatus: { $ne: 'CANCELLED' },
      balanceRemaining: { $gt: 0 },
    });

    res.status(200).json({
      success: true,
      data: {
        customer: {
          id: user._id,
          customerId: user.customerId || `CUST-${user._id.toString().slice(-6)}`,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profilePicture: user.profilePicture,
          membership: {
            status: user.membership?.status || 'NONE',
            planName: user.membership?.planId?.name || 'No Active Plan',
            isUnlimited: user.membership?.planId?.isUnlimited || false,
            expiresAt: user.membership?.expiresAt,
            expiresAtIST: user.membership?.expiresAt
              ? new Date(user.membership.expiresAt).toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })
              : null,
            dailyAllowanceMinutes,
            dailyUsedMinutes,
            dailyRemainingMinutes,
            dailyRemainingHours: (dailyRemainingMinutes / 60).toFixed(1),
          },
        },
        metrics: {
          totalGamingSessions: totalSessions,
          upcomingBookingsCount: upcomingBookings.length,
          totalSpentRupees: totalSpentPaise / 100,
          outstandingBalanceRupees:
            outstandingBookings.reduce((sum, b) => sum + (b.balanceRemaining || 0), 0) / 100,
        },
        upcomingBookings,
        recentBookings,
        recentPayments: payments,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Notifications Controller Handlers
 */
export const getNotifications = async (req, res) => {
  try {
    const data = await notificationService.getUserNotifications(req.user, req.query);
    res.status(200).json({
      success: true,
      data: {
        notifications: data.notifications,
        unreadCount: data.pagination.unread,
        pagination: data.pagination,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user);
    res.status(200).json({ success: true, data: { notification } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user);
    res.status(200).json({ success: true, message: 'All notifications marked as read', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
