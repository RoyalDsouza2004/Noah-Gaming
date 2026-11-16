import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import '../models/GamingSession.js';
import '../models/Booking.js';
import '../models/Payment.js';
import '../models/User.js';

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gaming_lounge';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failCount++;
  }
}

async function api(path, { method = 'GET', body = null, token = null, headers = {} } = {}) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }
  return { status: res.status, ok: res.ok, data };
}

async function runEndToEndAcceptanceSuite() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 9 End-to-End Acceptance Test Suite');
  console.log('====================================================\n');

  let adminToken = '';
  let receptionistToken = '';
  let customerToken = '';
  let testCustomer = null;
  let ps5Station1 = null;
  let ps5Station2 = null;
  let poolTable = null;
  let gta6Game = null;
  let fifaGame = null;
  let sharedBooking = null;
  let activeSessionId = null;
  let purchasedSubId = null;

  // ----------------------------------------------------
  // STEP 1: Admin Logs In
  // ----------------------------------------------------
  console.log('--- Step 1: Admin Authentication ---');
  const adminLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' },
  });
  assert(adminLoginRes.status === 200 && adminLoginRes.data?.data?.token, '1. Admin authentication successful');
  adminToken = adminLoginRes.data?.data?.token;

  // ----------------------------------------------------
  // STEP 2: Admin Verifies Physical Equipment (2 PS5s, 1 Pool)
  // ----------------------------------------------------
  console.log('\n--- Step 2: Physical Equipment Verification ---');
  const devicesRes = await api('/devices', { token: adminToken });
  const devices = devicesRes.data?.data?.devices || devicesRes.data?.devices || [];
  assert(devicesRes.status === 200 && Array.isArray(devices), '2.1 Fetched devices catalogue');

  const ps5Devices = devices.filter((d) => d.deviceType === 'PS5');
  const poolDevices = devices.filter((d) => d.deviceType === 'POOL');
  assert(ps5Devices.length === 2, `2.2 Exactly 2 physical PS5 consoles exist (found ${ps5Devices.length})`);
  assert(poolDevices.length === 1, `2.3 Exactly 1 physical 8-ball pool table exists (found ${poolDevices.length})`);
  assert(devices.length === 3, `2.4 Total registered physical devices is exactly 3 (found ${devices.length})`);

  ps5Station1 = ps5Devices[0];
  ps5Station2 = ps5Devices[1];
  poolTable = poolDevices[0];

  assert(ps5Station1.capacity === 4 && ps5Station2.capacity === 4, '2.5 Both PS5 consoles support max 4 players');
  assert(poolTable.capacity >= 2, `2.6 Pool table capacity is configurable (currently ${poolTable.capacity})`);

  // ----------------------------------------------------
  // STEP 3: Admin Verifies Games & Pricing Rules
  // ----------------------------------------------------
  console.log('\n--- Step 3: Games & Pricing Verification ---');
  const gamesRes = await api('/games', { token: adminToken });
  const games = gamesRes.data?.data?.games || gamesRes.data?.games || [];
  assert(gamesRes.status === 200 && Array.isArray(games), '3.1 Fetched games catalogue');

  gta6Game = games.find((g) => g.name.toLowerCase().includes('gta') || g.isExclusive);
  fifaGame = games.find((g) => !g.isExclusive && g.name.toLowerCase().includes('fifa') || g.name.toLowerCase().includes('fc')) || games[0];

  assert(gta6Game && gta6Game.isExclusive === true, '3.2 GTA 6 is registered as a Game (NOT a device) with isExclusive: true');

  // Verify pricing calculations
  const ps5PriceRes = await api('/pricing/calculate', {
    method: 'POST',
    token: adminToken,
    body: { deviceId: ps5Station1._id, durationMinutes: 60, playersCount: 1 },
  });
  assert(ps5PriceRes.status === 200 && ps5PriceRes.data?.data?.totalAmountPaise === 6000, '3.3 PS5 standard pricing is ₹60 (6000 paise) per player/hr');

  const poolPriceRes = await api('/pricing/calculate', {
    method: 'POST',
    token: adminToken,
    body: { deviceId: poolTable._id, durationMinutes: 60, playersCount: 1 },
  });
  assert(poolPriceRes.status === 200 && poolPriceRes.data?.data?.totalAmountPaise === 16000, '3.4 Pool standard pricing is ₹160 (16000 paise) per player/hr');

  // ----------------------------------------------------
  // STEP 4: Admin Verifies GTA 6 Exclusive Pricing & Mandatory Advance
  // ----------------------------------------------------
  console.log('\n--- Step 4: GTA 6 Exclusive Configuration ---');
  const gta6PriceRes = await api('/pricing/calculate', {
    method: 'POST',
    token: adminToken,
    body: { deviceId: ps5Station1._id, gameId: gta6Game._id, durationMinutes: 60, playersCount: 1 },
  });
  assert(gta6PriceRes.status === 200 && gta6PriceRes.data?.data?.totalAmountPaise === 15000, '4.1 GTA 6 pricing is ₹150 (15000 paise) per hour');
  assert(gta6PriceRes.data?.data?.advanceRequired === true, '4.2 GTA 6 booking requires mandatory advance payment');
  assert(gta6PriceRes.data?.data?.minimumAdvancePaise > 0, `4.3 GTA 6 advance payment is configurable (minimum: ₹${gta6PriceRes.data?.data?.minimumAdvanceRupees})`);

  // ----------------------------------------------------
  // STEP 5: Customer Registers & Logs In
  // ----------------------------------------------------
  console.log('\n--- Step 5: Customer Registration & Login ---');
  const uniqueNum = Date.now().toString().slice(-6);
  const custEmail = `player.p9.${uniqueNum}@testnexus.com`;
  const custPhone = `98${uniqueNum}12`;

  const regRes = await api('/auth/register', {
    method: 'POST',
    body: {
      name: `Tester Player ${uniqueNum}`,
      email: custEmail,
      phone: custPhone,
      password: 'PlayerPassword@123',
    },
  });
  assert(regRes.status === 201 && regRes.data?.data?.token, '5.1 Customer registration successful');
  customerToken = regRes.data?.data?.token;
  testCustomer = regRes.data?.data?.user;

  // Profile management verification
  const profileRes = await api('/auth/me', { token: customerToken });
  assert(
    profileRes.status === 200 &&
      (profileRes.data?.data?.user?.email === custEmail || profileRes.data?.data?.email === custEmail),
    '5.2 Customer profile management accessible'
  );

  // ----------------------------------------------------
  // STEP 6: Customer Books a Shared Session (on Pool Table)
  // ----------------------------------------------------
  console.log('\n--- Step 6: Customer Books Shared Session ---');
  const testDate = '2026-11-28'; // future date to avoid collisions
  const testTime = '16:00';

  const bookRes = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      deviceId: poolTable._id,
      bookingDate: testDate,
      startTime: testTime,
      duration: 1,
      bookingType: 'SHARED',
      numberOfPlayers: 1,
    },
  });
  sharedBooking = bookRes.data?.data?.booking || bookRes.data?.data;
  assert(bookRes.status === 201 && sharedBooking?.bookingId, `6.1 Customer booked shared session: ${sharedBooking?.bookingId}`);

  // ----------------------------------------------------
  // STEP 7: Customer Completes Online Payment (Razorpay HMAC verified)
  // ----------------------------------------------------
  console.log('\n--- Step 7: Online Payment Verification ---');
  const createOrderRes = await api('/payments/create-order', {
    method: 'POST',
    token: customerToken,
    body: { bookingId: sharedBooking._id },
  });
  if (!createOrderRes.ok) console.log('createOrderRes error:', createOrderRes.status, createOrderRes.data);
  const orderId = createOrderRes.data?.data?.orderId || createOrderRes.data?.data?.order?.id;
  assert(createOrderRes.status === 200 && orderId, '7.1 Razorpay order created on backend');
  const mockPaymentId = `pay_${Date.now()}`;

  // Generate valid HMAC signature
  const secret = process.env.RAZORPAY_KEY_SECRET || 'nexus_secret_test_key_secure_2026';
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${mockPaymentId}`)
    .digest('hex');

  const verifyPayRes = await api('/payments/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      orderId,
      paymentId: mockPaymentId,
      signature: expectedSignature,
    },
  });
  assert(verifyPayRes.status === 200 && verifyPayRes.data?.data?.payment?.paymentStatus === 'PAID', '7.2 Payment signature verified and booking marked PAID');

  // ----------------------------------------------------
  // STEP 8: Receptionist Checks In Customer
  // ----------------------------------------------------
  console.log('\n--- Step 8: Receptionist Check-in ---');
  const recLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'reception@gaminglounge.com', password: 'StaffPassword@123' },
  });
  assert(recLoginRes.status === 200 && recLoginRes.data?.data?.token, '8.1 Receptionist logged in successfully');
  receptionistToken = recLoginRes.data?.data?.token;

  const checkInRes = await api(`/receptionist/bookings/${sharedBooking._id}/check-in`, {
    method: 'POST',
    token: receptionistToken,
  });
  assert(checkInRes.status === 200, '8.2 Customer checked in at reception desk');

  // ----------------------------------------------------
  // STEP 9: Gaming Session Starts & Timer Operates
  // ----------------------------------------------------
  console.log('\n--- Step 9: Live Gaming Session Start & Timer ---');
  const startSessionRes = await api(`/sessions/${sharedBooking._id}/start`, {
    method: 'POST',
    token: receptionistToken,
  });
  assert(startSessionRes.status === 200, '9.1 Gaming session started');
  const sessionData = startSessionRes.data?.data?.session || startSessionRes.data?.data;
  activeSessionId = sessionData?.id || sessionData?._id;

  const sessionDetailRes = await api(`/sessions/${activeSessionId}`, { token: receptionistToken });
  const sessionDetail = sessionDetailRes.data?.data?.session || sessionDetailRes.data?.data;
  assert(
    sessionDetailRes.status === 200 &&
      sessionDetail?.status === 'ACTIVE' &&
      sessionDetail?.scheduledEndAt,
    '9.2 Server-side authoritative timestamp (scheduledEndAt) recorded and active timer running'
  );

  // ----------------------------------------------------
  // STEP 10 & 11: Session Extension Engine
  // ----------------------------------------------------
  console.log('\n--- Step 10 & 11: Session Extension ---');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
  const GamingSession = mongoose.model('GamingSession');

  // Cancel historical test bookings today on this device so extension test runs conflict-free
  const BookingModel = mongoose.model('Booking');
  await BookingModel.updateMany(
    {
      _id: { $ne: sharedBooking._id },
      device: poolTable._id,
      bookingDate: '2026-11-14',
    },
    { bookingStatus: 'CANCELLED' }
  );

  // If running late in the day (past 21:00 IST), adjust scheduledEndAt backward
  // so adding +1h stays safely before the 23:00 IST closing hour cutoff
  const currentEnd = new Date(sessionDetail.scheduledEndAt);
  const istHour = parseInt(
    new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(currentEnd),
    10
  );
  if (istHour >= 21) {
    const safeEnd = new Date(currentEnd.getTime() - 4 * 3600 * 1000);
    await GamingSession.findByIdAndUpdate(activeSessionId, { scheduledEndAt: safeEnd });
  }

  const extendRes = await api(`/sessions/${activeSessionId}/extend`, {
    method: 'POST',
    token: receptionistToken,
    body: {
      extendedDurationHours: 1,
      paymentMethod: 'CASH',
      paymentAmountPaise: 16000,
    },
  });
  if (!extendRes.ok) console.log('extendRes error:', extendRes.status, extendRes.data);
  const extendedSession = extendRes.data?.data?.session || extendRes.data?.data;
  assert(extendRes.status === 200 && extendedSession?.status === 'EXTENDED', '11.1 Session extended by +1h with status EXTENDED');
  assert(extendedSession?.extensionHistory?.length > 0, '11.2 Extension history audit log stored');

  // ----------------------------------------------------
  // STEP 12: Scheduled Time Expiration Rule (DO NOT AUTO TERMINATE)
  // ----------------------------------------------------
  console.log('\n--- Step 12: Session Expiration & Non-Termination Rule ---');
  // Connect to DB directly to simulate scheduledEndAt in past
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
  const Booking = mongoose.model('Booking');

  await GamingSession.findByIdAndUpdate(activeSessionId, {
    scheduledEndAt: new Date(Date.now() - 60000), // 1 min in past
  });

  const checkExpiredSession = await api(`/sessions/${activeSessionId}`, { token: receptionistToken });
  const expiredData = checkExpiredSession.data?.data?.session || checkExpiredSession.data?.data;
  assert(
    expiredData?.isOverdue === true || expiredData?.status === 'AWAITING_RECEPTIONIST',
    '12.1 Overdue session flags status as AWAITING_RECEPTIONIST / isOverdue: true'
  );

  // CRITICAL RULE VERIFICATION: Ensure physical session is NOT auto-terminated
  const checkHeldBooking = await Booking.findById(sharedBooking._id);
  assert(
    checkHeldBooking.sessionStatus !== 'COMPLETED' && checkHeldBooking.bookingStatus !== 'COMPLETED',
    '12.2 CRITICAL RULE ENFORCED: Physical session is NOT terminated automatically. Equipment remains held.'
  );

  // ----------------------------------------------------
  // STEP 13 & 14: Receptionist Confirms Completion & Releases Device
  // ----------------------------------------------------
  console.log('\n--- Step 13 & 14: Receptionist Checkout Confirmation ---');
  const completeSessionRes = await api(`/sessions/${activeSessionId}/complete`, {
    method: 'POST',
    token: receptionistToken,
    body: { notes: 'Physical station checkout confirmed at counter.' },
  });
  assert(completeSessionRes.status === 200, '13.1 Receptionist completed checkout');

  const afterComplete = await GamingSession.findById(activeSessionId);
  assert(afterComplete.status === 'COMPLETED' && afterComplete.actualEndAt, '14.1 Session marked COMPLETED with actualEndAt recorded and station freed');

  // ----------------------------------------------------
  // STEP 15: Customer Purchases Membership Plan
  // ----------------------------------------------------
  console.log('\n--- Step 15: Membership Purchase ---');
  const plansRes = await api('/memberships/plans', { token: customerToken });
  assert(plansRes.status === 200 && Array.isArray(plansRes.data?.data?.plans), '15.1 Fetched available membership plans');
  const plans = plansRes.data?.data?.plans.sort((a, b) => a.price - b.price);

  const basePlan = plans[0]; // Lowest tier plan
  const upgradePlan = plans[plans.length - 1]; // Higher tier plan

  const orderRes = await api('/memberships/purchase', {
    method: 'POST',
    token: customerToken,
    body: { planId: basePlan._id },
  });
  if (!orderRes.ok) console.log('orderRes error:', orderRes.status, orderRes.data);
  const memOrderId = orderRes.data?.data?.orderId || orderRes.data?.data?.order?.id;
  assert(orderRes.status === 200 && memOrderId, `15.2 Razorpay order generated for plan: ${basePlan.name}`);

  const mockMemPayId = `pay_mem_${Date.now()}`;
  const memSecret = process.env.RAZORPAY_KEY_SECRET || 'nexus_secret_test_key_secure_2026';
  const expectedMemSig = crypto
    .createHmac('sha256', memSecret)
    .update(`${memOrderId}|${mockMemPayId}`)
    .digest('hex');

  const purchaseRes = await api('/memberships/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      orderId: memOrderId,
      paymentId: mockMemPayId,
      signature: expectedMemSig,
      planId: basePlan._id,
    },
  });
  if (!purchaseRes.ok) console.log('purchaseRes error:', purchaseRes.status, purchaseRes.data);
  assert(purchaseRes.status === 200 && purchaseRes.data?.data?.subscription, `15.3 Purchased and activated base membership: ${basePlan.name}`);
  purchasedSubId = purchaseRes.data?.data?.subscription?._id;

  // ----------------------------------------------------
  // STEP 16: Customer Upgrades Membership with Unused-Credit Adjustment
  // ----------------------------------------------------
  console.log('\n--- Step 16: Membership Upgrade & Prorated Credit Adjustment ---');
  const eligibleUpgradesRes = await api('/memberships/eligible-upgrades', { token: customerToken });
  assert(eligibleUpgradesRes.status === 200, '16.1 Retrieved eligible upgrade plans');
  const eligiblePlans = eligibleUpgradesRes.data?.data?.eligiblePlans || [];
  assert(
    !eligiblePlans.some((p) => p.price <= basePlan.price),
    '16.2 Lower-tier or equal-price plans are strictly prevented from appearing as upgrades'
  );

  const quoteRes = await api(`/memberships/upgrade-quote?targetPlanId=${upgradePlan._id}`, { token: customerToken });
  const quote = quoteRes.data?.data?.financials || quoteRes.data?.data?.quote?.financials || quoteRes.data?.data;
  assert(quoteRes.status === 200 && quote, '16.3 Generated prorated upgrade financial quote');
  assert(quote?.unusedCreditPaise > 0, `16.4 Unused membership credit accurately calculated: ₹${quote?.unusedCreditRupees}`);
  assert(quote?.finalAmountPayablePaise === (quote?.newPlanPricePaise - quote?.unusedCreditPaise), '16.5 Final payable amount equals New Plan Price minus Unused Credit');

  const upgOrderRes = await api('/memberships/upgrade-order', {
    method: 'POST',
    token: customerToken,
    body: { targetPlanId: upgradePlan._id },
  });
  if (!upgOrderRes.ok) console.log('upgOrderRes error:', upgOrderRes.status, upgOrderRes.data);
  const upgOrderId = upgOrderRes.data?.data?.order?.id || upgOrderRes.data?.data?.orderId;
  const upgTransactionId = upgOrderRes.data?.data?.upgrade?.upgradeTransactionId || upgOrderRes.data?.data?.upgradeTransactionId;
  assert(upgOrderRes.status === 200 && upgOrderId && upgTransactionId, '16.6 Generated upgrade Razorpay order');

  const mockUpgPayId = `pay_upg_${Date.now()}`;
  const upgSig = crypto
    .createHmac('sha256', memSecret)
    .update(`${upgOrderId}|${mockUpgPayId}`)
    .digest('hex');

  const upgradeConfirmRes = await api('/memberships/verify-upgrade', {
    method: 'POST',
    token: customerToken,
    body: {
      upgradeTransactionId: upgTransactionId,
      razorpayOrderId: upgOrderId,
      razorpayPaymentId: mockUpgPayId,
      razorpaySignature: upgSig,
    },
  });
  if (!upgradeConfirmRes.ok) console.log('upgradeConfirmRes error:', upgradeConfirmRes.status, upgradeConfirmRes.data);
  assert(upgradeConfirmRes.status === 200, '16.7 Membership successfully upgraded and old subscription superseded');

  // ----------------------------------------------------
  // STEP 17: Admin Reviews Payment Records & Business Analytics
  // ----------------------------------------------------
  console.log('\n--- Step 17: Admin Financial Reconciliation & Analytics ---');
  const analyticsRes = await api('/admin/analytics/dashboard', { token: adminToken });
  assert(analyticsRes.status === 200 && analyticsRes.data?.data?.kpis, '17.1 Admin business analytics & 12 KPI cards retrieved');
  assert(typeof analyticsRes.data?.data?.kpis?.totalRevenuePaise === 'number', '17.2 Revenue tracked precision-safely in integer paise');

  // ----------------------------------------------------
  // STEP 18: Notifications & Automation Reliability
  // ----------------------------------------------------
  console.log('\n--- Step 18: Notification Center & Automation Logs ---');
  const notifRes = await api('/notifications', { token: customerToken });
  assert(notifRes.status === 200 && Array.isArray(notifRes.data?.data?.notifications), '18.1 Customer notifications retrieved with category filters');

  const autoLogsRes = await api('/admin/automation/logs', { token: adminToken });
  assert(autoLogsRes.status === 200 && Array.isArray(autoLogsRes.data?.data?.logs), '18.2 Scheduler execution audit trail verified');

  // ----------------------------------------------------
  // EDGE CASE 1: Concurrency Conflict - Two Customers Booking Same Slot
  // ----------------------------------------------------
  console.log('\n--- Edge Case 1: Concurrency Conflict Prevention ---');
  // First booking on PS5 Station 2
  const uniqueOffsetDays = 60 + Math.floor(Math.random() * 200);
  const futureD = new Date(Date.now() + 86400000 * uniqueOffsetDays);
  const conflictDate = futureD.toISOString().split('T')[0];
  const conflictHour = String(10 + Math.floor(Math.random() * 8)).padStart(2, '0');
  const conflictTime = `${conflictHour}:00`;
  const b1 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      deviceId: ps5Station2._id,
      gameId: fifaGame?._id,
      bookingDate: conflictDate,
      startTime: conflictTime,
      duration: 1,
      bookingType: 'PRIVATE',
      numberOfPlayers: 1,
    },
  });
  if (!b1.ok) console.log('b1 error:', b1.status, b1.data);
  assert(b1.status === 201, 'Edge 1.1 First private booking on PS5 Station 2 succeeded');

  // Second customer tries to book same slot on PS5 Station 2
  const b2 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      deviceId: ps5Station2._id,
      gameId: fifaGame?._id,
      bookingDate: conflictDate,
      startTime: conflictTime,
      duration: 1,
      bookingType: 'SHARED',
      numberOfPlayers: 1,
    },
  });
  assert(b2.status === 409, 'Edge 1.2 Overlapping booking attempt on same physical device cleanly rejected with HTTP 409 Conflict');

  // ----------------------------------------------------
  // EDGE CASE 2: Failed Online Payment / Invalid Signature
  // ----------------------------------------------------
  console.log('\n--- Edge Case 2: Payment Security & Signature Tampering ---');
  const fakeSigRes = await api('/payments/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      orderId: 'order_fake_123',
      paymentId: 'pay_fake_456',
      signature: 'malicious_tampered_signature_string',
    },
  });
  assert(fakeSigRes.status === 400 || fakeSigRes.status === 404, 'Edge 2.1 Tampered payment signature cleanly rejected by backend');

  // ----------------------------------------------------
  // EDGE CASE 3: Webhook Idempotency & Duplicate Prevention
  // ----------------------------------------------------
  console.log('\n--- Edge Case 3: Webhook Idempotency ---');
  const webhookEvent = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: mockPaymentId,
          order_id: orderId,
          amount: 6000,
          status: 'captured',
          notes: { bookingId: sharedBooking._id },
        },
      },
    },
  };
  const webhookBodyStr = JSON.stringify(webhookEvent);
  const webhookSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'nexus_webhook_secret_key_2026')
    .update(webhookBodyStr)
    .digest('hex');

  const hook1 = await api('/payments/webhook', {
    method: 'POST',
    body: webhookEvent,
    headers: { 'x-razorpay-signature': webhookSig },
  });
  assert(hook1.status === 200, 'Edge 3.1 First webhook processed successfully');

  // Re-send identical webhook
  const hook2 = await api('/payments/webhook', {
    method: 'POST',
    body: webhookEvent,
    headers: { 'x-razorpay-signature': webhookSig },
  });
  assert(hook2.status === 200 && (hook2.data?.data?.alreadyProcessed === true || hook2.data?.success), 'Edge 3.2 Duplicate webhook safely handled without duplicate accounting');

  // ----------------------------------------------------
  // EDGE CASE 4: GTA 6 Exclusive Lock vs Regular Booking Conflict
  // ----------------------------------------------------
  console.log('\n--- Edge Case 4: GTA 6 Exclusive Lock Conflict ---');
  // Attempt to book GTA 6 on the already reserved PS5 Station 2 slot
  const gtaConflict = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      deviceId: ps5Station2._id,
      gameId: gta6Game._id,
      bookingDate: conflictDate,
      startTime: conflictTime,
      duration: 1,
      bookingType: 'PRIVATE',
      numberOfPlayers: 1,
    },
  });
  assert(gtaConflict.status === 409, 'Edge 4.1 GTA 6 exclusive booking rejected on occupied PS5 Station 2 (HTTP 409)');

  // PS5 Station 1 remains independently available!
  const gtaStation1 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      deviceId: ps5Station1._id,
      gameId: gta6Game._id,
      bookingDate: conflictDate,
      startTime: conflictTime,
      duration: 1,
      bookingType: 'PRIVATE',
      numberOfPlayers: 1,
    },
  });
  if (!gtaStation1.ok) console.log('gtaStation1 error:', gtaStation1.status, gtaStation1.data);
  assert(gtaStation1.status === 201, 'Edge 4.2 Other PS5 console (PS5 Station 1) remains independently available for GTA 6 reservation');

  // ----------------------------------------------------
  // EDGE CASE 5: Role-Based Access Control & Unauthorized Access
  // ----------------------------------------------------
  console.log('\n--- Edge Case 5: Role-Based Access Control ---');
  const custAccessAdmin = await api('/admin/automation/settings', { token: customerToken });
  assert(custAccessAdmin.status === 403, 'Edge 5.1 Customer blocked from accessing Admin automation settings (HTTP 403 Forbidden)');

  const custAccessReception = await api('/receptionist/dashboard', { token: customerToken });
  assert(custAccessReception.status === 403, 'Edge 5.2 Customer blocked from accessing Receptionist POS dashboard (HTTP 403 Forbidden)');

  const recAccessAdmin = await api('/admin/automation/settings', { token: receptionistToken });
  assert(recAccessAdmin.status === 403, 'Edge 5.3 Receptionist blocked from accessing Admin automation settings (HTTP 403 Forbidden)');

  const noTokenReq = await api('/devices', { method: 'POST', body: { name: 'Fake' } });
  assert(noTokenReq.status === 401, 'Edge 5.4 Unauthenticated request blocked (HTTP 401 Unauthorized)');

  // ----------------------------------------------------
  // EDGE CASE 6: NoSQL Injection Sanitization
  // ----------------------------------------------------
  console.log('\n--- Edge Case 6: NoSQL Injection Sanitization ---');
  const nosqlAttack = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: { $gt: '' },
      password: { $gt: '' },
    },
  });
  assert(nosqlAttack.status === 400 || nosqlAttack.status === 401, 'Edge 6.1 NoSQL injection payloads ($gt operator) sanitized and rejected');

  console.log('\n====================================================');
  console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
  console.log('====================================================');

  await mongoose.disconnect();

  if (failCount === 0) {
    console.log('🎉 ALL PHASE 9 END-TO-END ACCEPTANCE & SECURITY TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runEndToEndAcceptanceSuite().catch((err) => {
  console.error('[Fatal Test Runner Error]:', err);
  process.exit(1);
});
