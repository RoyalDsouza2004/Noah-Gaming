import { Resend } from 'resend';
import EmailLog from '../models/EmailLog.js';
import * as templates from '../utils/emailTemplates.js';
import { generateReceipt } from '../utils/receiptGenerator.js';
import { generatePdfReceipt } from './pdfReceipt.service.js';

let resendClient = null;

/**
 * Lazy initialization of Resend client
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Core Universal Email Sender
 * Handles:
 * - Missing API key / credentials (graceful fallback, logs as NOT_CONFIGURED)
 * - Deduplication via unique eventKey (prevents webhook duplicate emails)
 * - Resend API dispatch
 * - Immutable EmailLog persistence
 * - Zero uncaught exceptions (never fails caller's transaction)
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  emailType,
  relatedId = {},
  eventKey = null,
  attachments = [],
  metadata = {},
}) {
  const recipient = (Array.isArray(to) ? to[0] : to)?.trim()?.toLowerCase();
  if (!recipient) {
    console.warn('[Email Service] Skipped sending: No recipient specified.');
    return { success: false, reason: 'NO_RECIPIENT' };
  }

  // 1. Deduplication check: if this event was already accepted/sent, skip
  if (eventKey) {
    const existingLog = await EmailLog.findOne({
      eventKey,
      status: { $in: ['ACCEPTED', 'DELIVERED'] },
    });
    if (existingLog) {
      console.log(`[Email Service] Skipped duplicate email for eventKey: ${eventKey}`);
      return { success: true, duplicateSkipped: true, existingLogId: existingLog._id };
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  let fromAddress = process.env.EMAIL_FROM?.trim();
  let replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  // Resend requirement: Public webmail providers (@gmail.com, @yahoo.com, etc.) cannot be used
  // in 'from' without custom domain DKIM/SPF verification. Fallback to Resend's verified onboarding domain.
  if (fromAddress && /@(gmail|yahoo|outlook|hotmail|icloud)\.com$/i.test(fromAddress)) {
    if (!replyTo) {
      replyTo = fromAddress;
    }
    fromAddress = `NOAH GAMING <onboarding@resend.dev>`;
  }

  // 2. Check if Resend credentials are configured
  if (!apiKey || !fromAddress) {
    console.warn(
      `[Email Service] Cannot dispatch email (${emailType}) to ${recipient}: ` +
        `RESEND_API_KEY or EMAIL_FROM is not configured in backend .env. Skipping.`
    );

    // Record in EmailLog so admin can see skipped emails due to missing configuration
    const log = await EmailLog.create({
      recipient,
      emailType,
      subject,
      relatedId,
      eventKey,
      status: 'NOT_CONFIGURED',
      failureReason: 'Email service unconfigured: RESEND_API_KEY or EMAIL_FROM is missing in backend .env',
      hasAttachment: attachments.length > 0,
      attachmentName: attachments[0]?.filename || null,
      metadata,
    });

    return {
      success: false,
      notConfigured: true,
      logId: log._id,
      message: 'Email service is currently unconfigured. Add RESEND_API_KEY and EMAIL_FROM to .env.',
    };
  }

  // 3. Dispatch to Resend SDK
  let emailLog = null;
  try {
    const resend = getResendClient();

    // Prepare attachments if present (Resend expects { filename, content: Buffer })
    const formattedAttachments = attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
    }));

    const response = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(formattedAttachments.length > 0 ? { attachments: formattedAttachments } : {}),
    });

    if (response.error) {
      console.error(`[Email Service Error] Resend returned error:`, response.error);

      emailLog = await EmailLog.create({
        recipient,
        emailType,
        subject,
        relatedId,
        eventKey,
        status: 'FAILED',
        failureReason: response.error.message || 'Resend API error',
        hasAttachment: attachments.length > 0,
        attachmentName: attachments[0]?.filename || null,
        metadata,
      });

      return {
        success: false,
        error: response.error.message,
        logId: emailLog._id,
      };
    }

    // Success: Resend has accepted the email for delivery
    const resendId = response.data?.id;
    console.log(`[Email Service] Email accepted by Resend (ID: ${resendId}) for ${recipient} [${emailType}]`);

    emailLog = await EmailLog.create({
      recipient,
      emailType,
      subject,
      relatedId,
      eventKey,
      resendEmailId: resendId,
      status: 'ACCEPTED',
      hasAttachment: attachments.length > 0,
      attachmentName: attachments[0]?.filename || null,
      metadata: { ...metadata, resendResponse: response.data },
    });

    return {
      success: true,
      status: 'ACCEPTED',
      resendId,
      logId: emailLog._id,
    };
  } catch (err) {
    console.error(`[Email Service Exception] Failed sending email to ${recipient}:`, err.message);

    try {
      emailLog = await EmailLog.create({
        recipient,
        emailType,
        subject,
        relatedId,
        eventKey,
        status: 'FAILED',
        failureReason: err.message || 'Unknown network/runtime error',
        hasAttachment: attachments.length > 0,
        attachmentName: attachments[0]?.filename || null,
        metadata,
      });
    } catch (logErr) {
      console.warn('[Email Service] Failed saving EmailLog:', logErr.message);
    }

    return {
      success: false,
      error: err.message,
      logId: emailLog?._id,
    };
  }
}

// ==============================================================================
// HIGH-LEVEL TRANSACTIONAL EMAIL HANDLERS
// ==============================================================================

/**
 * 1. Registration Welcome Email
 */
