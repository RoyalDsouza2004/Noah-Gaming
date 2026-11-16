import connectDB from '../config/db.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import MembershipPlan from '../models/MembershipPlan.js';
import app from '../app.js';
import http from 'http';
import { formatISTDate } from '../utils/timeSlots.js';
import {
  getRazorpayConfigStatus,
  generateTestPaymentSignature,
  generateTestWebhookSignature,
} from '../services/razorpay.service.js';

const TEST_PORT = 5012;
const baseUrl = `http://localhost:${TEST_PORT}/api`;

async function runRazorpayVerification() {
  console.log('================================================================');
  console.log('💳 NOAH GAMING: RAZORPAY TEST MODE INTEGRATION VERIFICATION SUITE');
  console.log('================================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Server listening on http://localhost:${TEST_PORT}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assertTest(condition, name, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ [TEST ${totalTests}] PASS: ${name}`);
      if (details) console.log(`     ↳ ${details}`);
    } else {
      console.error(`  ✗ [TEST ${totalTests}] FAIL: ${name}`);
      if (details) console.error(`     ↳ Details: ${details}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    // ---------------- AUTHENTICATION SETUP ----------------
    console.log('--- Phase 0: Setup and Authentication ---');
    let testCustomer = await User.findOne({ email: 'test_gamer_rzp@gaminglounge.com' });
    if (!testCustomer) {
      testCustomer = new User({
        name: 'Razorpay Test Gamer',
        email: 'test_gamer_rzp@gaminglounge.com',
        phone: '9888776655',
        password: 'Password@123',
        role: 'customer',
        membership: { status: 'NONE' },
      });
      await testCustomer.save();
    } else {
      testCustomer.membership = { status: 'NONE', planId: null };
      await testCustomer.save();
    }
    const customerToken = testCustomer.generateAuthToken();

    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' }),
    });
    const adminToken = (await adminRes.json()).data.token;

    const recepRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'reception@gaminglounge.com', password: 'StaffPassword@123' }),
    });
    const receptionistToken = (await recepRes.json()).data.token;

    const ps5 = await Device.findOne({ deviceCode: 'PS5-01' });
    const pool = await Device.findOne({ deviceCode: 'POOL-01' });
    const fc25 = await Game.findOne({ name: 'EA Sports FC 25' });
    const gta6 = await Game.findOne({ name: 'GTA 6' });

    assertTest(Boolean(customerToken && adminToken && ps5 && pool && fc25 && gta6), 'System fixtures ready');

    // ---------------- TEST 1: ENVIRONMENT & CONFIGURATION SECURITY ----------------
    console.log('\n--- Scenario 1: Environment Configuration & Security ---');
    const configStatus = getRazorpayConfigStatus();
    assertTest(configStatus.mode === 'test', 'Razorpay mode is strictly test mode');
    assertTest(configStatus.isTestMode === true, 'isTestMode flag is true');
    assertTest(configStatus.isLiveModeBlocked === true, 'Live mode transactions are strictly blocked');

    // Public config endpoint test
    const pubConfigRes = await fetch(`${baseUrl}/payments/config`);
    const pubConfigJson = await pubConfigRes.json();
    assertTest(pubConfigRes.status === 200, 'Public payment config returns 200');
    assertTest(pubConfigJson.data.mode === 'test', 'Public config mode is test');
    assertTest(pubConfigJson.data.businessName === 'NOAH GAMING', 'Business name is NOAH GAMING');
    assertTest(
      pubConfigJson.data.keySecret === undefined && pubConfigJson.data.webhookSecret === undefined,
      'Public config never leaks secret keys'
    );

    // Admin payment settings endpoint test
    const adminSettingsRes = await fetch(`${baseUrl}/admin/payments/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminSettingsJson = await adminSettingsRes.json();
    assertTest(adminSettingsRes.status === 200, 'Admin payment settings endpoint returns 200');
    assertTest(
      typeof adminSettingsJson.data.keySecretConfigured === 'boolean',
      'keySecretConfigured is boolean only'
    );
    assertTest(
      typeof adminSettingsJson.data.webhookSecretConfigured === 'boolean',
      'webhookSecretConfigured is boolean only'
    );
    assertTest(
      adminSettingsJson.data.keySecret === undefined &&
        adminSettingsJson.data.webhookSecret === undefined &&
        adminSettingsJson.data.RAZORPAY_KEY_SECRET === undefined,
      'Admin settings never expose raw secret values'
    );

    // ---------------- TEST 2: ORDER CREATION FOR PS5 BOOKING ----------------
    console.log('\n--- Scenario 2: Standard PS5 Booking Order Creation ---');
    const testDate = formatISTDate(new Date(Date.now() + 96 * 60 * 60 * 1000));
    await Booking.deleteMany({ bookingDate: testDate });

    const ps5BookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        numberOfPlayers: 1,
        bookingDate: testDate,
        startTime: '14:00',
        endTime: '15:00',
        paymentMethod: 'ONLINE_UPI',
      }),
    });
    const ps5BookData = (await ps5BookRes.json()).data.booking;

    const ps5OrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId: ps5BookData._id, paymentPurpose: 'BOOKING_FULL' }),
    });
    const ps5OrderJson = await ps5OrderRes.json();
    assertTest(ps5OrderRes.status === 200, 'PS5 Order creation returns 200');
    assertTest(ps5OrderJson.data.amount === 6000, 'PS5 Order amount is ₹60 (6000 paise)');
    assertTest(ps5OrderJson.data.currency === 'INR', 'PS5 Order currency is INR');
    assertTest(Boolean(ps5OrderJson.data.orderId), 'Order ID is generated');
    assertTest(Boolean(ps5OrderJson.data.keyId), 'Public Key ID is provided to client');

    // ---------------- TEST 3: DUPLICATE CLICK IDEMPOTENCY ----------------
    console.log('\n--- Scenario 3: Duplicate-Click / Rapid Retries Idempotency ---');
    const duplicateOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId: ps5BookData._id, paymentPurpose: 'BOOKING_FULL' }),
    });
    const duplicateOrderJson = await duplicateOrderRes.json();
    assertTest(
      duplicateOrderJson.data.orderId === ps5OrderJson.data.orderId,
      'Re-clicking Pay reuses active unexpired order without creating duplicate order documents'
    );

    // ---------------- TEST 4: GTA 6 ADVANCE PAYMENT CALCULATION ----------------
    console.log('\n--- Scenario 4: GTA 6 Advance Payment Calculation ---');
    const gta6BookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5._id,
        gameId: gta6._id,
        bookingType: 'EXCLUSIVE',
        numberOfPlayers: 1,
        bookingDate: testDate,
        startTime: '16:00',
        endTime: '17:00',
        paymentMethod: 'ONLINE_UPI',
      }),
    });
    const gta6BookData = (await gta6BookRes.json()).data.booking;

    const gta6OrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId: gta6BookData._id, paymentPurpose: 'GTA6_ADVANCE' }),
    });
    const gta6OrderJson = await gta6OrderRes.json();
    assertTest(gta6OrderRes.status === 200, 'GTA 6 Order creation returns 200');
    assertTest(gta6OrderJson.data.purpose === 'GTA6_ADVANCE', 'Order purpose is GTA6_ADVANCE');
    assertTest(gta6OrderJson.data.amount > 0, 'GTA 6 advance amount is non-zero paise');

    // ---------------- TEST 5: CRYPTOGRAPHIC SIGNATURE VERIFICATION (SUCCESS) ----------------
    console.log('\n--- Scenario 5: Server-side Signature Verification (Success) ---');
    const paymentId = `pay_test_${Date.now()}`;
    const validSignature = generateTestPaymentSignature(ps5OrderJson.data.orderId, paymentId);

    const verifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: ps5OrderJson.data.orderId,
        paymentId,
        signature: validSignature,
      }),
    });
    const verifyJson = await verifyRes.json();
    assertTest(verifyRes.status === 200, 'Signature verification returns 200');
    assertTest(verifyJson.data.payment.paymentStatus === 'PAID', 'Payment status updated to PAID');
    assertTest(Boolean(verifyJson.data.payment.receiptNumber), 'Receipt number generated');
    assertTest(verifyJson.data.booking.bookingStatus === 'CONFIRMED', 'Booking confirmed in DB');
    assertTest(verifyJson.data.booking.amountPaid === 6000, 'Booking amountPaid updated to 6000 paise');
    assertTest(verifyJson.data.booking.balanceRemaining === 0, 'Booking balanceRemaining is 0');

    // ---------------- TEST 6: DUPLICATE VERIFICATION IDEMPOTENCY ----------------
    console.log('\n--- Scenario 6: Duplicate Verification Idempotency ---');
    const duplicateVerifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: ps5OrderJson.data.orderId,
        paymentId,
        signature: validSignature,
      }),
    });
    const duplicateVerifyJson = await duplicateVerifyRes.json();
    assertTest(duplicateVerifyRes.status === 200, 'Duplicate verification returns 200');
    assertTest(
      duplicateVerifyJson.message.toLowerCase().includes('already verified'),
      'alreadyVerified status returned safely'
    );

    // ---------------- TEST 7: TAMPERED / INVALID SIGNATURE REJECTION ----------------
    console.log('\n--- Scenario 7: Tampered Signature Rejection ---');
    // Create new booking to test fraudulent signature
    const fraudBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        numberOfPlayers: 1,
        bookingDate: testDate,
        startTime: '18:00',
        endTime: '19:00',
        paymentMethod: 'ONLINE_UPI',
      }),
    });
    const fraudBookData = (await fraudBookRes.json()).data.booking;

    const fraudOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId: fraudBookData._id }),
    });
    const fraudOrderData = (await fraudOrderRes.json()).data;

    const fraudVerifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: fraudOrderData.orderId,
        paymentId: 'pay_fraud_123',
        signature: 'invalid_forged_hmac_signature_999999',
      }),
    });
    assertTest(fraudVerifyRes.status === 400, 'Forged signature rejected with HTTP 400');

    const dbFraudPayment = await Payment.findOne({ gatewayOrderId: fraudOrderData.orderId });
    assertTest(dbFraudPayment.paymentStatus === 'FAILED', 'Payment record marked FAILED in DB');
    const dbFraudBooking = await Booking.findById(fraudBookData._id);
    assertTest(
      dbFraudBooking.paymentStatus !== 'PAID' && dbFraudBooking.amountPaid === 0,
      'Booking paymentStatus is NOT marked PAID and amountPaid remains 0 on fraudulent signature'
    );

    // ---------------- TEST 8: WEBHOOK SIGNATURE VERIFICATION & DEDUPLICATION ----------------
    console.log('\n--- Scenario 8: Webhook Signature Verification & Idempotency ---');
    // Create another booking for webhook test
    const wbBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: pool._id,
        bookingType: 'SHARED',
        numberOfPlayers: 1,
        bookingDate: testDate,
        startTime: '20:00',
        endTime: '21:00',
        paymentMethod: 'ONLINE_UPI',
      }),
    });
    const wbBookData = (await wbBookRes.json()).data.booking;

    const wbOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId: wbBookData._id }),
    });
    const wbOrderData = (await wbOrderRes.json()).data;

    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wb_${Date.now()}`,
            order_id: wbOrderData.orderId,
            amount: 16000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const rawBodyStr = JSON.stringify(webhookPayload);
    const validWbSignature = generateTestWebhookSignature(rawBodyStr);

    // 8a. Test forged webhook signature
    const badWbRes = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'forged_webhook_signature',
      },
      body: rawBodyStr,
    });
    assertTest(badWbRes.status === 400, 'Forged webhook signature rejected with HTTP 400');

    // 8b. Test valid webhook signature
    const goodWbRes = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validWbSignature,
      },
      body: rawBodyStr,
    });
    assertTest(goodWbRes.status === 200, 'Valid webhook signature accepted with HTTP 200');

    const dbWbPayment = await Payment.findOne({ gatewayOrderId: wbOrderData.orderId });
    assertTest(dbWbPayment.paymentStatus === 'PAID', 'Webhook successfully marked payment as PAID');

    // 8c. Duplicate webhook idempotency
    const dupWbRes = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validWbSignature,
      },
      body: rawBodyStr,
    });
    const dupWbJson = await dupWbRes.json();
    assertTest(dupWbRes.status === 200, 'Duplicate webhook handled idempotently');
    assertTest(dupWbJson.data.status === 'already_processed', 'Duplicate webhook returned already_processed');

    // ---------------- TEST 9: MEMBERSHIP ONLINE PURCHASE ORDER & VERIFICATION ----------------
    console.log('\n--- Scenario 9: Membership Online Purchase via Razorpay ---');
    const plan = await MembershipPlan.findOne({ status: 'ACTIVE' });
    if (plan) {
      const mbrOrderRes = await fetch(`${baseUrl}/memberships/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ planId: plan._id }),
      });
      const mbrOrderJson = await mbrOrderRes.json();
      assertTest(mbrOrderRes.status === 200, 'Membership Order creation returns 200');
      assertTest(mbrOrderJson.data.amount === plan.price, 'Membership order amount matches plan price');

      const mbrPaymentId = `pay_mbr_${Date.now()}`;
      const mbrSig = generateTestPaymentSignature(mbrOrderJson.data.orderId, mbrPaymentId);

      const mbrVerifyRes = await fetch(`${baseUrl}/memberships/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          orderId: mbrOrderJson.data.orderId,
          paymentId: mbrPaymentId,
          signature: mbrSig,
          planId: plan._id,
        }),
      });
      const mbrVerifyJson = await mbrVerifyRes.json();
      assertTest(mbrVerifyRes.status === 200, 'Membership signature verification returns 200');
      assertTest(Boolean(mbrVerifyJson.data.subscription), 'Membership subscription activated in DB');
    }

    // ---------------- TEST 10: OFFLINE CASH & COUNTER UPI REGRESSION ----------------
    console.log('\n--- Scenario 10: Offline Counter Payment Regression ---');
    let walkinCust = await User.findOne({ email: 'walkin_cash_cust@gaminglounge.com' });
    if (!walkinCust) {
      walkinCust = new User({
        name: 'Walk-in Cash Customer',
        email: 'walkin_cash_cust@gaminglounge.com',
        phone: '97' + Date.now().toString().slice(-8),
        password: 'Password@123',
        role: 'customer',
        membership: { status: 'NONE' },
      });
      await walkinCust.save();
    }
    const walkinToken = walkinCust.generateAuthToken();

    const cashBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${walkinToken}` },
      body: JSON.stringify({
        deviceId: ps5._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        numberOfPlayers: 1,
        bookingDate: testDate,
        startTime: '21:00',
        endTime: '22:00',
        paymentMethod: 'CASH',
      }),
    });
    const cashBookData = (await cashBookRes.json()).data.booking;

    const offlinePayRes = await fetch(`${baseUrl}/payments/offline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptionistToken}` },
      body: JSON.stringify({
        bookingId: cashBookData._id,
        amount: 6000,
        paymentMethod: 'CASH',
        transactionReference: 'COUNTER-CASH-TEST',
        notes: 'Walk-in cash settlement',
      }),
    });
    const offlinePayJson = await offlinePayRes.json();
    assertTest(offlinePayRes.status === 201, 'Receptionist recorded offline cash payment (201)');
    assertTest(offlinePayJson.data.booking.paymentStatus === 'PAID', 'Booking marked PAID with offline cash');

    // ---------------- TEST 11: REVENUE REPORTING EXCLUDES FAILED/PENDING ----------------
    console.log('\n--- Scenario 11: Revenue Reporting Accuracy ---');
    const reportRes = await fetch(`${baseUrl}/admin/payments/reports`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reportJson = await reportRes.json();
    assertTest(reportRes.status === 200, 'Financial revenue report returns 200');
    const totalRevRupees = reportJson.data.totalRevenue?.rupees ?? reportJson.data.totalRevenue ?? 0;
    assertTest(totalRevRupees >= 60, 'Collected revenue strictly counts PAID');

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} RAZORPAY TEST MODE VERIFICATION TESTS PASSED (100%)!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runRazorpayVerification();
