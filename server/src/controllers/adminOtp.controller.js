import crypto from 'crypto';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import OtpAuditLog from '../models/OtpAuditLog.js';
import EmailLog from '../models/EmailLog.js';
import ActivityLog from '../models/ActivityLog.js';

/**
 * 1. Get Pending & Recent OTP Verification Requests
 * Supports filtering by purpose, status, email delivery failure, and search
 */
export const getPendingOtpRequests = async (req, res) => {
  try {
    const {
      purpose = 'ALL',
      status = 'ALL',
      deliveryStatus = 'ALL',
      search = '',
    } = req.query;

    const query = {};

    // Purpose filter
    if (purpose && purpose !== 'ALL') {
      query.purpose = purpose;
    } else {
      query.purpose = { $in: ['REGISTRATION', 'LOGIN_2FA'] };
    }

    // Delivery status filter
    if (deliveryStatus && deliveryStatus !== 'ALL') {
      query.emailDeliveryStatus = deliveryStatus;
    }

    // Search query on email, phone, or name
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ email: regex }, { phone: regex }, { userName: regex }];
    }

    // Time window: fetch challenges from past 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    query.createdAt = { $gte: twelveHoursAgo };

    // Strict isolation: OTP Manager strictly monitors actual OTP challenges and delivery failures.
    // Dedicated Admin Assistance requests appear solely in Verification Assistance.
    query.assistanceRequested = { $ne: true };
    query.status = { $ne: 'AWAITING_ADMIN_ASSISTANCE' };

    const records = await OtpVerification.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone accountStatus isEmailVerified role customerId')
      .lean();

    const now = new Date();
    const formatted = records.map((record) => {
      const expiresAt = new Date(record.expiresAt);
      const isExpired = now > expiresAt;
      const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

      let effectiveStatus = record.status;
      if (
        isExpired &&
        (record.status === 'PENDING' || record.status === 'AWAITING_ADMIN_ASSISTANCE')
      ) {
        effectiveStatus = 'EXPIRED';
      }

      return {
        _id: record._id,
        challengeId: record.challengeId,
        purpose: record.purpose,
        userName: record.userName || record.userId?.name || 'Customer',
        email: record.email,
        phone: record.phone || record.userId?.phone || '',
        user: record.userId || null,
        emailDeliveryStatus: record.emailDeliveryStatus || 'PENDING',
        emailDeliveryError: record.emailDeliveryError || '',
        assistanceRequested: record.assistanceRequested || false,
        assistanceRequestedAt: record.assistanceRequestedAt || null,
        status: effectiveStatus,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        remainingSeconds,
        isExpired,
        attempts: record.attempts,
        maxAttempts: record.maxAttempts,
        adminDecision: record.adminDecision || null,
        canApprove:
          !isExpired &&
          !record.used &&
          effectiveStatus !== 'APPROVED' &&
          effectiveStatus !== 'REJECTED' &&
          effectiveStatus !== 'CONSUMED',
        canReject:
          !record.used &&
          effectiveStatus !== 'REJECTED' &&
          effectiveStatus !== 'CONSUMED',
      };
    });

    // In-memory status filter if specific status requested
    let filtered = formatted;
    if (status && status !== 'ALL') {
      if (status === 'AWAITING_ADMIN_ASSISTANCE') {
        filtered = formatted.filter((item) => item.status === 'AWAITING_ADMIN_ASSISTANCE' && !item.isExpired);
      } else if (status === 'EXPIRED') {
        filtered = formatted.filter((item) => item.isExpired || item.status === 'EXPIRED');
      } else {
        filtered = formatted.filter((item) => item.status === status);
      }
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err) {
    console.error('[getPendingOtpRequests Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending OTP requests.',
      error: err.message,
    });
  }
};

/**
 * 2. Approve OTP Request with Admin Password Re-Authentication
 * Strict check: Only Admin can approve, must supply valid Admin password
 */