export async function sendWelcomeEmail({ user }) {
  if (!user || !user.email) return;
  const template = templates.getWelcomeEmail({
    name: user.name,
    email: user.email,
    phone: user.phone,
  });

  return sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'WELCOME',
    relatedId: { userId: user._id },
    eventKey: `WELCOME_${user._id}`,
  });
}

/**
 * 2. Booking Confirmation Email
 */
export async function sendBookingConfirmationEmail({ booking, customer, device, game }) {
  if (!customer?.email || customer.email.startsWith('guest.')) {
    // If customer has a dummy guest email, skip
    return;
  }

  const template = templates.getBookingConfirmationEmail({ booking, customer, device, game });

  return sendEmail({
    to: customer.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'BOOKING_CONFIRMATION',
    relatedId: {
      bookingId: booking.bookingId,
      userId: customer._id,
    },
    eventKey: `BOOKING_CONFIRM_${booking.bookingId}`,
    metadata: {
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      duration: booking.duration,
      totalAmount: booking.totalAmount,
    },
  });
}

/**
 * 3. Booking Cancellation Email
 */
export async function sendBookingCancellationEmail({ booking, customer, reason = '' }) {
  if (!customer?.email || customer.email.startsWith('guest.')) {
    return;
  }

  const template = templates.getBookingCancellationEmail({ booking, customer, reason });

  return sendEmail({
    to: customer.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'BOOKING_CANCELLATION',
    relatedId: {
      bookingId: booking.bookingId,
      userId: customer._id,
    },
    eventKey: `BOOKING_CANCEL_${booking.bookingId}`,
    metadata: { reason },
  });
}

/**
 * 4. Successful Payment Confirmation Email (with PDF Receipt Attachment)
 */
