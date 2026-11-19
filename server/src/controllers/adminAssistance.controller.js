import crypto from 'crypto';
import User from '../models/User.js';
import AdminAssistanceRequest from '../models/AdminAssistanceRequest.js';
import OtpVerification from '../models/OtpVerification.js';
import ActivityLog from '../models/ActivityLog.js';

/**
 * 1. Get Pending & Recent Admin Assistance Requests
 * Filters by requestType, status, and search query
 */
export const getAssistanceRequests = async (req, res) => {
  try {
    const {
      requestType = 'ALL',
      status = 'ALL',
      search = '',
    } = req.query;

    const query = {};

    if (requestType && requestType !== 'ALL') {
      query.requestType = requestType;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ email: regex }, { phone: regex }, { userName: regex }];
    }

    // Past 12 hours time window
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    query.createdAt = { $gte: twelveHoursAgo };

    const records = await AdminAssistanceRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone accountStatus isEmailVerified role customerId')
      .lean();

    const now = new Date();
    const formatted = records.map((record) => {
      const expiresAt = new Date(record.expiresAt);
      const isExpired = now > expiresAt;
      const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

      let effectiveStatus = record.status;
      if (isExpired && effectiveStatus === 'PENDING') {
        effectiveStatus = 'EXPIRED';
      }

      return {
        _id: record._id,
        challengeId: record.challengeId,
        requestType: record.requestType,
        userName: record.userName || record.userId?.name || 'Customer',
        email: record.email,
        phone: record.phone || record.userId?.phone || '',
        user: record.userId || null,
        emailDeliveryStatus: record.emailDeliveryStatus || 'PENDING',
        emailDeliveryError: record.emailDeliveryError || '',
        status: effectiveStatus,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        remainingSeconds,
        isExpired,
        adminDecision: record.adminDecision || null,
        canApprove:
          !isExpired &&
          effectiveStatus !== 'APPROVED' &&
          effectiveStatus !== 'REJECTED' &&
          effectiveStatus !== 'CONSUMED',
        canReject:
          effectiveStatus !== 'REJECTED' &&
          effectiveStatus !== 'CONSUMED',
      };
    });

    let filtered = formatted;
    if (status && status !== 'ALL') {
      if (status === 'EXPIRED') {
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
    console.error('[getAssistanceRequests Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Admin Assistance requests.',
      error: err.message,
    });
  }
};

/**
 * 2. Approve Admin Assistance Request with Admin Password Re-Authentication
 */
export const approveAssistanceRequest = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { adminPassword, note } = req.body;

    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    if (!adminPassword || !adminPassword.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Administrator password is required to approve verification assistance.',
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
        message: 'Invalid administrator password. Assistance approval denied.',
      });
    }

    // 2. Fetch assistance request record
    const assistanceRecord = await AdminAssistanceRequest.findOne({
      challengeId: challengeId.trim(),
    });

    if (!assistanceRecord) {
      return res.status(404).json({
        success: false,
        message: 'Active Admin Assistance request not found.',
      });
    }

    // 3. Check 5-minute expiry
    if (new Date() > new Date(assistanceRecord.expiresAt)) {
      assistanceRecord.status = 'EXPIRED';
      await assistanceRecord.save();
      return res.status(400).json({
        success: false,
        message: 'This assistance request has expired (5-minute limit) and cannot be approved.',
      });
    }

    // 4. Generate single-use approval token
    const approvalToken = crypto.randomBytes(32).toString('hex');

    assistanceRecord.status = 'APPROVED';
    assistanceRecord.approvalToken = approvalToken;
    assistanceRecord.adminDecision = {
      status: 'APPROVED',
      adminId: req.user._id,
      adminName: req.user.name,
      decidedAt: new Date(),
      reason: note?.trim() || 'Approved by Admin in Verification Assistance',
    };

    await assistanceRecord.save();

    // 5. Also sync to linked OtpVerification if present so existing listener finishes cleanly
    const linkedOtp = await OtpVerification.findOne({ challengeId: challengeId.trim() });
    if (linkedOtp) {
      linkedOtp.status = 'APPROVED';
      linkedOtp.approvalToken = approvalToken;
      linkedOtp.adminDecision = assistanceRecord.adminDecision;
      await linkedOtp.save();
    }

    // 6. Log Activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADMIN_ASSISTANCE_APPROVED',
      category: 'AUTH',
      details: {
        challengeId,
        requestType: assistanceRecord.requestType,
        customerEmail: assistanceRecord.email,
        note: note || '',
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(200).json({
      success: true,
      message: 'Admin Assistance request approved successfully.',
      data: {
        challengeId,
        status: 'APPROVED',
      },
    });
  } catch (err) {
    console.error('[approveAssistanceRequest Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve assistance request.',
      error: err.message,
    });
  }
};

/**
 * 3. Reject Admin Assistance Request
 */
export const rejectAssistanceRequest = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { reason = '' } = req.body;

    if (!challengeId || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: 'Challenge identifier is required.' });
    }

    const assistanceRecord = await AdminAssistanceRequest.findOne({
      challengeId: challengeId.trim(),
    });

    if (!assistanceRecord) {
      return res.status(404).json({
        success: false,
        message: 'Active Admin Assistance request not found.',
      });
    }

    assistanceRecord.status = 'REJECTED';
    assistanceRecord.adminDecision = {
      status: 'REJECTED',
      adminId: req.user._id,
      adminName: req.user.name,
      decidedAt: new Date(),
      reason: reason?.trim() || 'Rejected by Admin',
    };

    await assistanceRecord.save();

    // Sync to linked OtpVerification if present
    const linkedOtp = await OtpVerification.findOne({ challengeId: challengeId.trim() });
    if (linkedOtp) {
      linkedOtp.status = 'REJECTED';
      linkedOtp.adminDecision = assistanceRecord.adminDecision;
      await linkedOtp.save();
    }

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ADMIN_ASSISTANCE_REJECTED',
      category: 'AUTH',
      details: {
        challengeId,
        requestType: assistanceRecord.requestType,
        customerEmail: assistanceRecord.email,
        reason: reason || '',
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(200).json({
      success: true,
      message: 'Admin Assistance request rejected.',
      data: {
        challengeId,
        status: 'REJECTED',
      },
    });
  } catch (err) {
    console.error('[rejectAssistanceRequest Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject assistance request.',
      error: err.message,
    });
  }
};

/**
 * 4. Get Assistance Request Audit History
 */
export const getAssistanceHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      status = 'ALL',
      requestType = 'ALL',
      search = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (requestType && requestType !== 'ALL') {
      query.requestType = requestType;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ email: regex }, { phone: regex }, { userName: regex }];
    }

    const [records, total] = await Promise.all([
      AdminAssistanceRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name email phone customerId')
        .populate('adminDecision.adminId', 'name email')
        .lean(),
      AdminAssistanceRequest.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error('[getAssistanceHistory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assistance history.',
      error: err.message,
    });
  }
};
