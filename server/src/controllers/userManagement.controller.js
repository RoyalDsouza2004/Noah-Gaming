import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import GamingSession from '../models/GamingSession.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipPlan from '../models/MembershipPlan.js';
import ActivityLog from '../models/ActivityLog.js';
import { ROLES } from '../config/constants.js';
import {
  sendWelcomeEmail,
  sendPasswordResetConfirmationEmail,
  sendOtpEmail,
} from '../services/email.service.js';

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'customer email';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return 'XXXXXX';
  return `XXXXXX${phone.slice(-4)}`;
}

/**
 * 1. GET /api/admin/users
 * Searchable, filtered, paginated user management list with aggregated metrics
 */
export const getUsersList = async (req, res) => {
  try {
    const {
      search = '',
      accountType = 'ALL',
      role = 'ALL',
      accountStatus = 'ALL',
      membershipStatus = 'ALL',
      page = 1,
      limit = 15,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // 1. Text search across name, email, phone, customerId
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const regex = new RegExp(cleanSearch, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { customerId: regex },
      ];
    }

    // 2. Filter by accountType
    if (accountType && accountType !== 'ALL') {
      query.accountType = accountType.toUpperCase();
    }

    // 3. Filter by role
    if (role && role !== 'ALL') {
      query.role = role.toLowerCase();
    }

    // 4. Filter by accountStatus
    if (accountStatus && accountStatus !== 'ALL') {
      query.accountStatus = accountStatus.toUpperCase();
    }

    // 5. Filter by membership status
    if (membershipStatus && membershipStatus !== 'ALL') {
      query['membership.status'] = membershipStatus.toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch users and total count
    const [users, total] = await Promise.all([
      User.find(query)
        .populate('membership.planId', 'name tier isUnlimited dailyUsageLimit')
        .select('-password -conversionOtp -passwordResetOtp')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    // Aggregate metrics for these users: bookings, sessions, and verified spending
    const userIds = users.map((u) => u._id);

    const [bookingStats, sessionStats, paymentStats] = await Promise.all([
      Booking.aggregate([
        { $match: { customer: { $in: userIds }, bookingStatus: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: '$customer',
            totalBookings: { $sum: 1 },
            totalPaidPaise: { $sum: '$amountPaid' },
            outstandingBalancePaise: { $sum: '$balanceRemaining' },
          },
        },
      ]),
      GamingSession.aggregate([
        { $match: { customer: { $in: userIds }, status: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: '$customer',
            totalSessions: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { customer: { $in: userIds }, paymentStatus: 'PAID' } },
        {
          $group: {
            _id: '$customer',
            verifiedSpendPaise: { $sum: '$amountPaise' },
          },
        },
      ]),
    ]);

    // Map stats by user id string
    const bookingMap = new Map(bookingStats.map((b) => [b._id.toString(), b]));
    const sessionMap = new Map(sessionStats.map((s) => [s._id.toString(), s.totalSessions]));
    const paymentMap = new Map(paymentStats.map((p) => [p._id.toString(), p.verifiedSpendPaise]));

    const enrichedUsers = users.map((u) => {
      const uid = u._id.toString();
      const bStat = bookingMap.get(uid) || { totalBookings: 0, totalPaidPaise: 0, outstandingBalancePaise: 0 };
      const totalSessions = sessionMap.get(uid) || 0;
      const verifiedSpendPaise = paymentMap.get(uid) || bStat.totalPaidPaise || 0;
      const resolvedAccountType = u.accountType || (u.isGuest || (u.email && u.email.startsWith('guest.')) ? 'GUEST' : 'REGISTERED');

      return {
        ...u,
        accountType: resolvedAccountType,
        isGuest: resolvedAccountType === 'GUEST',
        totalBookings: bStat.totalBookings,
        totalGamingSessions: totalSessions,
        totalVerifiedSpendPaise: verifiedSpendPaise,
        totalVerifiedSpendRupees: Math.round(verifiedSpendPaise / 100),
        outstandingBalancePaise: bStat.outstandingBalancePaise,
        outstandingBalanceRupees: Math.round(bStat.outstandingBalancePaise / 100),
      };
    });

    // Summary KPIs for dashboard header
    const [totalUsersCount, totalGuestsCount, totalRegisteredCount, activeMembersCount] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ accountType: 'GUEST' }),
      User.countDocuments({ accountType: 'REGISTERED' }),
      User.countDocuments({ 'membership.status': 'ACTIVE' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          limit: limitNum,
        },
        kpis: {
          totalUsersCount,
          totalGuestsCount,
          totalRegisteredCount,
          activeMembersCount,
        },
      },
    });
  } catch (err) {
    console.error('getUsersList Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users list',
      error: err.message,
    });
  }
};

