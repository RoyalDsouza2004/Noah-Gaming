import PDFDocument from 'pdfkit';

/**
 * Professional Executive Administrative PDF Report Generator
 * Uses PDFKit to produce multi-page, formatted tabular business reports
 */
export async function generatePdfReport({
  title = 'NOAH GAMING Executive Report',
  subtitle = '',
  summaryCards = [],
  headers = [],
  rows = [],
  dateRangeStr = '',
}) {
  return new Promise((resolve, reject) => {
    try {
      const isWide = headers.length > 5;
      const doc = new PDFDocument({
        size: 'A4',
        layout: isWide ? 'landscape' : 'portrait',
        margin: 36,
        info: {
          Title: title,
          Author: 'NOAH GAMING Lounge Operations',
          Subject: 'Executive Management Report',
        },
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        // Multi-page page numbers
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          const pageWidth = doc.page.width;
          const pageHeight = doc.page.height;

          // Footer line
          doc.moveTo(36, pageHeight - 30).lineTo(pageWidth - 36, pageHeight - 30).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
          doc.fontSize(7.5).font('Helvetica').fillColor('#9CA3AF').text(
            'CONFIDENTIAL • NOAH GAMING Internal Business Operations',
            36,
            pageHeight - 22,
            { width: 300 }
          );
          doc.text(
            `Page ${i + 1} of ${range.count}`,
            pageWidth - 186,
            pageHeight - 22,
            { width: 150, align: 'right' }
          );
        }
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', (err) => reject(err));

      const primaryColor = '#851B2B'; // Crimson
      const accentColor = '#D7FF00';
      const darkColor = '#171014';
      const grayColor = '#4B5563';
      const lightBg = '#F9FAFB';

      const pageWidth = doc.page.width;
      const leftMargin = 36;
      const contentWidth = pageWidth - leftMargin * 2;

      // 1. Top Decorative Stripe
      doc.rect(0, 0, pageWidth, 6).fill(primaryColor);

      // 2. Header
      let y = 24;
      doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text('NOAH GAMING', leftMargin, y);
      y += 18;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(grayColor).text('EXECUTIVE OPERATIONS & ANALYTICS REPORT', leftMargin, y);

      // Header Right (Date & Range)
      const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text(title.toUpperCase(), pageWidth - leftMargin - 300, 24, {
        width: 300,
        align: 'right',
      });
      doc.fontSize(7.5).font('Helvetica').fillColor(grayColor).text(`Generated: ${nowIST} (IST)`, pageWidth - leftMargin - 300, 38, {
        width: 300,
        align: 'right',
      });
      if (dateRangeStr) {
        doc.text(`Period: ${dateRangeStr}`, pageWidth - leftMargin - 300, 50, {
          width: 300,
          align: 'right',
        });
      }

      y = 66;
      doc.moveTo(leftMargin, y).lineTo(pageWidth - leftMargin, y).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // 3. Summary KPI Cards
      y += 10;
      if (summaryCards.length > 0) {
        const cardGap = 10;
        const numCards = Math.min(summaryCards.length, 5);
        const cardWidth = (contentWidth - cardGap * (numCards - 1)) / numCards;

        summaryCards.slice(0, 5).forEach((card, idx) => {
          const cx = leftMargin + idx * (cardWidth + cardGap);
          doc.roundedRect(cx, y, cardWidth, 44, 4).fillAndStroke(lightBg, '#E5E7EB');
          doc.fontSize(7).font('Helvetica-Bold').fillColor(grayColor).text(card.label.toUpperCase(), cx + 8, y + 8, {
            width: cardWidth - 16,
            ellipsis: true,
          });
          doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor).text(String(card.value), cx + 8, y + 22, {
            width: cardWidth - 16,
            ellipsis: true,
          });
        });
        y += 54;
      }

      // 4. Tabular Data Section
      const totalColWidth = contentWidth;
      const colW = totalColWidth / headers.length;

      // Table Header Row
      doc.roundedRect(leftMargin, y, totalColWidth, 22, 3).fill(primaryColor);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
      headers.forEach((h, i) => {
        const hAlign = h.type === 'currency' || h.type === 'number' ? 'right' : 'left';
        doc.text(h.label, leftMargin + i * colW + 6, y + 6, {
          width: colW - 12,
          align: hAlign,
          ellipsis: true,
        });
      });
      y += 22;

      // Table Data Rows
      const rowHeight = 18;
      const maxY = doc.page.height - 45;

      rows.forEach((row, rowIndex) => {
        // Page break check
        if (y + rowHeight > maxY) {
          doc.addPage();
          doc.rect(0, 0, pageWidth, 6).fill(primaryColor);
          y = 30;

          // Repeat Header on new page
          doc.roundedRect(leftMargin, y, totalColWidth, 22, 3).fill(primaryColor);
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
          headers.forEach((h, i) => {
            const hAlign = h.type === 'currency' || h.type === 'number' ? 'right' : 'left';
            doc.text(h.label, leftMargin + i * colW + 6, y + 6, {
              width: colW - 12,
              align: hAlign,
              ellipsis: true,
            });
          });
          y += 22;
        }

        const isEven = rowIndex % 2 === 0;
        doc.rect(leftMargin, y, totalColWidth, rowHeight).fillAndStroke(isEven ? '#FFFFFF' : lightBg, '#F3F4F6');
        doc.fontSize(7).font('Helvetica').fillColor(darkColor);

        headers.forEach((h, i) => {
          let val = row[h.key];
          if (val === null || val === undefined) val = '-';
          else if (h.type === 'currency' && typeof val === 'number') {
            val = `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          } else if (h.type === 'number' && typeof val === 'number') {
            val = val.toLocaleString('en-IN');
          } else {
            val = String(val);
          }

          const cAlign = h.type === 'currency' || h.type === 'number' ? 'right' : 'left';
          doc.text(val, leftMargin + i * colW + 6, y + 5, {
            width: colW - 12,
            align: cAlign,
            ellipsis: true,
          });
        });

        y += rowHeight;
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