export const approveOtpRequest = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { adminPassword, note } = req.body;

    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    if (!adminPassword || !adminPassword.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Administrator password is required to approve identity verification.',
      });
    }

    // 1. Re-authenticate Admin
    const adminUser = await User.findById(req.user._id).select('+password');
    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'Admin account not found.' });
    }

    const isMatch = await adminUser.comparePassword(adminPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid administrator password. Verification approval denied.',
      });
    }

    // 2. Fetch challenge record
    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      used: false,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Active OTP verification challenge not found or already consumed.',
      });
    }

    // 3. Check 5-minute expiry
    if (new Date() > new Date(record.expiresAt)) {
      record.status = 'EXPIRED';
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: 'This verification challenge has expired (5-minute limit) and cannot be approved.',
      });
    }

    // 4. Generate single-use approval token
    const approvalToken = crypto.randomBytes(32).toString('hex');

    record.status = 'APPROVED';
    record.approvalToken = approvalToken;
    record.adminDecision = {
      status: 'APPROVED',
      adminId: req.user._id,
      adminName: req.user.name,
      decidedAt: new Date(),
      reason: note?.trim() || 'Approved by Admin via Fallback',
    };

    await record.save();

    // 5. Activity Log
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADMIN_APPROVED_OTP_CHALLENGE',
      category: 'AUTH',
      details: {
        challengeId: record.challengeId,
        purpose: record.purpose,
        customerEmail: record.email,
        customerPhone: record.phone,
        note: note || '',
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(200).json({
      success: true,
      message: `OTP challenge approved for ${record.userName || record.email}. The customer may now complete verification.`,
      data: {
        challengeId: record.challengeId,
        status: 'APPROVED',
        approvedAt: record.adminDecision.decidedAt,
      },
    });
  } catch (err) {
    console.error('[approveOtpRequest Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while approving verification request.',
      error: err.message,
    });
  }
};

/**
 * 3. Reject OTP Request
 */
export const rejectOtpRequest = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { reason } = req.body;

    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const record = await OtpVerification.findOne({
      challengeId: challengeId.trim(),
      used: false,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Active OTP verification challenge not found or already consumed.',
      });
    }

    const decisionReason = reason?.trim() || 'Verification rejected by administrator.';

    record.status = 'REJECTED';
    record.used = true;
    record.adminDecision = {
      status: 'REJECTED',
      adminId: req.user._id,
      adminName: req.user.name,
      decidedAt: new Date(),
      reason: decisionReason,
    };

    await record.save();

    // Create non-expiring audit record
    await OtpAuditLog.create({
      challengeId: record.challengeId,
      userId: record.userId,
      userName: record.userName,
      email: record.email,
      phone: record.phone,
      purpose: record.purpose,
      emailDeliveryStatus: record.emailDeliveryStatus,
      emailDeliveryError: record.emailDeliveryError,
      assistanceRequested: record.assistanceRequested,
      assistanceRequestedAt: record.assistanceRequestedAt,
      resolution: 'ADMIN_REJECTED',
      adminId: req.user._id,
      adminName: req.user.name,
      decisionTimestamp: new Date(),
      note: decisionReason,
      ipAddress: req.ip || '127.0.0.1',
    });

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADMIN_REJECTED_OTP_CHALLENGE',
      category: 'AUTH',
      details: {
        challengeId: record.challengeId,
        purpose: record.purpose,
        customerEmail: record.email,
        customerPhone: record.phone,
        reason: decisionReason,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(200).json({
      success: true,
      message: `OTP challenge rejected for ${record.userName || record.email}.`,
      data: {
        challengeId: record.challengeId,
        status: 'REJECTED',
      },
    });
  } catch (err) {
    console.error('[rejectOtpRequest Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while rejecting verification request.',
      error: err.message,
    });
  }
};

/**
 * 4. Get Verification History Audit Log
 * Permanent history queried from OtpAuditLog
 */
export const getOtpHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      resolution = 'ALL',
      purpose = 'ALL',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (resolution && resolution !== 'ALL') {
      query.resolution = resolution;
    }

    if (purpose && purpose !== 'ALL') {
      query.purpose = purpose;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ email: regex }, { phone: regex }, { userName: regex }, { note: regex }];
    }

    const [logs, total] = await Promise.all([
      OtpAuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      OtpAuditLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error('[getOtpHistory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch verification audit history.',
      error: err.message,
    });
  }
};

/**
 * 5. Get Email Delivery Log Details for a Challenge
 */
export const getDeliveryLogDetails = async (req, res) => {
  try {
    const { challengeId } = req.params;
    if (!challengeId) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const record = await OtpVerification.findOne({ challengeId: challengeId.trim() }).lean();
    if (!record) {
      return res.status(404).json({ success: false, message: 'Challenge record not found.' });
    }

    // Find related email logs for this recipient and purpose
    const emailLogs = await EmailLog.find({
      recipient: record.email.toLowerCase(),
      emailType: record.purpose,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        challengeId: record.challengeId,
        email: record.email,
        purpose: record.purpose,
        emailDeliveryStatus: record.emailDeliveryStatus,
        emailDeliveryError: record.emailDeliveryError,
        recentEmailLogs: emailLogs,
      },
    });
  } catch (err) {
    console.error('[getDeliveryLogDetails Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to inspect email delivery details.',
      error: err.message,
    });
  }
};
