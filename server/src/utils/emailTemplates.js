/**
 * NOAH GAMING Transactional Email HTML Templates
 * Brand Palette:
 * - Charcoal Background: #171014
 * - Card Background: #260D17
 * - Deep Burgundy: #851B2B
 * - Crimson: #F06A76
 * - Neon Lime Accent: #D7FF00
 * - Warm White: #FFF4E8
 * - Muted Rose Gray: #C7A5A8
 * - Border: #49202C
 */

export function wrapInNoahLayout({ title, previewText = '', contentHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #171014;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #FFF4E8;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #260D17;
      border: 1px solid #49202C;
      border-radius: 16px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #851B2B 0%, #380C19 100%);
      padding: 32px 24px;
      text-align: center;
      border-bottom: 2px solid #D7FF00;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #FFF4E8;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 11px;
      letter-spacing: 3px;
      color: #D7FF00;
      margin-top: 6px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .body-content {
      padding: 32px 24px;
      line-height: 1.6;
    }
    .info-box {
      background-color: #171014;
      border: 1px solid #49202C;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .highlight-card {
      background: linear-gradient(135deg, rgba(133, 27, 43, 0.3) 0%, rgba(38, 13, 23, 0.8) 100%);
      border: 1px solid #851B2B;
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
    }
    .btn {
      display: inline-block;
      background-color: #D7FF00;
      color: #171014 !important;
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 12px 28px;
      border-radius: 10px;
      text-decoration: none;
      margin: 16px 0;
    }
    .footer {
      background-color: #171014;
      padding: 24px;
      text-align: center;
      font-size: 11px;
      color: #C7A5A8;
      border-top: 1px solid #49202C;
    }
    .footer a {
      color: #D7FF00;
      text-decoration: none;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table.data-table td {
      padding: 8px 0;
      border-bottom: 1px solid #36141F;
      font-size: 13px;
    }
    table.data-table td.label {
      color: #C7A5A8;
      width: 40%;
    }
    table.data-table td.value {
      color: #FFF4E8;
      font-weight: 600;
      text-align: right;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#171014;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${previewText}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          <!-- Header -->
          <div class="header">
            <h1 class="brand-title">NOAH GAMING</h1>
            <div class="brand-tagline">PLAY &bull; CHILL &bull; CONNECT</div>
          </div>
          
          <!-- Body Content -->
          <div class="body-content">
            ${contentHtml}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #FFF4E8;">NOAH GAMING LOUNGE &bull; Premium Esports &amp; Console Arena</p>
            <p style="margin: 0 0 8px 0;">Mumbai &bull; Open Daily 10:00 AM - 11:00 PM IST</p>
            <p style="margin: 0; font-size: 10px; color: #8F7275;">
              This is an automated transactional message. Replies to this address are monitored via Front Desk.
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Welcome Email
 */
export function getWelcomeEmail({ name, email, phone }) {
  const content = `
    <h2 style="color: #FFF4E8; margin-top: 0; font-size: 20px;">Welcome to NOAH GAMING, ${name}!</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Your player profile is active. You can now reserve PS5 and PC gaming rigs, track session receipts, and claim VIP membership passes.
    </p>
    
    <div class="info-box">
      <span style="font-size: 11px; text-transform: uppercase; color: #D7FF00; letter-spacing: 1px; font-weight: 700;">Player Profile Details</span>
      <table class="data-table">
        <tr>
          <td class="label">Name:</td>
          <td class="value">${name}</td>
        </tr>
        <tr>
          <td class="label">Email:</td>
          <td class="value">${email}</td>
        </tr>
        <tr>
          <td class="label">Mobile:</td>
          <td class="value">${phone || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <p style="color: #FFF4E8; font-size: 13px;">
      Ready to play? Book your station online before walk-ins fill up.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}#bookings" class="btn">Book a Station Now &rarr;</a>
    </div>
  `;

  return {
    subject: 'Welcome to NOAH GAMING - Your Lounge Profile is Ready',
    html: wrapInNoahLayout({
      title: 'Welcome to NOAH GAMING',
      previewText: `Welcome to NOAH GAMING! Your player account is now active.`,
      contentHtml: content,
    }),
    text: `Welcome to NOAH GAMING, ${name}!\n\nYour player profile (${email}) is active. Book your gaming station at ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`,
  };
}

/**
 * 2. Booking Confirmation
 */
export function getBookingConfirmationEmail({ booking, customer, device, game }) {
  const amountRupees = Math.round((booking.totalAmount || 0) / 100);
  const paidRupees = Math.round((booking.amountPaid || 0) / 100);
  const balanceRupees = Math.round((booking.balanceRemaining || 0) / 100);

  const content = `
    <h2 style="color: #FFF4E8; margin-top: 0; font-size: 20px;">Booking Confirmed! 🎮</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Hi ${customer?.name || 'Gamer'}, your gaming reservation at NOAH GAMING is confirmed.
    </p>

    <div class="highlight-card">
      <div style="font-size: 11px; color: #D7FF00; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Reservation Pass</div>
      <div style="font-size: 22px; font-weight: 900; color: #FFF4E8; font-family: monospace; margin: 4px 0;">${booking.bookingId}</div>
      <div style="font-size: 12px; color: #C7A5A8;">Present this Booking ID at the front desk upon arrival.</div>
    </div>

    <div class="info-box">
      <table class="data-table">
        <tr>
          <td class="label">Date:</td>
          <td class="value">${booking.bookingDate}</td>
        </tr>
        <tr>
          <td class="label">Time Slot:</td>
          <td class="value">${booking.startTime} (${booking.duration} hr${booking.duration > 1 ? 's' : ''})</td>
        </tr>
        <tr>
          <td class="label">Console / Station:</td>
          <td class="value">${device?.name || 'Assigned Station'} (${device?.deviceCode || ''})</td>
        </tr>
        <tr>
          <td class="label">Game / Title:</td>
          <td class="value">${game?.name || 'Open Library'}</td>
        </tr>
        <tr>
          <td class="label">Players:</td>
          <td class="value">${booking.numberOfPlayers || 1} Player(s)</td>
        </tr>
        <tr>
          <td class="label">Total Amount:</td>
          <td class="value">₹${amountRupees}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid:</td>
          <td class="value" style="color: #D7FF00;">₹${paidRupees}</td>
        </tr>
        ${balanceRupees > 0 ? `
        <tr>
          <td class="label" style="color: #F06A76;">Due at Counter:</td>
          <td class="value" style="color: #F06A76;">₹${balanceRupees}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="font-size: 12px; color: #C7A5A8; line-height: 1.5;">
      &bull; Please arrive 10 minutes prior to your slot time.<br/>
      &bull; Sessions will automatically begin at the scheduled start time.
    </p>
  `;

  return {
    subject: `Booking Confirmed: ${booking.bookingId} on ${booking.bookingDate} at NOAH GAMING`,
    html: wrapInNoahLayout({
      title: 'Booking Confirmed - NOAH GAMING',
      previewText: `Your reservation ${booking.bookingId} for ${booking.bookingDate} @ ${booking.startTime} is confirmed.`,
      contentHtml: content,
    }),
    text: `Booking Confirmed: ${booking.bookingId}\nDate: ${booking.bookingDate} @ ${booking.startTime}\nDevice: ${device?.name || 'Station'}\nTotal: ₹${amountRupees}\nPaid: ₹${paidRupees}`,
  };
}

/**
 * 3. Booking Cancellation
 */
export function getBookingCancellationEmail({ booking, customer, reason }) {
  const content = `
    <h2 style="color: #F06A76; margin-top: 0; font-size: 20px;">Booking Cancelled</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Hi ${customer?.name || 'Gamer'}, reservation <strong>${booking.bookingId}</strong> has been cancelled.
    </p>

    <div class="info-box">
      <table class="data-table">
        <tr>
          <td class="label">Booking ID:</td>
          <td class="value">${booking.bookingId}</td>
        </tr>
        <tr>
          <td class="label">Original Date:</td>
          <td class="value">${booking.bookingDate} @ ${booking.startTime}</td>
        </tr>
        <tr>
          <td class="label">Status:</td>
          <td class="value" style="color: #F06A76;">CANCELLED</td>
        </tr>
        ${reason ? `
        <tr>
          <td class="label">Cancellation Reason:</td>
          <td class="value">${reason}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="color: #C7A5A8; font-size: 13px;">
      If an eligible refund is applicable, it will be credited back via the original payment method within 5-7 business days.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}#bookings" class="btn">Make a New Booking &rarr;</a>
    </div>
  `;

  return {
    subject: `Booking Cancelled: ${booking.bookingId} - NOAH GAMING`,
    html: wrapInNoahLayout({
      title: 'Booking Cancelled - NOAH GAMING',
      previewText: `Your reservation ${booking.bookingId} has been cancelled.`,
      contentHtml: content,
    }),
    text: `Booking Cancelled: ${booking.bookingId}\nDate: ${booking.bookingDate} @ ${booking.startTime}\nReason: ${reason || 'N/A'}`,
  };
}

/**
 * 4. Successful Payment Confirmation (with PDF Receipt Attachment)
 */
export function getPaymentSuccessEmail({ payment, customer, booking, hasAttachment = false }) {
  const amountRupees = Math.round((payment.amountPaise || payment.amount || 0) / 100);

  const content = `
    <h2 style="color: #FFF4E8; margin-top: 0; font-size: 20px;">Payment Verified &amp; Receipt Generated 💳</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Hi ${customer?.name || 'Valued Gamer'}, we have successfully received your payment of 
      <strong style="color: #D7FF00; font-size: 16px;">₹${amountRupees}</strong>.
    </p>

    <div class="highlight-card">
      <div style="font-size: 11px; color: #D7FF00; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Receipt Reference</div>
      <div style="font-size: 20px; font-weight: 900; color: #FFF4E8; font-family: monospace; margin: 4px 0;">${payment.receiptNumber || payment.paymentId}</div>
      <div style="font-size: 12px; color: #C7A5A8;">Status: <span style="color: #D7FF00; font-weight: 700;">PAID &amp; SETTLED</span></div>
    </div>

    <div class="info-box">
      <table class="data-table">
        <tr>
          <td class="label">Payment ID:</td>
          <td class="value">${payment.paymentId}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid:</td>
          <td class="value" style="color: #D7FF00;">₹${amountRupees}</td>
        </tr>
        <tr>
          <td class="label">Method:</td>
          <td class="value">${payment.paymentGateway} &bull; ${payment.paymentMethod}</td>
        </tr>
        <tr>
          <td class="label">Purpose:</td>
          <td class="value">${payment.paymentPurpose}</td>
        </tr>
        ${booking?.bookingId ? `
        <tr>
          <td class="label">Linked Booking:</td>
          <td class="value">${booking.bookingId}</td>
        </tr>` : ''}
        <tr>
          <td class="label">Transaction Date:</td>
          <td class="value">${new Date(payment.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
        </tr>
      </table>
    </div>

    ${hasAttachment ? `
    <div style="background-color: #171014; border: 1px dashed #D7FF00; border-radius: 10px; padding: 12px; text-align: center; margin: 16px 0;">
      <span style="color: #D7FF00; font-weight: 700; font-size: 12px;">📎 Official PDF Receipt Attached to this email</span>
    </div>` : ''}
  `;

  return {
    subject: `Payment Successful: ₹${amountRupees} (Receipt ${payment.receiptNumber || payment.paymentId}) - NOAH GAMING`,
    html: wrapInNoahLayout({
      title: 'Payment Receipt - NOAH GAMING',
      previewText: `Payment of ₹${amountRupees} confirmed. Receipt: ${payment.receiptNumber || payment.paymentId}`,
      contentHtml: content,
    }),
    text: `Payment Receipt: ${payment.receiptNumber || payment.paymentId}\nAmount: ₹${amountRupees}\nMethod: ${payment.paymentGateway}\nStatus: PAID`,
  };
}

/**
 * 5. Membership Activation Confirmation
 */
export function getMembershipActivationEmail({ customer, plan, subscription }) {
  const expiresDateStr = subscription.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'Ongoing';

  const content = `
    <h2 style="color: #FFF4E8; margin-top: 0; font-size: 20px;">VIP Membership Pass Activated! 👑</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Welcome to the club, ${customer?.name || 'VIP Gamer'}! Your <strong>${plan?.name || 'Membership'}</strong> pass is now live.
    </p>

    <div class="highlight-card">
      <div style="font-size: 11px; color: #D7FF00; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Club Membership Pass</div>
      <div style="font-size: 22px; font-weight: 900; color: #FFF4E8; margin: 4px 0;">${plan?.name}</div>
      <div style="font-size: 12px; color: #D7FF00;">Tier: ${plan?.tier || 'VIP'} &bull; Active until ${expiresDateStr}</div>
    </div>

    <div class="info-box">
      <table class="data-table">
        <tr>
          <td class="label">Daily Included Time:</td>
          <td class="value">${plan?.isUnlimited ? 'Unlimited Hours' : `${plan?.dailyUsageLimit || 120} Mins/Day`}</td>
        </tr>
        <tr>
          <td class="label">Pass Validity:</td>
          <td class="value">Expires on ${expiresDateStr}</td>
        </tr>
        <tr>
          <td class="label">Exclusive Games:</td>
          <td class="value">${plan?.includesExclusiveGames ? 'Included (VIP Access)' : 'Standard Access'}</td>
        </tr>
        <tr>
          <td class="label">Pass Subscription ID:</td>
          <td class="value">${subscription._id}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #FFF4E8;">
      Simply mention your phone number or show this pass at the front desk to claim your daily gaming hours!
    </p>
  `;

  return {
    subject: `Membership Activated: ${plan?.name} - NOAH GAMING Club Pass`,
    html: wrapInNoahLayout({
      title: 'Membership Activated - NOAH GAMING',
      previewText: `Your ${plan?.name} pass is active! Enjoy your daily gaming benefits.`,
      contentHtml: content,
    }),
    text: `Membership Pass Activated: ${plan?.name}\nDaily Allowance: ${plan?.isUnlimited ? 'Unlimited' : `${plan?.dailyUsageLimit} mins`}\nValid until: ${expiresDateStr}`,
  };
}

/**
 * 6. Membership Expiry Reminder
 */
export function getMembershipExpiryReminderEmail({ customer, plan, expiresAt, daysRemaining = 3 }) {
  const expiresDateStr = new Date(expiresAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  const content = `
    <h2 style="color: #F06A76; margin-top: 0; font-size: 20px;">Membership Expiring Soon ⏳</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Hi ${customer?.name || 'Gamer'}, your <strong>${plan?.name || 'Club Pass'}</strong> membership will expire in 
      <strong style="color: #F06A76;">${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</strong> on <strong>${expiresDateStr}</strong>.
    </p>

    <div class="info-box">
      <table class="data-table">
        <tr>
          <td class="label">Current Plan:</td>
          <td class="value">${plan?.name}</td>
        </tr>
        <tr>
          <td class="label">Expiry Date:</td>
          <td class="value" style="color: #F06A76;">${expiresDateStr}</td>
        </tr>
        <tr>
          <td class="label">Daily Allowance:</td>
          <td class="value">${plan?.isUnlimited ? 'Unlimited' : `${plan?.dailyUsageLimit} Mins/Day`}</td>
        </tr>
      </table>
    </div>

    <p style="color: #FFF4E8; font-size: 13px;">
      Renew or upgrade online to avoid interruptions in your daily gaming allowances and exclusive lounge perks.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}#passes" class="btn">Renew Pass Online &rarr;</a>
    </div>
  `;

  return {
    subject: `Notice: Your ${plan?.name} Membership Expiring in ${daysRemaining} Days - NOAH GAMING`,
    html: wrapInNoahLayout({
      title: 'Membership Expiry Notice - NOAH GAMING',
      previewText: `Your NOAH GAMING membership pass expires on ${expiresDateStr}. Renew now to keep your benefits.`,
      contentHtml: content,
    }),
    text: `Notice: Your ${plan?.name} membership expires on ${expiresDateStr}. Renew online at ${process.env.CORS_ORIGIN || 'http://localhost:5173'}#passes`,
  };
}

/**
 * 7. Password Reset Request Email
 */
export function getPasswordResetEmail({ name, resetUrl, resetToken, expiresMinutes = 60 }) {
  const content = `
    <h2 style="color: #FFF4E8; margin-top: 0; font-size: 20px;">Password Reset Request 🔐</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Hi ${name || 'Player'}, we received a request to reset your NOAH GAMING account password.
    </p>

    <p style="color: #FFF4E8; font-size: 13px;">
      Click the button below to choose a new password. This secure link is valid for <strong>${expiresMinutes} minutes</strong> and can only be used once.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="btn">Reset Password &rarr;</a>
    </div>

    <div class="info-box">
      <span style="font-size: 11px; text-transform: uppercase; color: #C7A5A8;">Security Verification Token:</span>
      <p style="font-family: monospace; font-size: 14px; color: #D7FF00; margin: 8px 0 0 0; word-break: break-all;">
        ${resetToken}
      </p>
    </div>

    <p style="font-size: 11px; color: #8F7275; line-height: 1.5;">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  `;

  return {
    subject: 'Reset Your NOAH GAMING Password',
    html: wrapInNoahLayout({
      title: 'Reset Password - NOAH GAMING',
      previewText: 'Reset your NOAH GAMING password with this secure link.',
      contentHtml: content,
    }),
    text: `Password Reset Request for NOAH GAMING\n\nReset your password here: ${resetUrl}\n\nToken: ${resetToken}\n(Valid for ${expiresMinutes} minutes)`,
  };
}

/**
 * 8. Password Reset Confirmation Email
 */
export function getPasswordResetConfirmationEmail({ name }) {
  const content = `
    <h2 style="color: #FFF4E8; margin-top: 0; font-size: 20px;">Password Changed Successfully ✅</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Hi ${name || 'Player'}, the password for your NOAH GAMING account has been changed successfully.
    </p>

    <div class="info-box">
      <p style="margin: 0; font-size: 12px; color: #D7FF00;">
        &bull; All previous active browser sessions have been secured.<br/>
        &bull; Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
      </p>
    </div>

    <p style="font-size: 12px; color: #F06A76;">
      If you did not perform this change, please contact NOAH GAMING Front Desk immediately to secure your account.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}" class="btn">Sign In to Your Account &rarr;</a>
    </div>
  `;

  return {
    subject: 'Security Alert: Your NOAH GAMING Password Was Changed',
    html: wrapInNoahLayout({
      title: 'Password Updated - NOAH GAMING',
      previewText: 'Your NOAH GAMING password has been changed successfully.',
      contentHtml: content,
    }),
    text: `Security Alert: Your NOAH GAMING password was changed on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. If you did not make this change, contact support immediately.`,
  };
}

/**
 * 9. Admin Configuration Test Email
 */
export function getTestEmail({ recipient }) {
  const content = `
    <h2 style="color: #D7FF00; margin-top: 0; font-size: 20px;">Resend Configuration Test Passed 🚀</h2>
    <p style="color: #C7A5A8; font-size: 14px;">
      Congratulations! Your transactional email service via <strong>Resend</strong> is properly configured and operational on NOAH GAMING.
    </p>

    <div class="info-box">
      <table class="data-table">
        <tr>
          <td class="label">Provider:</td>
          <td class="value">Resend (Official Node.js SDK)</td>
        </tr>
        <tr>
          <td class="label">Recipient:</td>
          <td class="value">${recipient}</td>
        </tr>
        <tr>
          <td class="label">Sender Address:</td>
          <td class="value">${process.env.EMAIL_FROM || 'Configured via .env'}</td>
        </tr>
        <tr>
          <td class="label">Server Timestamp:</td>
          <td class="value">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #FFF4E8;">
      All automated customer notifications (Bookings, Receipts, Passes, Security Alerts) are ready for live dispatch.
    </p>
  `;

  return {
    subject: 'Test Email: Resend Integration Operational - NOAH GAMING',
    html: wrapInNoahLayout({
      title: 'Resend Email Test - NOAH GAMING',
      previewText: 'Test email confirming your Resend integration is operational.',
      contentHtml: content,
    }),
    text: `Resend Configuration Test Passed for NOAH GAMING.\nRecipient: ${recipient}\nSender: ${process.env.EMAIL_FROM || 'N/A'}\nTimestamp: ${new Date().toISOString()}`,
  };
}

/**
 * 10. Real Email OTP Verification Template
 * Supports:
 * - LOGIN_2FA: Customer Two-Factor Authentication
 * - GUEST_CONVERSION: Guest-to-Registered Account Conversion
 * - EMAIL_VERIFICATION: Customer Profile Email Verification
 * - PASSWORD_RESET: Password Reset Verification
 */
export function getOtpEmail({ name = 'Gamer', otp, purpose = 'LOGIN_2FA', expiresMinutes = 5 }) {
  let title = 'Your Verification Code';
  let badgeText = 'TWO-FACTOR AUTHENTICATION';
  let heading = 'Verify Your Sign-In 🔐';
  let description = 'We detected a sign-in attempt to your NOAH GAMING account. Enter the verification code below to complete two-factor authentication:';
  let subject = `[${otp}] Your NOAH GAMING Login Verification Code`;

  if (purpose === 'GUEST_CONVERSION') {
    title = 'Account Activation Code';
    badgeText = 'PROFILE CONVERSION';
    heading = 'Activate Your Gaming Profile 🎮';
    description = 'You are converting your guest gaming profile into a registered NOAH GAMING account. Enter the verification code below to claim your bookings and receipts:';
    subject = `[${otp}] Your NOAH GAMING Account Activation Code`;
  } else if (purpose === 'PASSWORD_RESET') {
    title = 'Password Reset Code';
    badgeText = 'SECURITY VERIFICATION';
    heading = 'Reset Your Account Password 🔑';
    description = 'We received a request to reset your NOAH GAMING password. Use the verification code below to authorize this change:';
    subject = `[${otp}] Your NOAH GAMING Password Reset Code`;
  } else if (purpose === 'EMAIL_VERIFICATION') {
    title = 'Email Verification Code';
    badgeText = 'ACCOUNT SECURITY';
    heading = 'Verify Your Email Address ✉️';
    description = 'Please verify your email address to secure your NOAH GAMING customer account:';
    subject = `[${otp}] Your NOAH GAMING Email Verification Code`;
  }

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 4px 12px; background-color: rgba(215, 255, 0, 0.12); color: #D7FF00; border: 1px solid rgba(215, 255, 0, 0.3); border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
        ${badgeText}
      </span>
      <h2 style="color: #FFF4E8; margin: 12px 0 8px 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">${heading}</h2>
      <p style="color: #C7A5A8; font-size: 13px; line-height: 1.5; margin: 0 auto; max-width: 440px;">
        Hi <strong>${name}</strong>, ${description}
      </p>
    </div>

    <!-- OTP Display Box -->
    <div style="background: linear-gradient(180deg, #1f0b13 0%, #171014 100%); border: 2px solid #851B2B; border-radius: 16px; padding: 24px 16px; text-align: center; margin: 24px 0; box-shadow: 0 8px 24px rgba(133, 27, 43, 0.25);">
      <div style="font-size: 11px; color: #C7A5A8; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 8px;">
        One-Time Verification Code
      </div>
      <div style="font-family: 'SF Mono', Consolas, Menlo, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #D7FF00; text-shadow: 0 0 16px rgba(215, 255, 0, 0.4); padding: 8px 0;">
        ${otp}
      </div>
      <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #F06A76; font-weight: 600; margin-top: 8px;">
        ⏱️ Code expires in ${expiresMinutes} minutes
      </div>
    </div>

    <div style="background-color: rgba(133, 27, 43, 0.15); border: 1px solid #49202C; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 12px; color: #FFF4E8; line-height: 1.5;">
        🔒 <strong>Security Warning:</strong> NOAH GAMING staff will never ask for your verification code. Never share this code with anyone over phone, WhatsApp, or chat.
      </p>
      <p style="margin: 6px 0 0 0; font-size: 11px; color: #A38084;">
        If you did not request this verification code, please ignore this email or secure your account immediately.
      </p>
    </div>
  `;

  return {
    subject,
    html: wrapInNoahLayout({
      title,
      previewText: `Your NOAH GAMING verification code is ${otp}. Valid for ${expiresMinutes} minutes.`,
      contentHtml: content,
    }),
    text: `NOAH GAMING ${title}\n\nYour verification code is: ${otp}\nThis code will expire in ${expiresMinutes} minutes.\n\nSecurity Notice: NOAH GAMING staff will never ask for your verification code. Do not share it with anyone.`,
  };
}
