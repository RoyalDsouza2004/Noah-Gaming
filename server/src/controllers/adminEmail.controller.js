import EmailLog from '../models/EmailLog.js';
import ActivityLog from '../models/ActivityLog.js';
import {
  getEmailServiceStatus,
  sendTestEmail,
  retryEmail,
} from '../services/email.service.js';

/**
 * 1. GET /api/admin/email/status
 * Fetches status of email service, configuration status, sender, and log metrics.
 * Security: NEVER returns RESEND_API_KEY.
 */
export const getEmailStatus = async (req, res) => {
  try {
    const status = await getEmailServiceStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    console.error('[Admin Email Status Error]', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve email service status',
      error: err.message,
    });
  }
};

/**
 * 2. GET /api/admin/email/logs
 * Fetches paginated transactional email dispatch logs with filters.
 */
export const getEmailLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      status = 'ALL',
      emailType = 'ALL',
      search = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    if (emailType && emailType !== 'ALL') {
      filter.emailType = emailType;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ recipient: regex }, { subject: regex }, { resendEmailId: regex }];
    }

    const [logs, totalCount] = await Promise.all([
      EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      EmailLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum,
          hasPrevPage: pageNum > 1,
          hasNextPage: pageNum < totalPages,
        },
      },
    });
  } catch (err) {
    console.error('[Admin Email Logs Error]', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve email activity logs',
      error: err.message,
    });
  }
};

/**
 * 3. POST /api/admin/email/test
 * Dispatches a test email to the provided address to verify Resend configuration.
 */
export const triggerTestEmail = async (req, res) => {
  try {
    const { recipient } = req.body;
    if (!recipient || !recipient.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email address is required',
      });
    }

    const cleanEmail = recipient.trim().toLowerCase();
    const result = await sendTestEmail(cleanEmail);

    if (result.notConfigured) {
      return res.status(200).json({
        success: false,
        configured: false,
        message:
          'Resend email service is currently unconfigured. Please add RESEND_API_KEY and EMAIL_FROM to server/.env.',
        data: result,
      });
    }

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to dispatch test email',
        data: result,
      });
    }

    // Log admin activity
    await ActivityLog.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Administrator',
      userRole: req.user?.role || 'admin',
      action: 'ADMIN_EMAIL_TEST_SENT',
      category: 'SYSTEM',
      description: `Dispatched test email to '${cleanEmail}' via Resend`,
      details: { recipient: cleanEmail, resendId: result.resendId || result.id },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Test email successfully dispatched to ${cleanEmail}!`,
      data: result,
    });
  } catch (err) {
    console.error('[Trigger Test Email Error]', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: err.message,
    });
  }
};

/**
 * 4. POST /api/admin/email/retry/:id
 * Retries sending an existing email log
 */
export const retryEmailDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await retryEmail(id);

    await ActivityLog.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Administrator',
      userRole: req.user?.role || 'admin',
      action: 'ADMIN_EMAIL_RETRY_TRIGGERED',
      category: 'SYSTEM',
      description: `Retried sending email log ${id}`,
      details: { logId: id, result },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'Email retry dispatched.',
      data: result,
    });
  } catch (err) {
    console.error('[Retry Email Error]', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to retry email',
    });
  }
};