/**
 * 2. GET /api/admin/users/:id
 * Detailed customer profile with booking history, gaming history, payments, and subscriptions
 */
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }

    const user = await User.findById(id)
      .populate('membership.planId')
      .populate('membership.subscriptionId')
      .populate('guestConvertedBy', 'name role email')
      .populate('mergedInto', 'name phone email customerId')
      .select('-password -conversionOtp -passwordResetOtp');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    const [bookings, sessions, payments, subscriptions, activityLogs] = await Promise.all([
      Booking.find({ customer: user._id })
        .populate('device', 'name deviceCode deviceType status')
        .populate('game', 'name genre isExclusive')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      GamingSession.find({ customer: user._id })
        .populate('device', 'name deviceCode')
        .populate('game', 'name')
        .sort({ startedAt: -1 })
        .limit(50)
        .lean(),
      Payment.find({ customer: user._id })
        .populate('booking', 'bookingId bookingDate')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      MembershipSubscription.find({ customer: user._id })
        .populate('membershipPlan')
        .sort({ createdAt: -1 })
        .lean(),
      ActivityLog.find({
        $or: [{ customerId: user._id }, { userId: user._id }],
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
    ]);

    // Financial aggregates
    const totalBookingsCount = bookings.length;
    const completedBookings = bookings.filter((b) => b.bookingStatus === 'COMPLETED' || b.sessionStatus === 'COMPLETED').length;
    const cancelledBookings = bookings.filter((b) => b.bookingStatus === 'CANCELLED').length;
    const outstandingBalancePaise = bookings
      .filter((b) => b.bookingStatus !== 'CANCELLED')
      .reduce((sum, b) => sum + (b.balanceRemaining || 0), 0);

    const totalPaidPaise = payments
      .filter((p) => p.paymentStatus === 'PAID')
      .reduce((sum, p) => sum + (p.amount || p.amountPaise || 0), 0);

    // Normalize payments and subscriptions for client convenience
    const normalizedPayments = payments.map((p) => ({
      ...p,
      amountPaise: p.amount || p.amountPaise || 0,
      amountRupees: Math.round((p.amount || p.amountPaise || 0) / 100),
    }));

    const normalizedSubscriptions = subscriptions.map((s) => ({
      ...s,
      plan: s.membershipPlan || s.plan,
      membershipPlan: s.membershipPlan || s.plan,
    }));

    res.status(200).json({
      success: true,
      data: {
        user: user.toSafeObject(),
        metrics: {
          totalBookingsCount,
          completedBookings,
          cancelledBookings,
          totalSessionsCount: sessions.length,
          totalPaidPaise,
          totalPaidRupees: Math.round(totalPaidPaise / 100),
          outstandingBalancePaise,
          outstandingBalanceRupees: Math.round(outstandingBalancePaise / 100),
        },
        bookings,
        sessions,
        payments: normalizedPayments,
        subscriptions: normalizedSubscriptions,
        activityLogs,
      },
    });
  } catch (err) {
    console.error('getUserDetails Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: err.message,
    });
  }
};

/**
 * 3. PUT /api/admin/users/:id
 * Edit existing user details with validation and audit trail
 * Staff and Admin permitted to edit name, phone, email, notes, accountStatus
 */
