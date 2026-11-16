import { formatISTDate, formatISTTime } from './timeSlots.js';

/**
 * Format Date to full IST string (e.g. "15 Nov 2026, 08:30:15 pm IST")
 */
function formatISTDateTimeFull(date) {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d) + ' IST'
  );
}

/**
 * Generates authoritative receipt payload and printable HTML representation
 * for both Booking sessions and Membership transactions.
 *
 * @param {Object} options
 * @param {Object} options.payment - Populated Payment document
 * @param {Object} [options.booking] - Populated Booking document
 * @param {Object} options.customer - Customer User document
 * @param {Object} [options.session] - Associated GamingSession document
 * @param {Object} [options.financialsOverride] - Precise calculated financials (paise)
 * @returns {Object} { receiptData, html }
 */
export function generateReceipt({
  payment,
  booking = null,
  customer = null,
  session = null,
  financialsOverride = null,
}) {
  const loungeName = 'NOAH GAMING';
  const loungeTagline = 'PLAY • CHILL • CONNECT';
  const loungeAddress = 'Sector 18, Commercial Hub, Gaming District, India';
  const contactPhone = '+91 98765 43210';
  const contactEmail = 'support@noahgaming.com';

  const receiptNumber =
    payment.receiptNumber ||
    `REC-${formatISTDate(payment.paidAt || payment.createdAt || new Date()).replace(/-/g, '')}-${Math.floor(
      10000 + Math.random() * 90000
    )}`;

  const isMembership =
    !booking &&
    Boolean(
      payment.membershipPlan ||
      payment.membershipSubscription ||
      (payment.paymentPurpose && payment.paymentPurpose.startsWith('MEMBERSHIP'))
    );

  // Financial calculations using integer paise
  let totalBookingAmountPaise = payment.amount || 0;
  let amountPaidInThisTxPaise = payment.amount || 0;
  let cumulativePaidPaise = payment.amount || 0;
  let balanceRemainingPaise = 0;

  if (financialsOverride) {
    totalBookingAmountPaise = financialsOverride.totalBookingAmountPaise ?? (booking?.totalAmount || payment.amount);
    cumulativePaidPaise = financialsOverride.cumulativePaidPaise ?? payment.amount;
    balanceRemainingPaise = financialsOverride.balanceRemainingPaise ?? Math.max(0, totalBookingAmountPaise - cumulativePaidPaise);
  } else if (booking) {
    totalBookingAmountPaise = booking.totalAmount || payment.amount;
    cumulativePaidPaise = booking.amountPaid || payment.amount;
    balanceRemainingPaise = Math.max(0, totalBookingAmountPaise - cumulativePaidPaise);
  }

  const totalBookingAmountRupees = totalBookingAmountPaise / 100;
  const amountPaidInThisTxRupees = amountPaidInThisTxPaise / 100;
  const totalAmountPaidRupees = cumulativePaidPaise / 100;
  const balanceRemainingRupees = balanceRemainingPaise / 100;
  const advanceAmountRupees = (booking?.advanceAmount || 0) / 100;

  const paymentDateIST = formatISTDateTimeFull(payment.paidAt || payment.createdAt);

  // Determine Game Name
  let gameTitle = 'General Lounge Gaming';
  if (booking?.game?.name) {
    gameTitle = booking.game.name;
    if (booking.game.isExclusive) {
      gameTitle += ' (Exclusive)';
    }
  } else if (payment.paymentPurpose === 'GTA6_ADVANCE') {
    gameTitle = 'Grand Theft Auto VI (Exclusive VIP Reservation)';
  } else if (isMembership) {
    gameTitle = 'All Lounge Titles Included';
  }

  // Determine Device Name
  let deviceName = 'PS5 Station';
  let deviceType = 'PS5';
  if (booking?.device?.name) {
    deviceName = booking.device.name;
    deviceType = booking.device.deviceType || booking.device.deviceCode || 'PS5';
  } else if (isMembership) {
    deviceName = 'Lounge-Wide Membership Access';
    deviceType = 'ALL_STATIONS';
  }

  // Determine Pricing Scheme
  let rateScheme = 'Standard Hourly Rate';
  let ratePerUnitRupees = 0;
  if (booking?.pricingSnapshot?.planName) {
    rateScheme = booking.pricingSnapshot.planName;
    ratePerUnitRupees = booking.pricingSnapshot.ratePerUnitRupees || (booking.pricingSnapshot.ratePerUnitPaise ? booking.pricingSnapshot.ratePerUnitPaise / 100 : 0);
  } else if (booking?.pricingSnapshot?.billingType) {
    rateScheme = `${booking.pricingSnapshot.billingType} Pricing`;
    ratePerUnitRupees = booking.pricingSnapshot.ratePerUnitRupees || 0;
  } else if (booking?.pricePerPlayer) {
    ratePerUnitRupees = booking.pricePerPlayer / 100;
    rateScheme = `Per Player Rate (₹${ratePerUnitRupees}/hr)`;
  } else if (isMembership) {
    rateScheme = payment.membershipPlan?.name || 'Club Membership Plan';
    ratePerUnitRupees = (payment.membershipPlan?.price || payment.amount) / 100;
  }

  // Processed By
  let processedBy = 'System Gateway';
  if (payment.collectedBy?.name) {
    processedBy = `${payment.collectedBy.name} (${payment.collectedBy.role || 'Staff'})`;
  } else if (payment.paymentGateway === 'RAZORPAY') {
    processedBy = 'Razorpay Test Mode Gateway';
  } else if (payment.paymentGateway === 'OFFLINE_CASH') {
    processedBy = 'Front Desk Cash Counter';
  } else if (payment.paymentGateway === 'OFFLINE_COUNTER_UPI') {
    processedBy = 'Front Desk QR Counter';
  }

  // Structured JSON data object
  const receiptData = {
    loungeName,
    loungeTagline,
    loungeAddress,
    contactPhone,
    contactEmail,
    receiptNumber,
    issuedAtIST: paymentDateIST,
    paymentDate: payment.paidAt
      ? payment.paidAt.toISOString()
      : (payment.createdAt ? payment.createdAt.toISOString() : new Date().toISOString()),
    paymentId: payment.paymentId,
    transactionId: payment.gatewayPaymentId || payment.transactionReference || payment.paymentId,
    bookingId: booking?.bookingId || (isMembership ? 'N/A' : 'N/A'),

    customer: {
      id: customer?._id,
      customerId: customer?.customerId || (customer?._id ? `CUST-${customer._id.toString().slice(-8).toUpperCase()}` : 'CUST-WALKIN'),
      name: customer?.name || 'Walk-In Player',
      email: customer?.email || 'N/A',
      phone: customer?.phone || 'N/A',
    },

    payment: {
      paymentId: payment.paymentId,
      receiptNumber,
      method: payment.paymentMethod || 'UPI',
      gateway: payment.paymentGateway || 'RAZORPAY',
      status: payment.paymentStatus || 'PAID',
      purpose: payment.paymentPurpose || 'BOOKING_FULL',
      gatewayPaymentId: payment.gatewayPaymentId || 'N/A',
      gatewayOrderId: payment.gatewayOrderId || 'N/A',
      transactionReference: payment.transactionReference || 'N/A',
      processedBy,
      paidAtIST: paymentDateIST,
    },

    isMembership,

    session: {
      bookingId: booking?.bookingId || (isMembership ? 'N/A' : 'N/A'),
      sessionId: session?._id ? session._id.toString() : 'N/A',
      deviceName,
      deviceType,
      gameTitle,
      bookingDate: booking?.bookingDate || 'N/A',
      startTime: booking?.startTime || 'N/A',
      endTime: booking?.endTime || 'N/A',
      timeSlot: booking ? `${booking.startTime} - ${booking.endTime}` : (isMembership ? 'Valid Across Lounge Hours' : 'N/A'),
      durationHours: booking?.duration || (isMembership ? 'N/A' : 1),
      numberOfPlayers: booking?.numberOfPlayers || (isMembership ? 'N/A' : 1),
      bookingType: booking?.bookingType || (isMembership ? 'MEMBERSHIP' : 'SHARED'),
      rateScheme,
      ratePerUnitRupees,
    },

    membership: isMembership ? {
      planName: payment.membershipPlan?.name || 'Club Membership',
      validityDuration: payment.membershipPlan?.validityDuration || 30,
      validityUnit: payment.membershipPlan?.validityUnit || 'DAYS',
      isUnlimited: Boolean(payment.membershipPlan?.isUnlimited),
      priceRupees: (payment.membershipPlan?.price || payment.amount) / 100,
    } : null,

    financials: {
      currency: payment.currency || 'INR',
      // Primary Rupee metrics expected by ReceiptModal.jsx
      totalBookingAmountRupees,
      amountPaidInThisTxRupees,
      totalAmountPaidRupees,
      balanceRemainingRupees,
      // Legacy metrics for backward compatibility
      totalBookingAmount: totalBookingAmountRupees,
      advanceAmount: advanceAmountRupees,
      amountPaidThisTransaction: amountPaidInThisTxRupees,
      remainingBalance: balanceRemainingRupees,
      // Exact Integer Paise metrics
      totalBookingAmountPaise,
      amountPaidInThisTxPaise,
      cumulativePaidPaise,
      balanceRemainingPaise,
      // Status
      paymentMethod: payment.paymentMethod || 'UPI',
      paymentGateway: payment.paymentGateway || 'RAZORPAY',
      paymentStatus: payment.paymentStatus || 'PAID',
      paymentPurpose: payment.paymentPurpose || 'BOOKING_FULL',
    },

    // Legacy bookingDetails object for any existing downstream consumers
    bookingDetails: {
      device: deviceName,
      deviceCode: deviceType,
      game: gameTitle,
      bookingDate: booking?.bookingDate || 'N/A',
      timeSlot: booking ? `${booking.startTime} - ${booking.endTime}` : 'N/A',
      durationHours: booking?.duration || 1,
      numberOfPlayers: booking?.numberOfPlayers || 1,
      bookingType: booking?.bookingType || 'SHARED',
    },
  };

  // High-fidelity printable HTML with NOAH GAMING styling
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${receiptNumber} | ${loungeName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f0a0d;
      color: #FFF4E8;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .receipt-wrapper {
      max-width: 680px;
      margin: 0 auto;
      background: #1c0b12;
      border: 1px solid #49202C;
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #49202C;
      padding-bottom: 20px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      color: #FFF4E8;
      letter-spacing: 1.5px;
    }
    .brand-tagline {
      font-size: 10px;
      font-weight: 800;
      color: #F5B942;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .brand-address {
      font-size: 11px;
      color: #C7A5A8;
      margin-top: 4px;
    }
    .badge-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: rgba(69, 201, 135, 0.15);
      color: #45C987;
      border: 1px solid rgba(69, 201, 135, 0.35);
    }
    .receipt-no {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #D7FF00;
      margin-top: 6px;
      text-align: right;
    }
    .issue-time {
      font-size: 10px;
      color: #C7A5A8;
      text-align: right;
      margin-top: 2px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #F5B942;
      margin-bottom: 8px;
    }
    .grid-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #14070c;
      border: 1px solid #3d141f;
      border-radius: 12px;
      padding: 16px;
      margin: 18px 0;
      font-size: 12px;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #C7A5A8;
      margin-bottom: 2px;
    }
    .field-value {
      font-weight: 600;
      color: #FFFFFF;
    }
    .field-value-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #FFF4E8;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      background: #14070c;
      border: 1px solid #3d141f;
      border-radius: 12px;
      overflow: hidden;
      font-size: 12px;
    }
    .spec-table th {
      background: #260D17;
      color: #C7A5A8;
      text-transform: uppercase;
      font-size: 10px;
      font-weight: 700;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #49202C;
    }
    .spec-table td {
      padding: 12px 14px;
      border-top: 1px solid #2d101a;
      color: #FFF4E8;
    }
    .fin-box {
      background: #14070c;
      border: 1px solid #49202C;
      border-radius: 14px;
      padding: 18px;
      margin-top: 18px;
      font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .fin-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      color: #C7A5A8;
    }
    .fin-highlight {
      border-top: 1px solid #49202C;
      border-bottom: 1px solid #49202C;
      padding: 10px 0;
      margin: 10px 0;
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 800;
    }
    .fin-paid-badge {
      color: #45C987;
      font-size: 16px;
      font-weight: 900;
    }
    .footer {
      text-align: center;
      margin-top: 26px;
      padding-top: 18px;
      border-top: 1px solid #3d141f;
      font-size: 11px;
      color: #C7A5A8;
    }
    .print-actions {
      text-align: center;
      margin-top: 20px;
    }
    .btn-print {
      background: #D7FF00;
      color: #171014;
      border: none;
      padding: 10px 22px;
      font-size: 12px;
      font-weight: 800;
      border-radius: 10px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 4px 14px rgba(215, 255, 0, 0.3);
    }
    .btn-print:hover { background: #c5ee00; }
    @media print {
      body { background: white !important; color: black !important; padding: 0 !important; }
      .receipt-wrapper {
        border: 1px solid #333 !important;
        box-shadow: none !important;
        background: white !important;
        color: black !important;
        padding: 24px !important;
        max-width: 100% !important;
      }
      .header { border-bottom: 2px solid #000 !important; }
      .brand-title { color: #000 !important; }
      .brand-tagline { color: #333 !important; }
      .brand-address { color: #555 !important; }
      .badge-status { border: 1px solid #000 !important; color: #000 !important; background: none !important; }
      .receipt-no { color: #000 !important; }
      .issue-time { color: #444 !important; }
      .section-title { color: #000 !important; }
      .grid-box { background: #fafafa !important; border-color: #ccc !important; }
      .field-label { color: #666 !important; }
      .field-value, .field-value-mono { color: #000 !important; }
      .spec-table { background: white !important; border-color: #ccc !important; }
      .spec-table th { background: #eee !important; color: #000 !important; border-color: #ccc !important; }
      .spec-table td { border-color: #eee !important; color: #000 !important; }
      .fin-box { background: #fafafa !important; border-color: #ccc !important; color: #000 !important; }
      .fin-row { color: #333 !important; }
      .fin-highlight { border-color: #999 !important; color: #000 !important; }
      .fin-paid-badge { color: #000 !important; }
      .footer { border-color: #ccc !important; color: #666 !important; }
      .print-actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt-wrapper">
    <div class="header">
      <div>
        <div class="brand-title">${loungeName}</div>
        <div class="brand-tagline">${loungeTagline}</div>
        <div class="brand-address">${loungeAddress}</div>
        <div class="brand-address">Phone: ${contactPhone} • Email: ${contactEmail}</div>
      </div>
      <div>
        <div style="text-align: right;">
          <span class="badge-status">${payment.paymentStatus || 'PAID'}</span>
        </div>
        <div class="receipt-no">${receiptNumber}</div>
        <div class="issue-time">${paymentDateIST}</div>
      </div>
    </div>

    <!-- Customer & Transaction Information -->
    <div class="grid-box">
      <div>
        <div class="field-label">Customer Information</div>
        <div class="field-value">${customer?.name || 'Walk-In Player'}</div>
        <div class="field-value-mono" style="font-size: 11px; color: #C7A5A8;">${receiptData.customer.customerId}</div>
        <div style="font-size: 11px; color: #C7A5A8; margin-top: 2px;">
          ${customer?.email && customer.email !== 'N/A' ? customer.email : ''} ${customer?.phone && customer.phone !== 'N/A' ? '• ' + customer.phone : ''}
        </div>
      </div>
      <div>
        <div class="field-label">Transaction Reference</div>
        <div class="field-value-mono">${payment.paymentId}</div>
        <div style="font-size: 11px; color: #C7A5A8; margin-top: 2px;">
          Ref: ${payment.gatewayPaymentId || payment.transactionReference || 'N/A'}
        </div>
        <div style="font-size: 11px; color: #D7FF00; margin-top: 2px;">
          Processed: ${processedBy}
        </div>
      </div>
    </div>

    <!-- Session Specification or Membership Details -->
    <div>
      <div class="section-title">${isMembership ? 'Membership Specification' : 'Session Specification'}</div>
      <table class="spec-table">
        <thead>
          <tr>
            <th>${isMembership ? 'Plan & Benefit' : 'Station & Title'}</th>
            <th>${isMembership ? 'Validity Period' : 'Schedule (IST)'}</th>
            <th style="text-align: right;">${isMembership ? 'Access Type' : 'Mode & Players'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong style="color: #FFFFFF;">${isMembership ? (payment.membershipPlan?.name || 'Club Membership') : deviceName}</strong>
              <div style="font-size: 11px; color: #D7FF00; margin-top: 2px;">
                ${isMembership ? 'Lounge-Wide Membership Benefit' : gameTitle}
              </div>
            </td>
            <td>
              ${isMembership ? `${receiptData.membership?.validityDuration} ${receiptData.membership?.validityUnit}` : `${booking?.bookingDate || 'N/A'}<br><span style="font-size: 11px; color: #C7A5A8;">${booking ? `${booking.startTime} - ${booking.endTime} (${booking.duration}h)` : 'N/A'}</span>`}
            </td>
            <td style="text-align: right;">
              ${isMembership ? (receiptData.membership?.isUnlimited ? 'Unlimited Play' : 'Standard Member') : `${booking?.bookingType || 'SHARED'}<br><span style="font-size: 11px; color: #C7A5A8;">${booking?.numberOfPlayers || 1} Player(s)</span>`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Financial Breakdown -->
    <div class="fin-box">
      <div class="fin-row">
        <span>Total ${isMembership ? 'Membership Fee' : 'Booking Amount'}:</span>
        <span style="color: #FFFFFF;">₹${totalBookingAmountRupees.toFixed(2)}</span>
      </div>

      <div class="fin-row fin-highlight">
        <span>Amount Paid in This Transaction (${payment.paymentPurpose}):</span>
        <span class="fin-paid-badge">₹${amountPaidInThisTxRupees.toFixed(2)}</span>
      </div>

      <div class="fin-row">
        <span>Payment Method / Gateway:</span>
        <span style="color: #FFFFFF;">${payment.paymentMethod} (${payment.paymentGateway})</span>
      </div>

      <div class="fin-row">
        <span>Cumulative Amount Paid to Date:</span>
        <span style="color: #45C987; font-weight: 700;">₹${totalAmountPaidRupees.toFixed(2)}</span>
      </div>

      <div class="fin-row">
        <span>Outstanding Balance:</span>
        <span style="color: ${balanceRemainingRupees > 0 ? '#F5B942' : '#45C987'}; font-weight: 700;">
          ₹${balanceRemainingRupees.toFixed(2)} ${balanceRemainingRupees > 0 ? '(Pending)' : '(Settled)'}
        </span>
      </div>
    </div>

    <div class="footer">
      <div>Thank you for gaming at ${loungeName}! Play fair, play hard.</div>
      <div style="margin-top: 4px; font-size: 10px; color: #851B2B;">
        Official Computer-Generated Tax & Transaction Receipt • Valid Without Physical Signature
      </div>
    </div>

    <div class="print-actions">
      <button class="btn-print" onclick="window.print()">Print / Download PDF</button>
    </div>
  </div>
</body>
</html>`;

  return { receiptData, html };
}
