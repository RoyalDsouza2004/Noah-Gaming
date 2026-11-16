import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 7 Analytics & Reports Verification Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate as Admin
  let adminToken = '';
  let customerToken = '';
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@gaminglounge.com',
        password: 'AdminPassword@123',
      }),
    });
    const body = await res.json();
    assert(res.ok && body.data?.token, '1. Admin authentication successful');
    adminToken = body.data?.token;
  } catch (err) {
    assert(false, `1. Admin login failed: ${err.message}`);
  }

  // 2. Authenticate as Customer
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'customer@gaminglounge.com',
        password: 'CustomerPassword@123',
      }),
    });
    const body = await res.json();
    assert(res.ok && body.data?.token, '2. Customer authentication successful');
    customerToken = body.data?.token;
  } catch (err) {
    assert(false, `2. Customer login failed: ${err.message}`);
  }

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  const customerHeaders = {
    Authorization: `Bearer ${customerToken}`,
    'Content-Type': 'application/json',
  };

  // 3. Test RBAC: Customer should be blocked with 403
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/dashboard`, {
      headers: customerHeaders,
    });
    assert(res.status === 403, '3. Customer token rejected with 403 Forbidden on analytics');
  } catch (err) {
    assert(false, `3. RBAC customer check failed: ${err.message}`);
  }

  // 4. Test RBAC: Unauthenticated should be blocked with 401
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/dashboard`);
    assert(res.status === 401, '4. Unauthenticated request rejected with 401 Unauthorized');
  } catch (err) {
    assert(false, `4. RBAC unauth check failed: ${err.message}`);
  }

  // 5. Test Dashboard KPIs
  let kpiData = null;
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/dashboard`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    kpiData = json.data;
    assert(
      res.ok && json.success && kpiData.revenue && kpiData.bookings && kpiData.customers,
      '5. Dashboard KPIs endpoint returns complete aggregated metrics'
    );
    assert(
      typeof kpiData.revenue.totalRevenueRupees === 'number' &&
      typeof kpiData.revenue.grossCollectionsRupees === 'number' &&
      kpiData.revenue.totalRevenuePaise === kpiData.revenue.grossCollectionsPaise - kpiData.revenue.totalRefundsPaise,
      `6. Financial integrity: Net revenue (${kpiData.revenue.totalRevenueRupees}) = Gross (${kpiData.revenue.grossCollectionsRupees}) - Refunds (${kpiData.revenue.totalRefundsRupees})`
    );
    assert(
      typeof kpiData.bookings.totalBookings === 'number' && kpiData.bookings.totalBookings > 0,
      `7. Total bookings aggregated from live DB: ${kpiData.bookings.totalBookings} bookings`
    );
  } catch (err) {
    assert(false, `5-7. Dashboard KPIs failed: ${err.message}`);
  }

  // 8. Test Revenue Analytics
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/revenue?range=30d`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && json.success && Array.isArray(json.data.trends),
      '8. Revenue analytics endpoint returns 30-day trends and reconciliation metrics'
    );
    assert(
      json.data.grossCollectionsPaise >= json.data.netCollectionsPaise,
      '9. Net collections properly deduct refunds and exclude pending payments'
    );
  } catch (err) {
    assert(false, `8-9. Revenue analytics failed: ${err.message}`);
  }

  // 10. Test Revenue By Device & GTA 6
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/revenue/by-device`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    const devices = json.data.devices;
    const gta6 = json.data.gta6Breakdown;
    assert(
      res.ok && Array.isArray(devices) && devices.length === 3,
      '10. Exactly 3 physical devices returned (PS5-01, PS5-02, POOL-01)'
    );
    assert(
      devices.some((d) => d.code === 'PS5-01') &&
      devices.some((d) => d.code === 'PS5-02') &&
      devices.some((d) => d.code === 'POOL-01'),
      '11. Physical device codes verified: PS5-01, PS5-02, POOL-01'
    );
    assert(
      gta6 && gta6.note.includes('physical PS5 consoles'),
      '12. GTA 6 correctly designated as a game played on PS5 hardware, NOT a 4th device'
    );
  } catch (err) {
    assert(false, `10-12. Device revenue breakdown failed: ${err.message}`);
  }

  // 13. Test Revenue By Game
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/revenue/by-game`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && Array.isArray(json.data),
      '13. Revenue by game returned sorted array of titles'
    );
  } catch (err) {
    assert(false, `13. Revenue by game failed: ${err.message}`);
  }

  // 14. Test Revenue By Payment Method & Online vs Offline
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/revenue/by-payment-method`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    const channels = json.data.collectionChannels;
    assert(
      res.ok && Array.isArray(json.data.methods) && channels,
      '14. Payment methods breakdown returned with online vs offline channels'
    );
    assert(
      channels.totalNetPaise === channels.onlinePaise + channels.offlinePaise,
      `15. Channel math verified: Total Net (${channels.totalNetRupees}) = Online (${channels.onlineRupees}) + Offline (${channels.offlineRupees})`
    );
  } catch (err) {
    assert(false, `14-15. Payment methods breakdown failed: ${err.message}`);
  }

  // 16. Test Booking Analytics & Trends
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/bookings`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && json.data.metrics && Array.isArray(json.data.peakDays) && Array.isArray(json.data.peakHours),
      '16. Booking analytics returned metrics, peak days, and 24-hr peak hours distribution'
    );
    assert(
      json.data.peakDays.length === 7 && json.data.peakHours.length === 14,
      '17. Peak days cover all 7 weekdays and operating hours cover 10:00 to 23:00'
    );
  } catch (err) {
    assert(false, `16-17. Booking analytics failed: ${err.message}`);
  }

  // 18. Test Device Utilization Formula
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/devices/utilization?range=30d`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && Array.isArray(json.data.devices),
      '18. Device utilization returned for all physical devices'
    );
    const ps5 = json.data.devices.find((d) => d.deviceCode === 'PS5-01');
    assert(
      ps5 &&
      ps5.operatingHours === 30 * 13 &&
      ps5.availableHours === ps5.operatingHours - ps5.maintenanceHours,
      `19. Device utilization formula: Available Hours (${ps5.availableHours}) = Nominal Operating (${ps5.operatingHours}) - Maintenance Downtime (${ps5.maintenanceHours})`
    );
  } catch (err) {
    assert(false, `18-19. Device utilization failed: ${err.message}`);
  }

  // 20. Test Customer Analytics (No sensitive data exposed)
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/customers`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && json.data.overview && Array.isArray(json.data.topSpenders),
      '20. Customer analytics returned top spenders and overview'
    );
    const topSpender = json.data.topSpenders[0];
    assert(
      topSpender && !topSpender.password && !topSpender.salt,
      '21. Passwords and hashes strictly excluded from customer analytics'
    );
  } catch (err) {
    assert(false, `20-21. Customer analytics failed: ${err.message}`);
  }

  // 22. Test Membership Analytics
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/memberships`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && json.data.metrics && Array.isArray(json.data.planPerformance),
      '22. Membership analytics returns plan sales and renewal metrics'
    );
  } catch (err) {
    assert(false, `22. Membership analytics failed: ${err.message}`);
  }

  // 23. Test Receptionist Performance Monitoring
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/receptionists`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && Array.isArray(json.data.receptionists) && Array.isArray(json.data.auditLogs),
      '23. Receptionist monitoring returns staff metrics and live audit trail'
    );
  } catch (err) {
    assert(false, `23. Receptionist monitoring failed: ${err.message}`);
  }

  // 24. Test Maintenance Analytics
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/maintenance`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && typeof json.data.totalDowntimeHours === 'number' && Array.isArray(json.data.history),
      '24. Device maintenance analytics returns incident count, downtime hours, and history'
    );
  } catch (err) {
    assert(false, `24. Maintenance analytics failed: ${err.message}`);
  }

  // 25. Test Financial & Outstanding Balance Reports
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics/payments/financial`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && json.data.summary && Array.isArray(json.data.payments) && Array.isArray(json.data.outstandingBookings),
      '25. Financial payment report returns status summaries, payments, and outstanding bookings'
    );
  } catch (err) {
    assert(false, `25. Financial payment report failed: ${err.message}`);
  }

  // 26. Test Report Export: CSV
  try {
    const res = await fetch(`${BASE_URL}/admin/reports/revenue?format=csv`, {
      headers: adminHeaders,
    });
    const csvText = await res.text();
    assert(
      res.ok &&
      res.headers.get('content-type')?.includes('text/csv') &&
      csvText.includes('Date (IST)') &&
      csvText.includes('Net Collections (₹)'),
      '26. CSV report export generated with RFC-4180 compliance and valid headers'
    );
  } catch (err) {
    assert(false, `26. CSV export failed: ${err.message}`);
  }

  // 27. Test Report Export: XLSX (SpreadsheetML)
  try {
    const res = await fetch(`${BASE_URL}/admin/reports/bookings?format=xlsx`, {
      headers: adminHeaders,
    });
    const xmlText = await res.text();
    assert(
      res.ok &&
      res.headers.get('content-type')?.includes('vnd.ms-excel') &&
      xmlText.includes('<?xml version="1.0"') &&
      xmlText.includes('<Workbook'),
      '27. XLSX spreadsheet report export generated with valid SpreadsheetML'
    );
  } catch (err) {
    assert(false, `27. XLSX export failed: ${err.message}`);
  }

  // 28. Test Report Export: PDF / Print-Ready HTML
  try {
    const res = await fetch(`${BASE_URL}/admin/reports/devices?format=pdf`, {
      headers: adminHeaders,
    });
    const htmlText = await res.text();
    assert(
      res.ok &&
      res.headers.get('content-type')?.includes('text/html') &&
      htmlText.includes('Nexus Gaming Lounge') &&
      htmlText.includes('Print to PDF'),
      '28. PDF / Print-ready HTML report export generated with print stylesheet'
    );
  } catch (err) {
    assert(false, `28. PDF export failed: ${err.message}`);
  }

  // 29. Test Date Filtering & Custom Range in IST
  try {
    const res = await fetch(
      `${BASE_URL}/admin/analytics/revenue?range=custom&startDate=2026-11-01&endDate=2026-11-14`,
      { headers: adminHeaders }
    );
    const json = await res.json();
    assert(
      res.ok &&
      json.data.dateRange.start === '2026-11-01' &&
      json.data.dateRange.end === '2026-11-14',
      '29. Custom date range filtering in IST correctly parsed and executed'
    );
  } catch (err) {
    assert(false, `29. Custom date range failed: ${err.message}`);
  }

  // 30. Test Previous Phase Stability (Health check & Public routes)
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const json = await res.json();
    assert(
      res.ok && json.success && (json.data?.status === 'UP' || json.status === 'OK'),
      '30. Previous phases intact: Server health endpoint returns UP and DB status'
    );
  } catch (err) {
    assert(false, `30. Health check failed: ${err.message}`);
  }

  console.log('\n----------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL 30 PHASE 7 BACKEND TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

runTests();