export async function sendPaymentSuccessEmail({ payment, customer, booking = null }) {
  if (!customer?.email || customer.email.startsWith('guest.')) {
    return;
  }

  const attachments = [];
  let hasAttachment = false;

  // Attempt to generate executive PDF receipt attachment
  try {
    const receiptData = await generateReceipt({ payment, booking, customer });
    if (receiptData) {
      const pdfBuffer = await generatePdfReceipt(receiptData);
      if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
        attachments.push({
          filename: `NOAH_Receipt_${payment.receiptNumber || payment.paymentId}.pdf`,
          content: pdfBuffer,
        });
        hasAttachment = true;
      }
    }
  } catch (pdfErr) {
    console.warn(`[Email Service] Could not generate PDF attachment: ${pdfErr.message}. Sending email without attachment.`);
  }

  const template = templates.getPaymentSuccessEmail({
    payment,
    customer,
    booking,
    hasAttachment,
  });

  return sendEmail({
    to: customer.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'PAYMENT_CONFIRMATION',
    relatedId: {
      paymentId: payment.paymentId,
      bookingId: booking?.bookingId || null,
      userId: customer._id,
    },
    eventKey: `PAYMENT_SUCCESS_${payment.receiptNumber || payment.paymentId}`,
    attachments,
    metadata: {
      amountPaise: payment.amountPaise,
      receiptNumber: payment.receiptNumber,
      gateway: payment.paymentGateway,
    },
  });
}

/**
 * 5. Membership Activation Confirmation Email
 */
export async function sendMembershipActivationEmail({ customer, plan, subscription }) {
  if (!customer?.email || customer.email.startsWith('guest.')) {
    return;
  }

  const template = templates.getMembershipActivationEmail({ customer, plan, subscription });

  return sendEmail({
    to: customer.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'MEMBERSHIP_ACTIVATION',
    relatedId: {
      membershipId: subscription._id?.toString(),
      userId: customer._id,
    },
    eventKey: `MEMBERSHIP_ACTIVATE_${subscription._id}`,
    metadata: {
      planName: plan?.name,
      tier: plan?.tier,
      expiresAt: subscription.expiresAt,
    },
  });
}

/**
 * 6. Membership Expiry Reminder Email
 */
export async function sendMembershipExpiryReminderEmail({ customer, plan, expiresAt, daysRemaining = 3 }) {
  if (!customer?.email || customer.email.startsWith('guest.')) {
    return;
  }

  const template = templates.getMembershipExpiryReminderEmail({
    customer,
    plan,
    expiresAt,
    daysRemaining,
  });

  const expiryDateKey = new Date(expiresAt).toISOString().slice(0, 10);

  return sendEmail({
    to: customer.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'MEMBERSHIP_EXPIRY_REMINDER',
    relatedId: {
      userId: customer._id,
    },
    eventKey: `MEMBERSHIP_EXPIRY_REMINDER_${customer._id}_${expiryDateKey}`,
    metadata: { daysRemaining, expiresAt },
  });
}

/**
 * 7. Password Reset Email
 */
export async function sendPasswordResetEmail({ user, resetToken, resetUrl, expiresMinutes = 60 }) {
  if (!user?.email) return;

  const template = templates.getPasswordResetEmail({
    name: user.name,
    resetUrl,
    resetToken,
    expiresMinutes,
  });

  return sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'PASSWORD_RESET',
    relatedId: { userId: user._id },
    metadata: { expiresMinutes },
  });
}

/**
 * 8. Password Reset Confirmation Email
 */
export async function sendPasswordResetConfirmationEmail({ user }) {
  if (!user?.email) return;

  const template = templates.getPasswordResetConfirmationEmail({ name: user.name });

  return sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: 'PASSWORD_RESET_CONFIRMATION',
    relatedId: { userId: user._id },
  });
}

/**
 * 9. Admin Test Email
 */