export const updateUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }

    const { name, phone, email, notes, accountStatus } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const originalData = {
      name: user.name,
      phone: user.phone,
      email: user.email,
      notes: user.notes,
      accountStatus: user.accountStatus,
    };

    const changes = {};

    // Validate and update Name
    if (name && name.trim()) {
      if (name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
      }
      if (user.name !== name.trim()) {
        changes.name = { from: user.name, to: name.trim() };
        user.name = name.trim();
      }
    }

    // Validate and update Phone
    if (phone) {
      const cleanPhone = phone.trim().replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits' });
      }
      if (user.phone !== cleanPhone) {
        // Uniqueness check excluding current user
        const duplicatePhone = await User.findOne({ phone: cleanPhone, _id: { $ne: user._id } });
        if (duplicatePhone) {
          return res.status(409).json({
            success: false,
            message: `Mobile number ${cleanPhone} is already registered to customer '${duplicatePhone.name}'.`,
          });
        }
        changes.phone = { from: user.phone, to: cleanPhone };
        user.phone = cleanPhone;
      }
    }

    // Validate and update Email
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }
      if (user.email !== cleanEmail) {
        // Uniqueness check excluding current user
        const duplicateEmail = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (duplicateEmail) {
          return res.status(409).json({
            success: false,
            message: `Email address '${cleanEmail}' is already registered to customer '${duplicateEmail.name}'.`,
          });
        }
        changes.email = { from: user.email, to: cleanEmail };
        user.email = cleanEmail;
      }
    }

    // Update Notes
    if (typeof notes === 'string') {
      if (user.notes !== notes) {
        changes.notes = { from: user.notes, to: notes };
        user.notes = notes;
      }
    }

    // Update Status
    if (accountStatus) {
      const upperStatus = accountStatus.toUpperCase();
      if (!['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(upperStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid account status' });
      }
      if (user.accountStatus !== upperStatus) {
        changes.accountStatus = { from: user.accountStatus, to: upperStatus };
        user.accountStatus = upperStatus;
        user.isActive = upperStatus === 'ACTIVE';
      }
    }

    // Protect against non-admin changing role
    if (req.body.role && req.body.role !== user.role) {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only Administrators have permission to modify user roles.',
        });
      }
    }

    await user.save();

    // Audit log
    await ActivityLog.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Staff User',
      userRole: req.user?.role || 'receptionist',
      action: 'USER_PROFILE_UPDATED',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Updated profile details for customer '${user.name}' (${user.phone})`,
      details: {
        targetUserId: user._id,
        changes,
        originalData,
      },
      ipAddress: req.ip || '127.0.0.1',
    });


    res.status(200).json({
      success: true,
      message: 'Customer details updated successfully',
      data: {
        user: user.toSafeObject(),
        changes,
      },
    });
  } catch (err) {
    console.error('updateUserDetails Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update user details',
      error: err.message,
    });
  }
};

/**
 * 4. PATCH /api/admin/users/:id/role
 * Change user role (Admin Only) with safeguards against demoting the last active administrator
 */
export const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }

    const validRoles = Object.values(ROLES);
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: ${validRoles.join(', ')}`,
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousRole = user.role;

    // Safeguard: Check if demoting an administrator
    if (previousRole === ROLES.ADMIN && role !== ROLES.ADMIN) {
      const activeAdminCount = await User.countDocuments({
        role: ROLES.ADMIN,
        accountStatus: 'ACTIVE',
        isActive: true,
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the only remaining active administrator account.',
        });
      }
    }

    user.role = role;
    await user.save();

    // Audit log
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'USER_ROLE_CHANGED',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Changed role of user '${user.name}' from ${previousRole} to ${role}`,
      details: {
        targetUserId: user._id,
        targetEmail: user.email,
        fromRole: previousRole,
        toRole: role,
      },
      ipAddress: req.ip || '127.0.0.1',
    });


    res.status(200).json({
      success: true,
      message: `User role updated successfully to '${role}'.`,
      data: {
        user: user.toSafeObject(),
        previousRole,
        newRole: role,
      },
    });
  } catch (err) {
    console.error('changeUserRole Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: err.message,
    });
  }
};

/**
 * 5. POST /api/admin/users/:id/convert/request-otp
 * Initiate Guest-to-Registered Account Conversion OTP with Real Resend Email
 */
export const initiateGuestConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    if (user.accountType === 'REGISTERED' && !user.isGuest) {
      return res.status(400).json({
        success: false,
        message: 'This account is already a Registered Customer account.',
      });
    }

    const targetEmail = (email && email.trim()) ? email.trim().toLowerCase() : user.email;
    if (!targetEmail || !targetEmail.includes('@') || targetEmail.startsWith('guest.')) {
      return res.status(400).json({
        success: false,
        message: 'A valid customer email address is required to dispatch the verification code.',
      });
    }

    // Check resend cooldown (60 seconds)
    const recentOtp = await OtpVerification.findOne({
      userId: user._id,
      purpose: 'GUEST_CONVERSION',
      used: false,
    }).sort({ createdAt: -1 });

    if (recentOtp && new Date() < new Date(recentOtp.resendAvailableAt)) {
      const remainingSeconds = Math.ceil((new Date(recentOtp.resendAvailableAt).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} second(s) before requesting a new verification code.`,
        data: { remainingSeconds },
      });
    }

    // Invalidate previous conversion OTPs
    await OtpVerification.updateMany(
      { userId: user._id, purpose: 'GUEST_CONVERSION', used: false },
      { used: true }
    );

    // Generate secure 6-digit OTP and store SHA-256 hash
    const otpCode = OtpVerification.generateNumericOtp();
    const otpHash = OtpVerification.hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60s cooldown

    await OtpVerification.create({
      userId: user._id,
      email: targetEmail,
      otpHash,
      purpose: 'GUEST_CONVERSION',
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
    });

    // Send real OTP email via Resend
    const emailResult = await sendOtpEmail({
      email: targetEmail,
      name: user.name,
      otp: otpCode,
      purpose: 'GUEST_CONVERSION',
      expiresMinutes: 5,
    });

    if (emailResult.notConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Email verification service is currently unconfigured on the server.',
      });
    }

    await ActivityLog.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Staff User',
      userRole: req.user?.role || 'receptionist',
      action: 'GUEST_CONVERSION_OTP_SENT',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Conversion OTP dispatched to '${targetEmail}' for guest customer '${user.name}' (${user.phone})`,
      details: { targetUserId: user._id, phone: user.phone, email: targetEmail },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Verification OTP dispatched to customer's email (${maskEmail(targetEmail)}). Valid for 5 minutes.`,
      data: {
        userId: user._id,
        phone: user.phone,
        email: targetEmail,
        maskedPhone: maskPhone(user.phone),
        maskedEmail: maskEmail(targetEmail),
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('initiateGuestConversion Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate guest conversion',
      error: err.message,
    });
  }
};

