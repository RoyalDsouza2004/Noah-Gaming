import ExcelJS from 'exceljs';

/**
 * Professional Excel Workbook Generation Service using ExcelJS
 * Features:
 * - Real .xlsx binary generation (NOT SpreadsheetML XML)
 * - Styled brand headers (#851B2B crimson with white bold text)
 * - Alternating zebra stripes for readability
 * - Auto-adjusted column widths
 * - Auto-filter on header rows
 * - Frozen header row
 * - Formatted INR currency, integers, and IST dates
 */
export async function createExcelWorkbook({ title = 'NOAH_GAMING_Report', sheets = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NOAH GAMING Lounge Management System';
  workbook.lastModifiedBy = 'Administrator';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const sheetDef of sheets) {
    const rawName = sheetDef.name || 'Report';
    // Excel sheet name max 31 characters and cannot contain: \ / ? * : [ ]
    const sanitizedName = rawName.replace(/[\\/?*:[\]]/g, '_').slice(0, 31);
    const worksheet = workbook.addWorksheet(sanitizedName, {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
      properties: { tabColor: { argb: 'FF851B2B' } },
    });

    const headers = sheetDef.headers || [];
    const rows = sheetDef.rows || [];

    // Setup columns with headers and calculated widths
    worksheet.columns = headers.map((h) => {
      let maxContentLen = h.label ? h.label.length : 10;
      for (const row of rows.slice(0, 100)) {
        const val = row[h.key];
        if (val !== undefined && val !== null) {
          const strLen = String(val).length;
          if (strLen > maxContentLen) maxContentLen = strLen;
        }
      }
      return {
        header: h.label,
        key: h.key,
        width: Math.min(Math.max(maxContentLen + 4, h.width || 12), 45),
      };
    });

    // Style Header Row (Row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF851B2B' }, // Noah Crimson
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF49202C' } },
        bottom: { style: 'medium', color: { argb: 'FFD7FF00' } }, // Accent line
        left: { style: 'thin', color: { argb: 'FF49202C' } },
        right: { style: 'thin', color: { argb: 'FF49202C' } },
      };
    });

    // Add Data Rows
    rows.forEach((row, rowIndex) => {
      const addedRow = worksheet.addRow(row);
      addedRow.height = 20;

      const isEven = rowIndex % 2 === 0;
      addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = headers[colNumber - 1];
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: 'FF171014' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: h?.align || (h?.type === 'currency' || h?.type === 'number' ? 'right' : 'left'),
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        // Zebra striping
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }

        // Cell number formatting
        if (h?.type === 'currency') {
          cell.numFmt = '[$₹-4009] #,##0.00;([$₹-4009] #,##0.00);"-"';
        } else if (h?.type === 'number') {
          cell.numFmt = '#,##0';
        } else if (h?.type === 'percent') {
          cell.numFmt = '0.0%';
        }
      });
    });

    // Enable AutoFilter on tabular data
    if (headers.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rows.length + 1, column: headers.length },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
