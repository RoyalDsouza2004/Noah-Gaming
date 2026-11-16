import {
  getRevenueAnalytics,
  getRevenueByDevice,
  getRevenueByGame,
  getBookingAnalytics,
  getDeviceUtilization,
  getGamePerformance,
  getCustomerAnalytics,
  getMembershipAnalytics,
  getReceptionistPerformance,
  getMaintenanceAnalytics,
  getFinancialPaymentReports,
  getISTDateRange,
} from './analytics.service.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import DeviceMaintenance from '../models/DeviceMaintenance.js';
import GamingSession from '../models/GamingSession.js';
import { createExcelWorkbook } from './excelExport.service.js';
import { generatePdfReport } from './pdfReport.service.js';
import { formatISTDate } from '../utils/timeSlots.js';

/**
 * Converts tabular rows and columns into RFC-4180 compliant CSV string with UTF-8 BOM.
 */
function toCSV(headers, rows) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map((h) => escapeCell(h.label)).join(',');
  const rowLines = rows.map((row) =>
    headers.map((h) => escapeCell(row[h.key])).join(',')
  );

  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Generates an executive print-ready HTML view for in-browser printing.
 */
function toPrintableHTML(title, subtitle, headers, rows, summaryCards = []) {
  const cardsHtml = summaryCards
    .map(
      (c) => `
    <div style="flex:1; min-width:180px; padding:12px; background:#111827; border:1px solid #1f2937; border-radius:8px;">
      <div style="font-size:12px; color:#9ca3af; text-transform:uppercase;">${c.label}</div>
      <div style="font-size:20px; font-weight:bold; color:#D7FF00; margin-top:4px;">${c.value}</div>
    </div>`
    )
    .join('');

  const tableHeaders = headers
    .map(
      (h) =>
        `<th style="padding:10px 12px; text-align:left; background:#111827; color:#D7FF00; font-size:12px; text-transform:uppercase; border-bottom:2px solid #851B2B;">${h.label}</th>`
    )
    .join('');

  const tableRows = rows
    .map(
      (r, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#171014' : '#260D17'};">
      ${headers
        .map(
          (h) =>
            `<td style="padding:8px 12px; font-size:13px; color:#FFF4E8; border-bottom:1px solid #49202C;">${r[h.key] ?? 'N/A'}</td>`
        )
        .join('')}
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} | NOAH GAMING</title>
  <style>
    @media print {
      body { background: #fff !important; color: #000 !important; }
      .no-print { display: none !important; }
      table { width: 100% !important; border-collapse: collapse !important; }
      th, td { border: 1px solid #ccc !important; color: #000 !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #171014;
      color: #FFF4E8;
      margin: 0;
      padding: 32px;
    }
  </style>
</head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #851B2B; padding-bottom:16px;">
    <div>
      <h1 style="margin:0; font-size:24px; color:#FFF4E8;">NOAH GAMING</h1>
      <p style="margin:4px 0 0; color:#D7FF00; font-size:14px; font-weight:bold;">${title}</p>
      ${subtitle ? `<p style="margin:4px 0 0; color:#9ca3af; font-size:12px;">${subtitle}</p>` : ''}
    </div>
    <div class="no-print">
      <button onclick="window.print()" style="background:#D7FF00; color:#171014; font-weight:bold; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
        Print / Save PDF
      </button>
    </div>
  </div>

  ${summaryCards.length > 0 ? `<div style="display:flex; gap:16px; margin:24px 0; flex-wrap:wrap;">${cardsHtml}</div>` : ''}

  <div style="margin-top:24px; overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; text-align:left;">
      <thead><tr>${tableHeaders}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Resolves a single report dataset by name
 */
export async function generateReportData(reportType, query = {}) {
  const { range = '30d', startDate, endDate } = query;

  switch (reportType.toLowerCase()) {
    case 'revenue':
    case 'daily_revenue':
    case 'monthly_revenue':
    case 'yearly_revenue': {
      const revenueData = await getRevenueAnalytics({ range, startDate, endDate });
      const headers = [
        { key: 'date', label: 'Date (IST)' },
        { key: 'grossRupees', label: 'Gross Collections (₹)', type: 'currency' },
        { key: 'refundsRupees', label: 'Refunds (₹)', type: 'currency' },
        { key: 'netRupees', label: 'Net Collections (₹)', type: 'currency' },
        { key: 'transactions', label: 'Transactions', type: 'number' },
      ];
      const rows = (revenueData.trends || []).map((t) => ({
        date: t.date,
        grossRupees: t.grossRupees,
        refundsRupees: t.refundsRupees,
        netRupees: t.netRupees,
        transactions: t.transactions,
      }));
      const summaryCards = [
        { label: 'Gross Collections', value: `₹${revenueData.grossCollectionsRupees.toFixed(2)}` },
        { label: 'Total Refunds', value: `₹${revenueData.totalRefundsRupees.toFixed(2)}` },
        { label: 'Net Collections', value: `₹${revenueData.netCollectionsRupees.toFixed(2)}` },
        { label: 'Membership Revenue', value: `₹${revenueData.membershipRevenue?.totalRupees?.toFixed(2) || '0.00'}` },
      ];
      return {
        title: 'Revenue Analytics Report',
        sheetName: 'Revenue Summary',
        subtitle: `Date Range: ${revenueData.dateRange?.start || ''} to ${revenueData.dateRange?.end || ''}`,
        headers,
        rows,
        summaryCards,
      };
    }

    case 'bookings':
    case 'booking': {
      const { startISTStr, endISTStr } = getISTDateRange(range, startDate, endDate);
      const filter = {
        bookingDate: { $gte: startISTStr, $lte: endISTStr },
      };
      if (query.status && query.status !== 'all') {
        filter.bookingStatus = query.status.toUpperCase();
      }

      const bookings = await Booking.find(filter)
        .populate('customer', 'name email phone')
        .populate('device', 'name deviceCode deviceType')
        .populate('game', 'name')
        .sort({ startAt: -1, createdAt: -1 })
        .lean();

      const headers = [
        { key: 'bookingId', label: 'Booking ID' },
        { key: 'customerName', label: 'Customer' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'customerEmail', label: 'Email' },
        { key: 'device', label: 'Station / Console' },
        { key: 'game', label: 'Game Title' },
        { key: 'bookingDate', label: 'Date (IST)' },
        { key: 'timeSlot', label: 'Time Slot' },
        { key: 'duration', label: 'Duration (Hrs)', type: 'number' },
        { key: 'bookingType', label: 'Mode' },
        { key: 'numberOfPlayers', label: 'Players', type: 'number' },
        { key: 'totalRupees', label: 'Total Value (₹)', type: 'currency' },
        { key: 'paidRupees', label: 'Amount Paid (₹)', type: 'currency' },
        { key: 'balanceRupees', label: 'Balance Due (₹)', type: 'currency' },
        { key: 'paymentStatus', label: 'Payment Status' },
        { key: 'bookingStatus', label: 'Reservation Status' },
        { key: 'source', label: 'Channel' },
      ];

      const rows = bookings.map((b) => ({
        bookingId: b.bookingId,
        customerName: b.customer?.name || 'Walk-in Guest',
        customerPhone: b.customer?.phone || 'N/A',
        customerEmail: b.customer?.email || 'N/A',
        device: b.device ? `${b.device.name} (${b.device.deviceCode})` : 'N/A',
        game: b.game?.name || 'Pool / Free Play',
        bookingDate: b.bookingDate,
        timeSlot: `${b.startTime} - ${b.endTime}`,
        duration: b.duration,
        bookingType: b.bookingType || 'SHARED',
        numberOfPlayers: b.numberOfPlayers || 1,
        totalRupees: (b.totalAmount || 0) / 100,
        paidRupees: (b.amountPaid || 0) / 100,
        balanceRupees: (b.balanceRemaining || 0) / 100,
        paymentStatus: b.paymentStatus || 'UNPAID',
        bookingStatus: b.bookingStatus,
        source: b.isWalkIn ? 'Walk-in' : 'Online',
      }));

      const summaryCards = [
        { label: 'Total Bookings', value: rows.length },
        { label: 'Confirmed', value: rows.filter((r) => r.bookingStatus === 'CONFIRMED').length },
        { label: 'Completed', value: rows.filter((r) => r.bookingStatus === 'COMPLETED').length },
        { label: 'Cancelled', value: rows.filter((r) => r.bookingStatus === 'CANCELLED').length },
      ];

      return {
        title: 'Booking Activity & Reservations Report',
        sheetName: 'Bookings',
        subtitle: `Period: ${startISTStr} to ${endISTStr}`,
        headers,
        rows,
        summaryCards,
      };
    }

    case 'devices':
    case 'device':
    case 'device_utilization': {
      const utilData = await getDeviceUtilization({ range, startDate, endDate });
      const headers = [
        { key: 'deviceCode', label: 'Device Code' },
        { key: 'deviceName', label: 'Device Name' },
        { key: 'capacity', label: 'Capacity', type: 'number' },
        { key: 'operatingHours', label: 'Operating Hrs', type: 'number' },
        { key: 'maintenanceHours', label: 'Downtime Hrs', type: 'number' },
        { key: 'availableHours', label: 'Available Hrs', type: 'number' },
        { key: 'bookedHours', label: 'Booked Hrs', type: 'number' },
        { key: 'utilizationPercentage', label: 'Utilization %', type: 'number' },
        { key: 'bookingsCount', label: 'Bookings', type: 'number' },
        { key: 'totalRevenueRupees', label: 'Revenue (₹)', type: 'currency' },
      ];

      const rows = utilData.devices.map((d) => ({
        deviceCode: d.deviceCode,
        deviceName: d.deviceName,
        capacity: d.capacity,
        operatingHours: d.operatingHours,
        maintenanceHours: d.maintenanceHours,
        availableHours: d.availableHours,
        bookedHours: d.bookedHours,
        utilizationPercentage: d.utilizationPercentage,
        bookingsCount: d.bookingsCount,
        totalRevenueRupees: d.totalRevenueRupees,
      }));

      return {
        title: 'Device Utilization & Operating Capacity Report',
        sheetName: 'Hardware Utilization',
        subtitle: `Date Range: ${utilData.dateRange?.start || ''} to ${utilData.dateRange?.end || ''}`,
        headers,
        rows,
        summaryCards: [
          {
            label: 'PS5 Station 1',
            value: `${utilData.devices.find((d) => d.deviceCode === 'PS5-01')?.utilizationPercentage || 0}%`,
          },
          {
            label: 'PS5 Station 2',
            value: `${utilData.devices.find((d) => d.deviceCode === 'PS5-02')?.utilizationPercentage || 0}%`,
          },
          {
            label: 'Pool Table',
            value: `${utilData.devices.find((d) => d.deviceCode === 'POOL-01')?.utilizationPercentage || 0}%`,
          },
        ],
      };
    }

    case 'games':
    case 'game':
    case 'game_performance': {
      const gameData = await getGamePerformance({ range, startDate, endDate });
      const headers = [
        { key: 'gameName', label: 'Game Title' },
        { key: 'isExclusive', label: 'Exclusive Title' },
        { key: 'bookingsCount', label: 'Total Bookings', type: 'number' },
        { key: 'totalHours', label: 'Total Hours', type: 'number' },
        { key: 'totalRevenueRupees', label: 'Revenue (₹)', type: 'currency' },
        { key: 'devices', label: 'Hardware Stations' },
      ];

      const rows = gameData.map((g) => ({
        gameName: g.gameName,
        isExclusive: g.isExclusive ? 'Yes (Exclusive)' : 'Standard',
        bookingsCount: g.bookingsCount,
        totalHours: g.totalHours,
        totalRevenueRupees: g.totalRevenueRupees,
        devices: g.devicesPlayedOn?.join(', ') || 'PS5',
      }));

      return {
        title: 'Game Title Performance & Hourly Usage Report',
        sheetName: 'Game Performance',
        subtitle: `Tracked across physical consoles`,
        headers,
        rows,
        summaryCards: [
          { label: 'Top Game', value: rows[0]?.gameName || 'N/A' },
          { label: 'GTA 6 Bookings', value: rows.find((r) => r.gameName?.includes('GTA 6'))?.bookingsCount || 0 },
          { label: 'GTA 6 Revenue', value: `₹${(rows.find((r) => r.gameName?.includes('GTA 6'))?.totalRevenueRupees || 0).toFixed(2)}` },
        ],
      };
    }

    case 'customers':
    case 'customer': {
      const custData = await getCustomerAnalytics({ range, startDate, endDate });
      const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean();

      // Aggregate spend and sessions per customer
      const [spendAgg, sessionsAgg] = await Promise.all([
        Payment.aggregate([
          { $match: { paymentStatus: { $in: ['PAID', 'PARTIALLY_REFUNDED'] } } },
          { $group: { _id: '$customer', totalPaise: { $sum: '$amount' }, txCount: { $sum: 1 } } },
        ]),
        Booking.aggregate([
          { $match: { bookingStatus: { $ne: 'CANCELLED' } } },
          { $group: { _id: '$customer', sessionCount: { $sum: 1 } } },
        ]),
      ]);

      const spendMap = new Map(spendAgg.map((s) => [s._id.toString(), s]));
      const sessMap = new Map(sessionsAgg.map((s) => [s._id.toString(), s.sessionCount]));

      const headers = [
        { key: 'name', label: 'Customer Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'registeredAt', label: 'Registered On' },
        { key: 'totalSpentRupees', label: 'Total Spend (₹)', type: 'currency' },
        { key: 'transactionsCount', label: 'Payments Count', type: 'number' },
        { key: 'sessionsCount', label: 'Gaming Sessions', type: 'number' },
        { key: 'membershipStatus', label: 'Membership Status' },
      ];

      const rows = customers.map((c) => {
        const cIdStr = c._id.toString();
        const sInfo = spendMap.get(cIdStr);
        const sCount = sessMap.get(cIdStr) || 0;
        return {
          name: c.name,
          email: c.email,
          phone: c.phone || 'N/A',
          registeredAt: new Date(c.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
          totalSpentRupees: sInfo ? sInfo.totalPaise / 100 : 0,
          transactionsCount: sInfo ? sInfo.txCount : 0,
          sessionsCount: sCount,
          membershipStatus: c.membership?.status === 'ACTIVE' ? 'Active Member' : 'Non-Member',
        };
      });

      return {
        title: 'Customer Directory & Retention Report',
        sheetName: 'Customers',
        subtitle: `Total Registered Customers: ${customers.length}`,
        headers,
        rows,
        summaryCards: [
          { label: 'Total Customers', value: customers.length },
          { label: 'Active Members', value: rows.filter((r) => r.membershipStatus === 'Active Member').length },
          { label: 'Total Spenders', value: rows.filter((r) => r.totalSpentRupees > 0).length },
        ],
      };
    }

    case 'memberships':
    case 'membership': {
      const memData = await getMembershipAnalytics({ range, startDate, endDate });
      const subscriptions = await MembershipSubscription.find()
        .populate('customer', 'name email phone')
        .populate('membershipPlan', 'name price validityDuration validityUnit')
        .sort({ createdAt: -1 })
        .lean();

      const headers = [
        { key: 'subscriptionId', label: 'Subscription ID' },
        { key: 'customerName', label: 'Customer' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'planName', label: 'Plan Name' },
        { key: 'priceRupees', label: 'Price (₹)', type: 'currency' },
        { key: 'validity', label: 'Validity' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'Expires On' },
        { key: 'status', label: 'Status' },
      ];

      const rows = subscriptions.map((s) => ({
        subscriptionId: s.subscriptionId,
        customerName: s.customer?.name || 'N/A',
        customerPhone: s.customer?.phone || 'N/A',
        planName: s.membershipPlan?.name || 'Club Pass',
        priceRupees: (s.membershipPlan?.price || 0) / 100,
        validity: `${s.membershipPlan?.validityDuration || 30} ${s.membershipPlan?.validityUnit || 'DAYS'}`,
        startDate: s.startDate ? new Date(s.startDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A',
        endDate: s.endDate ? new Date(s.endDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A',
        status: s.status,
      }));

      return {
        title: 'Monthly Pass & Membership Subscriptions Report',
        sheetName: 'Memberships',
        subtitle: `Active Subscriptions: ${memData.metrics?.activeSubscriptions || 0}`,
        headers,
        rows,
        summaryCards: [
          { label: 'Active Subscriptions', value: memData.metrics?.activeSubscriptions || 0 },
          { label: 'Total Subscriptions', value: rows.length },
          { label: 'Total Revenue', value: `₹${(memData.metrics?.totalRevenueRupees || 0).toFixed(2)}` },
        ],
      };
    }

    case 'payments':
    case 'payment': {
      const { startUTC, endUTC, startISTStr, endISTStr } = getISTDateRange(range, startDate, endDate);
      const filter = {
        createdAt: { $gte: startUTC, $lte: endUTC },
      };
      if (query.status && query.status !== 'all') {
        filter.paymentStatus = query.status.toUpperCase();
      }
      if (query.method && query.method !== 'all') {
        filter.paymentMethod = query.method.toUpperCase();
      }

      const payments = await Payment.find(filter)
        .populate('customer', 'name email phone')
        .populate('booking', 'bookingId')
        .populate('collectedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();

      const headers = [
        { key: 'paymentId', label: 'Payment ID' },
        { key: 'receiptNumber', label: 'Receipt No' },
        { key: 'customerName', label: 'Customer' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'bookingId', label: 'Booking Ref' },
        { key: 'purpose', label: 'Purpose' },
        { key: 'gateway', label: 'Gateway' },
        { key: 'method', label: 'Method' },
        { key: 'transactionRef', label: 'Transaction Ref' },
        { key: 'amountRupees', label: 'Amount (₹)', type: 'currency' },
        { key: 'refundedRupees', label: 'Refunded (₹)', type: 'currency' },
        { key: 'status', label: 'Status' },
        { key: 'collectedBy', label: 'Staff / Gateway' },
        { key: 'createdAt', label: 'Timestamp (IST)' },
      ];

      const rows = payments.map((p) => ({
        paymentId: p.paymentId,
        receiptNumber: p.receiptNumber || 'N/A',
        customerName: p.customer?.name || 'Walk-in Guest',
        customerPhone: p.customer?.phone || 'N/A',
        bookingId: p.booking?.bookingId || 'N/A',
        purpose: p.paymentPurpose,
        gateway: p.paymentGateway,
        method: p.paymentMethod,
        transactionRef: p.transactionReference || p.gatewayOrderId || 'N/A',
        amountRupees: (p.amount || 0) / 100,
        refundedRupees: ((p.refundedAmount || 0) / 100),
        status: p.paymentStatus,
        collectedBy: p.collectedBy?.name || (p.paymentGateway === 'RAZORPAY' ? 'Razorpay Online' : 'Front Desk Counter'),
        createdAt: new Date(p.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      }));

      return {
        title: 'Financial Transaction & Payment Audit Ledger',
        sheetName: 'Payments Ledger',
        subtitle: `Date Range: ${startISTStr} to ${endISTStr}`,
        headers,
        rows,
        summaryCards: [
          { label: 'Total Transactions', value: rows.length },
          { label: 'Paid Count', value: rows.filter((r) => r.status === 'PAID').length },
          { label: 'Total Collected', value: `₹${rows.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + r.amountRupees, 0).toFixed(2)}` },
        ],
      };
    }

    case 'receptionists':
    case 'receptionist': {
      const recData = await getReceptionistPerformance({ range, startDate, endDate });
      const headers = [
        { key: 'name', label: 'Staff Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'bookingsCreated', label: 'Bookings Created', type: 'number' },
        { key: 'walkInsHandled', label: 'Walk-ins', type: 'number' },
        { key: 'checkInsPerformed', label: 'Check-ins', type: 'number' },
        { key: 'sessionsCompleted', label: 'Completed Sessions', type: 'number' },
        { key: 'cashCollectedRupees', label: 'Cash (₹)', type: 'currency' },
        { key: 'counterUpiCollectedRupees', label: 'Counter UPI (₹)', type: 'currency' },
        { key: 'totalOfflineCollectedRupees', label: 'Total Offline (₹)', type: 'currency' },
      ];

      const rows = (recData.receptionists || []).map((r) => ({
        ...r,
        cashCollectedRupees: r.cashCollectedRupees,
        counterUpiCollectedRupees: r.counterUpiCollectedRupees,
        totalOfflineCollectedRupees: r.totalOfflineCollectedRupees,
      }));

      return {
        title: 'Receptionist & Counter Staff Audit Report',
        sheetName: 'Reception Ops',
        subtitle: `Cash reconciliation and walk-in throughput audit`,
        headers,
        rows,
        summaryCards: [
          { label: 'Active Staff', value: rows.length },
          {
            label: 'Total Counter Cash',
            value: `₹${rows.reduce((sum, r) => sum + (r.cashCollectedRupees || 0), 0).toFixed(2)}`,
          },
          {
            label: 'Total Counter UPI',
            value: `₹${rows.reduce((sum, r) => sum + (r.counterUpiCollectedRupees || 0), 0).toFixed(2)}`,
          },
        ],
      };
    }

    case 'maintenance': {
      const mainData = await getMaintenanceAnalytics();
      const headers = [
        { key: 'device', label: 'Device / Console' },
        { key: 'reason', label: 'Issue / Reason' },
        { key: 'status', label: 'Status' },
        { key: 'startDate', label: 'Maintenance Start' },
        { key: 'actualEndDate', label: 'Resolved Date' },
        { key: 'createdBy', label: 'Logged By' },
      ];

      const rows = (mainData.history || []).map((m) => ({
        device: m.device ? `${m.device.name} (${m.device.code})` : 'N/A',
        reason: m.reason,
        status: m.status,
        startDate: m.startDate ? new Date(m.startDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A',
        actualEndDate: m.actualEndDate ? new Date(m.actualEndDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Ongoing',
        createdBy: m.createdBy || 'Staff',
      }));

      return {
        title: 'Device Maintenance & Downtime Report',
        sheetName: 'Maintenance',
        subtitle: `Total Downtime: ${mainData.totalDowntimeHours} hrs | Incidents: ${mainData.totalIncidents}`,
        headers,
        rows,
        summaryCards: [
          { label: 'Total Incidents', value: mainData.totalIncidents },
          { label: 'Downtime Hours', value: `${mainData.totalDowntimeHours} hrs` },
          { label: 'Most Maintained', value: mainData.mostMaintainedDevice || 'None' },
        ],
      };
    }

    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

/**
 * Main export service dispatcher. Supports format = 'csv', 'xlsx', 'pdf', or 'json'.
 * Handles single report types and the comprehensive 'master' multi-sheet business report.
 */
export async function exportReport(reportType, format = 'csv', query = {}) {
  const normalizedFormat = (format || 'csv').toLowerCase();
  const dateStr = formatISTDate(new Date());

  // Comprehensive Master Business Report
  if (reportType.toLowerCase() === 'master' || reportType.toLowerCase() === 'business_summary' || reportType.toLowerCase() === 'all') {
    const [revData, bookData, payData, custData, memData, devData, gameData, recData, maintData] = await Promise.all([
      generateReportData('revenue', query).catch(() => null),
      generateReportData('bookings', query).catch(() => null),
      generateReportData('payments', query).catch(() => null),
      generateReportData('customers', query).catch(() => null),
      generateReportData('memberships', query).catch(() => null),
      generateReportData('devices', query).catch(() => null),
      generateReportData('games', query).catch(() => null),
      generateReportData('receptionists', query).catch(() => null),
      generateReportData('maintenance', query).catch(() => null),
    ]);

    const activeSheets = [
      revData && { name: 'Revenue Summary', headers: revData.headers, rows: revData.rows },
      bookData && { name: 'Bookings & Reservations', headers: bookData.headers, rows: bookData.rows },
      payData && { name: 'Payments Ledger', headers: payData.headers, rows: payData.rows },
      custData && { name: 'Customers Directory', headers: custData.headers, rows: custData.rows },
      memData && { name: 'Club Memberships', headers: memData.headers, rows: memData.rows },
      devData && { name: 'Hardware Utilization', headers: devData.headers, rows: devData.rows },
      gameData && { name: 'Game Performance', headers: gameData.headers, rows: gameData.rows },
      recData && { name: 'Staff Operations', headers: recData.headers, rows: recData.rows },
      maintData && { name: 'Maintenance History', headers: maintData.headers, rows: maintData.rows },
    ].filter(Boolean);

    if (normalizedFormat === 'xlsx') {
      const { buffer, contentType } = await createExcelWorkbook({
        title: 'NOAH GAMING Master Business Report',
        sheets: activeSheets,
      });
      return {
        contentType,
        fileName: `NOAH_GAMING_Business_Report_${dateStr}.xlsx`,
        data: buffer,
        isBinary: true,
      };
    }

    if (normalizedFormat === 'pdf') {
      // For Master PDF, compile executive revenue and bookings overview
      const masterCards = [
        ...(revData?.summaryCards || []).slice(0, 3),
        ...(bookData?.summaryCards || []).slice(0, 2),
      ];
      const masterRows = [
        ...(revData?.rows || []).slice(0, 15),
      ];
      const pdfBuffer = await generatePdfReport({
        title: 'NOAH GAMING Comprehensive Executive Business Summary',
        subtitle: `Consolidated Master Report • ${dateStr}`,
        summaryCards: masterCards,
        headers: revData?.headers || [],
        rows: masterRows,
        dateRangeStr: `As of ${dateStr}`,
      });
      return {
        contentType: 'application/pdf',
        fileName: `NOAH_GAMING_Business_Report_${dateStr}.pdf`,
        data: pdfBuffer,
        isBinary: true,
      };
    }

    // Fallback for CSV master: output bookings
    const csvContent = toCSV(bookData?.headers || [], bookData?.rows || []);
    return {
      contentType: 'text/csv; charset=utf-8',
      fileName: `NOAH_GAMING_Business_Report_${dateStr}.csv`,
      data: csvContent,
      isBinary: false,
    };
  }

  // Single Section Report
  const data = await generateReportData(reportType, query);

  if (normalizedFormat === 'csv') {
    const csvContent = toCSV(data.headers, data.rows);
    return {
      contentType: 'text/csv; charset=utf-8',
      fileName: `NOAH_GAMING_${reportType}_${dateStr}.csv`,
      data: csvContent,
      isBinary: false,
      recordCount: data.rows.length,
    };
  }

  if (normalizedFormat === 'xlsx') {
    const { buffer, contentType } = await createExcelWorkbook({
      title: data.title,
      sheets: [
        {
          name: data.sheetName || data.title.slice(0, 31),
          headers: data.headers,
          rows: data.rows,
        },
      ],
    });
    return {
      contentType,
      fileName: `NOAH_GAMING_${reportType}_${dateStr}.xlsx`,
      data: buffer,
      isBinary: true,
      recordCount: data.rows.length,
    };
  }

  if (normalizedFormat === 'pdf') {
    const pdfBuffer = await generatePdfReport({
      title: data.title,
      subtitle: data.subtitle,
      summaryCards: data.summaryCards || [],
      headers: data.headers,
      rows: data.rows,
      dateRangeStr: data.subtitle,
    });
    return {
      contentType: 'application/pdf',
      fileName: `NOAH_GAMING_${reportType}_${dateStr}.pdf`,
      data: pdfBuffer,
      isBinary: true,
      recordCount: data.rows.length,
    };
  }

  if (normalizedFormat === 'html') {
    const htmlContent = toPrintableHTML(
      data.title,
      data.subtitle,
      data.headers,
      data.rows,
      data.summaryCards
    );
    return {
      contentType: 'text/html; charset=utf-8',
      fileName: `NOAH_GAMING_${reportType}_${dateStr}.html`,
      data: htmlContent,
      isBinary: false,
      recordCount: data.rows.length,
    };
  }

  return {
    contentType: 'application/json',
    fileName: `NOAH_GAMING_${reportType}_${dateStr}.json`,
    data,
    isBinary: false,
    recordCount: data.rows.length,
  };
}