/**
 * 6. POST /api/admin/users/:id/convert/complete
 * Complete Guest-to-Registered conversion with identity verification & password setup
 * Preserves original user ObjectId, bookings, payments, and gaming records!
 */
export const completeGuestConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp, password, email, name, adminBypass } = req.body;

    const user = await User.findById(id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.accountType === 'REGISTERED' && !user.isGuest) {
      return res.status(400).json({
        success: false,
        message: 'This account has already been converted to a Registered Customer account.',
      });
    }

    const isAdmin = req.user?.role === 'admin';
    let verifiedEmail = user.email;

    if (!isAdmin || !adminBypass) {
      if (!otp || !otp.trim()) {
        return res.status(400).json({ success: false, message: 'Verification OTP is required' });
      }

      const cleanOtp = otp.trim();
      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ success: false, message: 'Verification code must be exactly 6 digits.' });
      }

      const record = await OtpVerification.findOne({
        userId: user._id,
        purpose: 'GUEST_CONVERSION',
        used: false,
      }).select('+otpHash').sort({ createdAt: -1 });

      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No active conversion OTP found. Please request a new OTP first.',
        });
      }

      if (new Date() > new Date(record.expiresAt)) {
        record.used = true;
        await record.save();
        return res.status(400).json({
          success: false,
          message: 'OTP has expired (5-minute limit). Please request a new verification code.',
        });
      }

      if (record.attempts >= record.maxAttempts) {
        record.used = true;
        await record.save();
        return res.status(429).json({
          success: false,
          message: 'Maximum verification attempts exceeded (5/5). Please request a new OTP.',
        });
      }

      const isValid = record.verifyOtp(cleanOtp);
      if (!isValid) {
        record.attempts += 1;
        if (record.attempts >= record.maxAttempts) {
          record.used = true;
          await record.save();
          return res.status(429).json({
            success: false,
            message: 'Maximum verification attempts exceeded (5/5). Please request a new OTP.',
          });
        }
        await record.save();
        const remaining = record.maxAttempts - record.attempts;
        return res.status(400).json({
          success: false,
          message: `Invalid verification OTP. ${remaining} attempt(s) remaining.`,
        });
      }

      record.verified = true;
      record.used = true;
      await record.save();
      verifiedEmail = record.email || verifiedEmail;
    }

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters long.',
      });
    }

    // Update email if provided
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== user.email) {
        const emailExists = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (emailExists) {
          return res.status(409).json({
            success: false,
            message: `Email address '${cleanEmail}' is already in use by another account.`,
          });
        }
        user.email = cleanEmail;
      }
    } else if (verifiedEmail && (!user.email || user.email.startsWith('guest.'))) {
      user.email = verifiedEmail;
    }

    // Update name if provided
    if (name && name.trim()) {
      user.name = name.trim();
    }

    // Upgrade account: preserve original ObjectId, bookings, payments, and gaming records!
    user.accountType = 'REGISTERED';
    user.isGuest = false;
    user.guestConvertedAt = new Date();
    user.guestConvertedBy = req.user?._id || user._id;
    user.password = password; // Hashed by User model pre-save hook

    await user.save();

    // Verify existing customer records remain intact
    const [bookingCount, paymentCount, sessionCount] = await Promise.all([
      Booking.countDocuments({ customer: user._id }),
      Payment.countDocuments({ customer: user._id }),
      GamingSession.countDocuments({ customer: user._id }),
    ]);

    await ActivityLog.create({
      userId: req.user?._id || user._id,
      userName: req.user?.name || user.name,
      userRole: req.user?.role || 'customer',
      action: 'GUEST_CONVERTED_TO_REGISTERED',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Guest account '${user.name}' (${user.phone}) successfully upgraded to Registered Customer. Preserved ${bookingCount} bookings, ${paymentCount} payments, and ${sessionCount} gaming sessions.`,
      details: {
        userId: user._id,
        phone: user.phone,
        email: user.email,
        preservedRecords: { bookingCount, paymentCount, sessionCount },
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    // Send Welcome Email to newly registered customer
    if (user.email) {
      sendWelcomeEmail({ user }).catch((err) =>
        console.error('[Admin Guest Conversion Welcome Email Error]:', err.message)
      );
    }

    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: `Account successfully upgraded to Registered Customer! All ${bookingCount} bookings and past payments are preserved.`,
      data: {
        token,
        user: user.toSafeObject(),
        preservedRecords: {
          bookingCount,
          paymentCount,
          sessionCount,
        },
      },
    });
  } catch (err) {
    console.error('completeGuestConversion Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to complete guest account conversion',
      error: err.message,
    });
  }
};

/**
 * 7. POST /api/admin/users/:id/reset-password/request-otp
 * Admin / Staff initiated customer password reset OTP
 */
export const initiatePasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    if (!user.email || !user.email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'This customer has no registered email on file. Update profile with an email address first.',
      });
    }

    // Check resend cooldown (60 seconds)
    const recentOtp = await OtpVerification.findOne({
      userId: user._id,
      purpose: 'PASSWORD_RESET',
      used: false,
    }).sort({ createdAt: -1 });

    if (recentOtp && new Date() < new Date(recentOtp.resendAvailableAt)) {
      const remainingSeconds = Math.ceil((new Date(recentOtp.resendAvailableAt).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} second(s) before requesting a new password reset code.`,
        data: { remainingSeconds },
      });
    }

    // Invalidate previous OTPs
    await OtpVerification.updateMany(
      { userId: user._id, purpose: 'PASSWORD_RESET', used: false },
      { used: true }
    );

    // Generate secure 6-digit OTP and store SHA-256 hash
    const otpCode = OtpVerification.generateNumericOtp();
    const otpHash = OtpVerification.hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60s cooldown

    await OtpVerification.create({
      userId: user._id,
      email: user.email,
      otpHash,
      purpose: 'PASSWORD_RESET',
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5,
    });

    // Send real OTP email via Resend
    const emailResult = await sendOtpEmail({
      email: user.email,
      name: user.name,
      otp: otpCode,
      purpose: 'PASSWORD_RESET',
      expiresMinutes: 5,
    });

    if (emailResult.notConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Email verification service is currently unconfigured on the server.',
      });
    }

    await ActivityLog.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Staff User',
      userRole: req.user?.role || 'receptionist',
      action: 'PASSWORD_RESET_OTP_SENT',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Password reset OTP dispatched to '${user.email}' for customer '${user.name}' (${user.phone})`,
      details: { targetUserId: user._id, phone: user.phone, email: user.email },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Password reset OTP dispatched to customer's email (${maskEmail(user.email)}). Valid for 5 minutes.`,
      data: {
        userId: user._id,
        phone: user.phone,
        email: user.email,
        maskedPhone: maskPhone(user.phone),
        maskedEmail: maskEmail(user.email),
        resendCooldownSeconds: 60,
        expiresInSeconds: 300,
      },
    });
  } catch (err) {
    console.error('initiatePasswordReset Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate password reset',
      error: err.message,
    });
  }
};