export async function sendTestEmail(target) {
  const recipient = typeof target === 'string' ? target : target?.recipient;
  const subject = 'NOAH GAMING • Resend Email Integration Test';
  const html = templates.wrapInNoahLayout({
    title: 'Test Email Successful',
    previewText: 'Your Resend email configuration is active and working perfectly.',
    contentHtml: `
      <div style="background-color: #171014; border: 1px solid #49202C; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 24px; background-color: rgba(215, 255, 0, 0.15); border: 1px solid rgba(215, 255, 0, 0.4); color: #D7FF00; font-size: 24px; margin-bottom: 12px;">✓</div>
        <h3 style="color: #FFF4E8; margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">Email Integration Active!</h3>
        <p style="color: #C7A5A8; font-size: 13px; margin: 0; line-height: 1.5;">This test message confirms that your Resend API credentials, sender address, and responsive email layouts are operational.</p>
      </div>
      <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="font-size: 13px; color: #FFF4E8; border-collapse: collapse; margin-bottom: 24px;">
        <tr style="border-bottom: 1px solid #331521;">
          <td style="color: #A38084; font-weight: 600;">Provider:</td>
          <td style="font-weight: 700; color: #D7FF00;">Resend (Official Node.js SDK)</td>
        </tr>
        <tr style="border-bottom: 1px solid #331521;">
          <td style="color: #A38084; font-weight: 600;">Sender Address:</td>
          <td style="font-family: monospace;">${process.env.EMAIL_FROM || 'Not configured'}</td>
        </tr>
        <tr style="border-bottom: 1px solid #331521;">
          <td style="color: #A38084; font-weight: 600;">Timezone:</td>
          <td>Asia/Kolkata (IST)</td>
        </tr>
        <tr>
          <td style="color: #A38084; font-weight: 600;">Dispatch Timestamp:</td>
          <td>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
        </tr>
      </table>
    `,
  });

  return sendEmail({
    to: recipient,
    subject,
    html,
    text: 'NOAH GAMING • Resend Email Integration Test. Your Resend API credentials and sender address are operational!',
    emailType: 'TEST',
    eventKey: `TEST_EMAIL_${Date.now()}`,
    metadata: { isTestEmail: true },
  });
}

/**
 * 10. Send Real 6-Digit Email OTP Verification
 */
export async function sendOtpEmail({ email, name = 'Gamer', otp, purpose = 'LOGIN_2FA', expiresMinutes = 5 }) {
  const template = templates.getOtpEmail({ name, otp, purpose, expiresMinutes });

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    emailType: purpose,
    eventKey: `OTP_${purpose}_${email}_${Date.now()}`,
    metadata: { purpose, recipientName: name },
  });
}

/**
 * Email Service Status for Admin Panel
 * Never exposes API key in response
 */
export async function getEmailServiceStatus() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  const isConfigured = Boolean(apiKey && fromAddress);

  const [totalCount, acceptedCount, failedCount, notConfiguredCount, recentActivity] = await Promise.all([
    EmailLog.countDocuments({}),
    EmailLog.countDocuments({ status: 'ACCEPTED' }),
    EmailLog.countDocuments({ status: 'FAILED' }),
    EmailLog.countDocuments({ status: 'NOT_CONFIGURED' }),
    EmailLog.find({}).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return {
    provider: 'Resend',
    sdkInstalled: true,
    isConfigured,
    senderEmail: fromAddress || null,
    replyToEmail: replyTo || null,
    hasApiKey: Boolean(apiKey),
    stats: {
      totalEmails: totalCount,
      accepted: acceptedCount,
      failed: failedCount,
      unconfiguredSkipped: notConfiguredCount,
    },
    recentActivity,
  };
}

/**
 * Retry Failed Email Log
 */
export async function retryEmail(logId) {
  const log = await EmailLog.findById(logId);
  if (!log) {
    throw new Error('Email log not found');
  }

  if (log.attempts >= log.maxAttempts) {
    throw new Error(`Email has exceeded maximum retry attempts (${log.maxAttempts})`);
  }

  log.attempts += 1;
  log.lastAttemptAt = new Date();
  await log.save();

  return sendEmail({
    to: log.recipient,
    subject: log.subject,
    html: templates.wrapInNoahLayout({
      title: log.subject,
      previewText: log.subject,
      contentHtml: `<p>Retrying email: ${log.subject}</p>`,
    }),
    text: `Retrying email: ${log.subject}`,
    emailType: log.emailType,
    relatedId: log.relatedId,
  });
}
