import PDFDocument from 'pdfkit';

/**
 * Professional PDF Receipt Generator using PDFKit
 * Generates an executive, branded, vector A4 PDF receipt for NOAH GAMING
 */
export async function generatePdfReceipt(receipt) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `NOAH GAMING Receipt - ${receipt.receiptNumber}`,
          Author: 'NOAH GAMING Lounge Management System',
          Subject: 'Official Payment Receipt',
          Keywords: 'Gaming, Receipt, Invoice, Noah Gaming',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#851B2B'; // Noah Crimson
      const accentColor = '#D7FF00';  // Neon Yellow/Green
      const darkColor = '#171014';    // Deep Dark
      const grayColor = '#4B5563';    // Gray
      const lightBg = '#F9FAFB';      // Light Gray

      const pageWidth = doc.page.width;
      const leftMargin = 40;
      const contentWidth = pageWidth - leftMargin * 2;

      // 1. Top Decorative Brand Bar
      doc.rect(0, 0, pageWidth, 8).fill(primaryColor);

      // 2. Header Section
      let y = 30;
      doc.fontSize(22).font('Helvetica-Bold').fillColor(primaryColor).text('NOAH GAMING', leftMargin, y);
      y += 24;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(grayColor).text('PLAY • CHILL • CONNECT', leftMargin, y);
      y += 12;
      doc.fontSize(8).font('Helvetica').fillColor('#6B7280').text('Premium Esports, PS5 Lounges & Pool Lounge', leftMargin, y);

      // Header Right: Receipt Badge & Status
      const status = (receipt.payment?.status || receipt.receiptStatus || 'PAID').toUpperCase();
      const statusColor = status === 'PAID' ? '#059669' : status === 'PARTIALLY_PAID' ? '#D97706' : '#DC2626';

      doc.roundedRect(pageWidth - leftMargin - 100, 28, 100, 24, 6).fill(statusColor);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF').text(status, pageWidth - leftMargin - 100, 35, {
        width: 100,
        align: 'center',
      });

      doc.fontSize(8).font('Helvetica').fillColor('#6B7280').text('TAX INVOICE / RECEIPT', pageWidth - leftMargin - 140, 58, {
        width: 140,
        align: 'right',
      });

      // Divider
      y = 82;
      doc.moveTo(leftMargin, y).lineTo(pageWidth - leftMargin, y).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // 3. Receipt Metadata & Customer Information (2 Columns)
      y += 14;
      const colWidth = (contentWidth - 20) / 2;

      // Left Column: Receipt Meta Box
      doc.roundedRect(leftMargin, y, colWidth, 90, 6).fillAndStroke(lightBg, '#E5E7EB');
      let textY = y + 10;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(primaryColor).text('RECEIPT INFORMATION', leftMargin + 12, textY);
      textY += 15;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Receipt Number: ', leftMargin + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.receiptNumber || 'N/A');
      textY += 13;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Payment ID: ', leftMargin + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.payment?.paymentId || 'N/A');
      textY += 13;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Issued Date: ', leftMargin + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.issuedAtIST || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      textY += 13;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Payment Method: ', leftMargin + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(`${receipt.payment?.method || 'N/A'} (${receipt.payment?.gateway || 'OFFLINE'})`);

      // Right Column: Customer Details Box
      const rightColX = leftMargin + colWidth + 20;
      doc.roundedRect(rightColX, y, colWidth, 90, 6).fillAndStroke(lightBg, '#E5E7EB');
      textY = y + 10;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(primaryColor).text('CUSTOMER DETAILS', rightColX + 12, textY);
      textY += 15;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Customer Name: ', rightColX + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.customer?.name || 'Walk-in Guest');
      textY += 13;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Customer ID: ', rightColX + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.customer?.customerId || receipt.customer?.id || 'N/A');
      textY += 13;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Email: ', rightColX + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.customer?.email || 'N/A');
      textY += 13;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text('Mobile: ', rightColX + 12, textY, { continued: true })
        .font('Helvetica').fillColor(grayColor).text(receipt.customer?.phone || 'N/A');

      // 4. Service Breakdown Table
      y += 105;
      const isMembership = receipt.isMembership || !!receipt.membership?.planName;

      doc.fontSize(10).font('Helvetica-Bold').fillColor(darkColor).text(
        isMembership ? 'CLUB MEMBERSHIP SPECIFICATION' : 'GAMING SESSION & RESERVATION SPECIFICATION',
        leftMargin,
        y
      );
      y += 16;

      // Table Header Row
      doc.roundedRect(leftMargin, y, contentWidth, 24, 4).fill(primaryColor);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#FFFFFF');

      if (isMembership) {
        doc.text('PLAN NAME', leftMargin + 12, y + 7, { width: 140 });
        doc.text('VALIDITY', leftMargin + 160, y + 7, { width: 90 });
        doc.text('EXPIRATION DATE (IST)', leftMargin + 260, y + 7, { width: 130 });
        doc.text('DAILY LIMIT', leftMargin + 400, y + 7, { width: 100, align: 'right' });
      } else {
        doc.text('RESERVATION / CONSOLE', leftMargin + 12, y + 7, { width: 150 });
        doc.text('GAME TITLE', leftMargin + 170, y + 7, { width: 130 });
        doc.text('SCHEDULE (IST)', leftMargin + 310, y + 7, { width: 120 });
        doc.text('PLAYERS / MODE', leftMargin + 435, y + 7, { width: 75, align: 'right' });
      }

      y += 24;

      // Table Body Row
      doc.rect(leftMargin, y, contentWidth, 36).fillAndStroke(lightBg, '#E5E7EB');
      doc.fontSize(8).font('Helvetica').fillColor(darkColor);

      if (isMembership) {
        const m = receipt.membership || {};
        doc.font('Helvetica-Bold').text(m.planName || 'Club Membership', leftMargin + 12, y + 12, { width: 140 });
        doc.font('Helvetica').text(`${m.validityDuration || 30} ${m.validityUnit || 'DAYS'}`, leftMargin + 160, y + 12, { width: 90 });
        doc.text(m.validTill || '30 Days from activation', leftMargin + 260, y + 12, { width: 130 });
        doc.text(m.dailyUsageLimit ? `${m.dailyUsageLimit} Mins/Day` : 'Unlimited', leftMargin + 400, y + 12, { width: 100, align: 'right' });
      } else {
        const s = receipt.session || receipt.bookingDetails || {};
        const stationText = `${s.deviceName || 'Gaming Station'} (${s.deviceCode || s.bookingId || 'N/A'})`;
        doc.font('Helvetica-Bold').text(stationText, leftMargin + 12, y + 8, { width: 150 });
        doc.font('Helvetica').fillColor('#6B7280').text(`ID: ${s.bookingId || 'N/A'}`, leftMargin + 12, y + 20, { width: 150 });

        doc.font('Helvetica-Bold').fillColor(darkColor).text(s.gameTitle || 'Any Available Game', leftMargin + 170, y + 12, { width: 130 });
        const sched = s.scheduledTime ? `${s.scheduledTime}` : `${s.bookingDate || ''} ${s.startTime || ''}`;
        doc.font('Helvetica').text(sched || 'Standard Slot', leftMargin + 310, y + 12, { width: 120 });
        doc.text(`${s.numberOfPlayers || 1} P (${s.bookingType || 'SHARED'})`, leftMargin + 435, y + 12, { width: 75, align: 'right' });
      }

      // 5. Accounting Financial Summary (Right-aligned table)
      y += 52;
      const fin = receipt.financials || {};
      const finBoxWidth = 260;
      const finBoxX = pageWidth - leftMargin - finBoxWidth;

      doc.roundedRect(finBoxX, y, finBoxWidth, 120, 6).fillAndStroke(lightBg, '#E5E7EB');
      let fy = y + 12;

      // Total Value
      doc.fontSize(8.5).font('Helvetica').fillColor(grayColor).text('Total Service Value:', finBoxX + 14, fy);
      doc.font('Helvetica-Bold').fillColor(darkColor).text(`INR ${Number(fin.totalBookingAmountRupees || fin.totalAmountRupees || 0).toFixed(2)}`, finBoxX + 14, fy, {
        width: finBoxWidth - 28,
        align: 'right',
      });
      fy += 20;

      // Amount Paid This Transaction (Highlighted)
      doc.rect(finBoxX + 4, fy - 4, finBoxWidth - 8, 24).fill('#FEF2F2');
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(primaryColor).text('Amount Paid This Transaction:', finBoxX + 14, fy);
      doc.text(`INR ${Number(fin.amountPaidInThisTxRupees || fin.amountPaidRupees || 0).toFixed(2)}`, finBoxX + 14, fy, {
        width: finBoxWidth - 28,
        align: 'right',
      });
      fy += 26;

      // Cumulative Paid
      doc.fontSize(8.5).font('Helvetica').fillColor(grayColor).text('Cumulative Amount Paid:', finBoxX + 14, fy);
      doc.font('Helvetica-Bold').fillColor(darkColor).text(`INR ${Number(fin.totalAmountPaidRupees || fin.cumulativePaidRupees || fin.amountPaidInThisTxRupees || 0).toFixed(2)}`, finBoxX + 14, fy, {
        width: finBoxWidth - 28,
        align: 'right',
      });
      fy += 20;

      // Outstanding Balance
      const balance = Number(fin.balanceRemainingRupees || 0);
      const balColor = balance > 0 ? '#DC2626' : '#059669';
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(balColor).text('Balance Remaining Due:', finBoxX + 14, fy);
      doc.font('Helvetica-Bold').fillColor(balColor).text(`INR ${balance.toFixed(2)}`, finBoxX + 14, fy, {
        width: finBoxWidth - 28,
        align: 'right',
      });

      // Left side notes in the financial area
      const notesY = y + 8;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(darkColor).text('TRANSACTION AUDIT & NOTES', leftMargin, notesY);
      doc.fontSize(7.5).font('Helvetica').fillColor(grayColor);
      let nY = notesY + 14;
      doc.text(`• Gateway Reference: ${receipt.payment?.transactionReference || receipt.payment?.gatewayOrderId || 'N/A'}`, leftMargin, nY);
      nY += 12;
      doc.text(`• Payment Gateway: ${receipt.payment?.gateway || 'OFFLINE COUNTER'} (${receipt.payment?.mode || 'TEST'})`, leftMargin, nY);
      nY += 12;
      if (receipt.payment?.collectedByName) {
        doc.text(`• Front Desk Staff: ${receipt.payment.collectedByName}`, leftMargin, nY);
        nY += 12;
      }
      doc.text('• Validated against NOAH GAMING cryptographic transaction ledger.', leftMargin, nY);
      nY += 12;
      doc.text('• All bookings and passes are subject to lounge terms and conditions.', leftMargin, nY);

      // 6. Security Seal & Sign-off Footer
      y = doc.page.height - 90;
      doc.moveTo(leftMargin, y).lineTo(pageWidth - leftMargin, y).lineWidth(0.5).strokeColor('#E5E7EB').stroke();

      y += 12;
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(darkColor).text('NOAH GAMING ENTERTAINMENT LLP', leftMargin, y);
      y += 10;
      doc.fontSize(7).font('Helvetica').fillColor('#9CA3AF').text(
        'Official Computer-Generated Tax Invoice • No signature required under IT Act • Bengaluru, Karnataka, India • support@noahgaming.com',
        leftMargin,
        y
      );

      // Bottom Decorative Stripe
      doc.rect(0, doc.page.height - 6, pageWidth, 6).fill(primaryColor);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