/**
 * 8. POST /api/admin/users/:id/reset-password/complete
 * Complete Password Reset with OTP or Admin authorization
 */
export const completePasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp, newPassword, adminBypass } = req.body;

    const user = await User.findById(id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin || !adminBypass) {
      if (!otp || !otp.trim()) {
        return res.status(400).json({ success: false, message: 'Reset OTP is required' });
      }

      const cleanOtp = otp.trim();
      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ success: false, message: 'Verification code must be exactly 6 digits.' });
      }

      const record = await OtpVerification.findOne({
        userId: user._id,
        purpose: 'PASSWORD_RESET',
        used: false,
      }).select('+otpHash').sort({ createdAt: -1 });

      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No active password reset request found. Please request an OTP first.',
        });
      }

      if (new Date() > new Date(record.expiresAt)) {
        record.used = true;
        await record.save();
        return res.status(400).json({
          success: false,
          message: 'OTP has expired (5-minute limit). Please request a new code.',
        });
      }

      if (record.attempts >= record.maxAttempts) {
        record.used = true;
        await record.save();
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts (5/5). Please request a new OTP.',
        });
      }

      const isValid = record.verifyOtp(cleanOtp);
      if (!isValid) {
        record.attempts += 1;
        if (record.attempts >= record.maxAttempts) {
          record.used = true;
          await record.save();
          return res.status(429).json({
            success: false,
            message: 'Too many incorrect attempts (5/5). Please request a new OTP.',
          });
        }
        await record.save();
        const remaining = record.maxAttempts - record.attempts;
        return res.status(400).json({
          success: false,
          message: `Invalid reset OTP. ${remaining} attempt(s) remaining.`,
        });
      }

      record.verified = true;
      record.used = true;
      await record.save();
    }

    // Update password securely
    user.password = newPassword;
    await user.save();

    await ActivityLog.create({
      userId: req.user?._id || user._id,
      userName: req.user?.name || user.name,
      userRole: req.user?.role || 'staff',
      action: 'PASSWORD_RESET_COMPLETED',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Password reset successfully completed for customer '${user.name}' (${user.phone})`,
      details: { targetUserId: user._id, targetEmail: user.email },
      ipAddress: req.ip || '127.0.0.1',
    });

    // Send password reset confirmation email
    if (user.email) {
      sendPasswordResetConfirmationEmail({ user }).catch((err) =>
        console.error('[Admin Password Reset Confirmation Email Error]:', err.message)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (err) {
    console.error('completePasswordReset Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: err.message,
    });
  }
};

/**
 * 9. GET /api/admin/users/check-duplicate
 * Fast pre-creation duplicate check by phone or email
 */
export const checkDuplicateUser = async (req, res) => {
  try {
    const { phone, email } = req.query;
    if (!phone && !email) {
      return res.status(400).json({ success: false, message: 'Provide phone or email to check' });
    }

    const query = {};
    if (phone) query.phone = phone.trim().replace(/\D/g, '');
    if (email) query.email = email.trim().toLowerCase();

    const existingUser = await User.findOne(query)
      .populate('membership.planId', 'name')
      .select('-password -conversionOtp -passwordResetOtp')
      .lean();

    if (!existingUser) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: 'No existing customer account found with these details.',
      });
    }

    res.status(200).json({
      success: true,
      exists: true,
      user: existingUser,
      accountType: existingUser.accountType || 'REGISTERED',
      isGuest: existingUser.accountType === 'GUEST' || !!existingUser.isGuest,
      message: `Found existing ${existingUser.accountType === 'GUEST' ? 'Guest' : 'Registered'} profile for ${existingUser.name}.`,
    });
  } catch (err) {
    console.error('checkDuplicateUser Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error checking duplicate user',
      error: err.message,
    });
  }
};

/**
 * 10. POST /api/admin/users/merge
 * Admin-controlled account merge workflow: migrate all bookings, payments, and sessions
 */
export const mergeDuplicateAccounts = async (req, res) => {
  try {
    const { primaryUserId, secondaryUserId, reason = 'Duplicate customer record merge' } = req.body;

    if (!primaryUserId || !secondaryUserId) {
      return res.status(400).json({
        success: false,
        message: 'Both primaryUserId (account to keep) and secondaryUserId (account to merge) are required.',
      });
    }

    if (primaryUserId.toString() === secondaryUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Primary and secondary user cannot be the same account.',
      });
    }

    const [primaryUser, secondaryUser] = await Promise.all([
      User.findById(primaryUserId),
      User.findById(secondaryUserId),
    ]);

    if (!primaryUser) {
      return res.status(404).json({ success: false, message: 'Primary customer account not found.' });
    }
    if (!secondaryUser) {
      return res.status(404).json({ success: false, message: 'Secondary customer account not found.' });
    }

    // Safety: Cannot merge an active Administrator account into another account
    if (secondaryUser.role === ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        message: 'Cannot merge or deactivate an Administrator account.',
      });
    }

    // Migrate all references from secondary to primary
    const [bookingUpdate, paymentUpdate, sessionUpdate, usageUpdate, subUpdate] = await Promise.all([
      Booking.updateMany({ customer: secondaryUser._id }, { $set: { customer: primaryUser._id } }),
      Payment.updateMany({ customer: secondaryUser._id }, { $set: { customer: primaryUser._id } }),
      GamingSession.updateMany({ customer: secondaryUser._id }, { $set: { customer: primaryUser._id } }),
      MembershipUsage.updateMany({ customer: secondaryUser._id }, { $set: { customer: primaryUser._id } }),
      MembershipSubscription.updateMany({ customer: secondaryUser._id }, { $set: { customer: primaryUser._id } }),
    ]);

    // Deactivate and flag secondary user as merged
    secondaryUser.accountStatus = 'DEACTIVATED';
    secondaryUser.isActive = false;
    secondaryUser.mergedInto = primaryUser._id;
    secondaryUser.mergedAt = new Date();
    secondaryUser.notes = `${secondaryUser.notes || ''}\n[MERGED into ${primaryUser.name} (${primaryUser._id}) on ${new Date().toISOString()} by ${req.user.name}: ${reason}]`.trim();
    await secondaryUser.save();

    // Append merge history note to primary user
    primaryUser.notes = `${primaryUser.notes || ''}\n[MERGED customer ${secondaryUser.name} (${secondaryUser._id}) records into this profile on ${new Date().toISOString()} by ${req.user.name}]`.trim();
    await primaryUser.save();

    const migratedCounts = {
      bookings: bookingUpdate.modifiedCount,
      payments: paymentUpdate.modifiedCount,
      sessions: sessionUpdate.modifiedCount,
      membershipUsages: usageUpdate.modifiedCount,
      subscriptions: subUpdate.modifiedCount,
    };

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'MERGE_DUPLICATE_ACCOUNTS',
      category: 'USER_MANAGEMENT',
      customerId: primaryUser._id,
      description: `Merged secondary account '${secondaryUser.name}' (${secondaryUser._id}) into primary account '${primaryUser.name}' (${primaryUser._id}). Migrated ${migratedCounts.bookings} bookings, ${migratedCounts.payments} payments.`,
      details: {
        primaryUserId: primaryUser._id,
        secondaryUserId: secondaryUser._id,
        migratedCounts,
        reason,
      },
      ipAddress: req.ip || '127.0.0.1',
    });


    res.status(200).json({
      success: true,
      message: `Successfully merged accounts! Migrated ${migratedCounts.bookings} bookings, ${migratedCounts.payments} payments, and ${migratedCounts.sessions} gaming sessions to '${primaryUser.name}'.`,
      data: {
        primaryUser: primaryUser.toSafeObject(),
        migratedCounts,
      },
    });
  } catch (err) {
    console.error('mergeDuplicateAccounts Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to merge duplicate accounts',
      error: err.message,
    });
  }
};

/**
 * 11. DELETE /api/admin/users/:id
 * Permanently delete a user account (Admin only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid User ID format.',
      });
    }

    // 1. Guard against self-deletion
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own administrator account.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // 2. Guard primary administrator account
    if (user.email === 'admin@gaminglounge.com' || user.email === 'admin@noahgaming.com') {
      return res.status(400).json({
        success: false,
        message: 'The primary system administrator account cannot be deleted.',
      });
    }

    // 3. Guard against deleting the last remaining active admin
    if (user.role === ROLES.ADMIN) {
      const activeAdminCount = await User.countDocuments({
        role: ROLES.ADMIN,
        accountStatus: 'ACTIVE',
        isActive: true,
      });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only remaining active administrator account.',
        });
      }
    }

    // 4. Check if user is in an active in-progress gaming session
    const activeSession = await GamingSession.findOne({
      customer: user._id,
      status: 'ACTIVE',
    });
    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: `User '${user.name}' currently has an active gaming session. Please stop the session before deleting the account.`,
      });
    }

    // 5. Clean up pending OTP verifications for this user's email
    if (user.email) {
      await OtpVerification.deleteMany({ email: user.email.toLowerCase() });
    }

    // 6. Record in ActivityLog before deletion
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_USER',
      category: 'USER_MANAGEMENT',
      customerId: user._id,
      description: `Administrator ${req.user.name} permanently deleted customer account '${user.name}' (${user.email || user.phone || user.customerId || id}).`,
      details: {
        deletedUserId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountType: user.accountType,
        customerId: user.customerId,
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'SUCCESS',
    });

    // 7. Delete User document
    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `User '${user.name}' has been permanently deleted.`,
      data: {
        deletedUserId: id,
        name: user.name,
      },
    });
  } catch (err) {
    console.error('deleteUser Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user account',
      error: err.message,
    });
  }
};
