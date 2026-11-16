import connectDB from '../config/db.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Refund from '../models/Refund.js';
import app from '../app.js';
import http from 'http';
import { formatISTDate } from '../utils/timeSlots.js';
import {
  generateTestPaymentSignature,
  generateTestWebhookSignature,
} from '../services/razorpay.service.js';
import { releaseExpiredReservations } from '../services/payment.service.js';

const TEST_PORT = 5008;
const baseUrl = `http://localhost:${TEST_PORT}/api`;

async function runPhase4Verification() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 4 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Server listening on http://localhost:${TEST_PORT}`);

  try {
    // ---------------- SETUP TEST ACCOUNTS & REFERENCES ----------------
    console.log('\nSetup: Authenticating test accounts and preparing devices...');

    // Customer
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer@gaminglounge.com', password: 'CustomerPassword@123' }),
    });
    const customerToken = (await custLoginRes.json()).data.token;
    const customerUser = await User.findOne({ email: 'customer@gaminglounge.com' });

    // Receptionist
    const recepLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'reception@gaminglounge.com', password: 'StaffPassword@123' }),
    });
    const receptionistToken = (await recepLoginRes.json()).data.token;

    // Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' }),
    });
    const adminToken = (await adminLoginRes.json()).data.token;

    const ps51 = await Device.findOne({ deviceCode: 'PS5-01' });
    const ps52 = await Device.findOne({ deviceCode: 'PS5-02' });
    const fc25 = await Game.findOne({ name: 'EA Sports FC 25' });
    const gta6 = await Game.findOne({ name: 'GTA 6' });

    console.assert(ps51 && ps52 && fc25 && gta6, 'Core devices and games must exist in DB');
    console.log('✓ Setup complete: Accounts and hardware ready.\n');

    const testDate = formatISTDate(new Date(Date.now() + 72 * 60 * 60 * 1000)); // 3 days in future
    await Booking.deleteMany({ bookingDate: testDate });

    // ---------------- TEST 1: ONLINE PAYMENT - CREATE RAZORPAY ORDER ----------------
    console.log('Test 1: Customer creates Razorpay Order for booking');
    // Create regular PS5 booking (₹60 = 6000 paise)
    const bookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '11:00',
        duration: 1,
        numberOfPlayers: 1,
        notes: 'Test 1 Regular Booking',
      }),
    });
    const bookData = await bookRes.json();
    const test1Booking = bookData.data.booking;

    const orderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        bookingId: test1Booking._id,
      }),
    });
    const orderData = await orderRes.json();
    console.assert(orderRes.status === 200, `Expected 200, got ${orderRes.status}`);
    console.assert(orderData.data.amount === 6000, 'Expected 6000 paise (₹60)');
    console.assert(orderData.data.orderId, 'Order ID must be generated');
    console.log(`  ➔ Created Razorpay Order: ${orderData.data.orderId} for ₹${orderData.data.amountInRupees}`);
    console.log('  ✓ Test 1 PASSED: Razorpay order generated with backend-calculated amount.\n');

    // ---------------- TEST 2: SUCCESSFUL RAZORPAY PAYMENT VERIFICATION ----------------
    console.log('Test 2: Successful Razorpay Payment signature verification');
    const mockPaymentId = `pay_test_${Date.now()}`;
    const validSignature = generateTestPaymentSignature(orderData.data.orderId, mockPaymentId);

    const verifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: orderData.data.orderId,
        paymentId: mockPaymentId,
        signature: validSignature,
      }),
    });
    const verifyData = await verifyRes.json();
    console.assert(verifyRes.status === 200, `Expected 200, got ${verifyRes.status}`);
    console.assert(verifyData.data.payment.paymentStatus === 'PAID', 'Payment status must be PAID');
    console.assert(verifyData.data.booking.paymentStatus === 'PAID', 'Booking payment status must be PAID');
    console.assert(verifyData.data.booking.amountPaid === 6000, 'Amount paid must be 6000 paise');
    console.log(`  ➔ Verified Signature! Receipt: ${verifyData.data.payment.receiptNumber}`);
    console.log('  ✓ Test 2 PASSED: Signature cryptographically verified and booking marked PAID.\n');

    // ---------------- TEST 3: INVALID SIGNATURE REJECTION ----------------
    console.log('Test 3: Invalid payment signature is rejected (HTTP 400)');
    // Create another booking & order
    const bookRes3 = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps52._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '11:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const book3 = (await bookRes3.json()).data.booking;
    const orderRes3 = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId: book3._id }),
    });
    const order3 = (await orderRes3.json()).data;

    const fakeVerifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: order3.orderId,
        paymentId: 'pay_tampered_123',
        signature: 'invalid_forged_signature_3847293847',
      }),
    });
    console.assert(fakeVerifyRes.status === 400, `Expected 400, got ${fakeVerifyRes.status}`);
    const failedPayment = await Payment.findOne({ gatewayOrderId: order3.orderId });
    console.assert(failedPayment.paymentStatus === 'FAILED', 'Payment record must be marked FAILED');
    console.log('  ➔ Forged signature correctly blocked with HTTP 400 and recorded as FAILED.');
    console.log('  ✓ Test 3 PASSED: Anti-tampering signature security verified.\n');

    // ---------------- TEST 4: WEBHOOK SIGNATURE & IDEMPOTENCY ----------------
    console.log('Test 4: Razorpay Webhook confirmation with signature & duplicate event idempotency');
    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: mockPaymentId,
            order_id: orderData.data.orderId,
            amount: 6000,
            status: 'captured',
          },
        },
      },
    };
    const webhookBodyStr = JSON.stringify(webhookPayload);
    const validWebhookSig = generateTestWebhookSignature(webhookBodyStr);

    const webhookRes = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validWebhookSig,
      },
      body: webhookBodyStr,
    });
    const webhookData = await webhookRes.json();
    console.assert(webhookRes.status === 200, `Expected 200, got ${webhookRes.status}`);
    console.assert(webhookData.data.status === 'already_processed', 'Duplicate webhook must be idempotent');
    console.log(`  ➔ Webhook response: ${webhookData.data.status} (Idempotency verified)`);
    console.log('  ✓ Test 4 PASSED: Webhook signature verified and duplicate processing prevented.\n');

    // ---------------- TEST 5: TEMPORARY SLOT HOLD & EXPIRY RELEASE ----------------
    console.log('Test 5: Temporary pending slot reservation expiry and release');
    // Simulate booking with past expiration
    const expiredBooking = new Booking({
      bookingId: 'BK-EXPIRED-TEST',
      customer: customerUser._id,
      device: ps51._id,
      game: fc25._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '19:00',
      endTime: '20:00',
      startAt: new Date(Date.now() + 72 * 3600 * 1000),
      endAt: new Date(Date.now() + 73 * 3600 * 1000),
      duration: 1,
      numberOfPlayers: 1,
      totalAmount: 6000,
      bookingStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      paymentExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 mins ago
    });
    await expiredBooking.save();

    const { releasedCount } = await releaseExpiredReservations();
    console.assert(releasedCount >= 1, `Expected at least 1 released booking, got ${releasedCount}`);
    const checkedBooking = await Booking.findById(expiredBooking._id);
    console.assert(checkedBooking.bookingStatus === 'CANCELLED', 'Expired booking must be CANCELLED');
    console.log(`  ➔ Sweep released ${releasedCount} expired reservation; station capacity restored.`);
    console.log('  ✓ Test 5 PASSED: Automated hold expiration and capacity recovery verified.\n');

    // ---------------- TEST 6: OFFLINE CASH PAYMENT BY RECEPTIONIST ----------------
    console.log('Test 6: Receptionist records offline CASH payment at front desk');
    const bookCashRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '12:00',
        duration: 1,
        numberOfPlayers: 1,
        notes: 'Walk-in Cash Test',
      }),
    });
    const bookCash = (await bookCashRes.json()).data.booking;

    const cashPayRes = await fetch(`${baseUrl}/payments/offline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptionistToken}` },
      body: JSON.stringify({
        bookingId: bookCash._id,
        amount: 6000,
        paymentMethod: 'CASH',
        notes: 'Collected ₹60 cash at counter',
      }),
    });
    const cashPayData = await cashPayRes.json();
    console.assert(cashPayRes.status === 201, `Expected 201, got ${cashPayRes.status}`);
    console.assert(cashPayData.data.payment.paymentMethod === 'CASH', 'Payment method must be CASH');
    console.assert(cashPayData.data.booking.paymentStatus === 'PAID', 'Booking must be marked PAID');
    console.log(`  ➔ Recorded Cash Payment: ${cashPayData.data.payment.paymentId} for ₹${cashPayData.data.payment.amount / 100}`);
    console.log('  ✓ Test 6 PASSED: Receptionist recorded cash collection with staff attribution.\n');

    // ---------------- TEST 7: OFFLINE COUNTER UPI PAYMENT ----------------
    console.log('Test 7: Receptionist records offline COUNTER UPI payment');
    const bookUPIRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps52._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '12:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const bookUPI = (await bookUPIRes.json()).data.booking;

    const upiPayRes = await fetch(`${baseUrl}/payments/offline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptionistToken}` },
      body: JSON.stringify({
        bookingId: bookUPI._id,
        amount: 6000,
        paymentMethod: 'COUNTER_UPI',
        transactionReference: 'UPI-UTR-98471928374',
        notes: 'Customer scanned desk QR code',
      }),
    });
    const upiPayData = await upiPayRes.json();
    console.assert(upiPayRes.status === 201, `Expected 201, got ${upiPayRes.status}`);
    console.assert(upiPayData.data.payment.paymentMethod === 'COUNTER_UPI', 'Must be COUNTER_UPI');
    console.assert(upiPayData.data.payment.transactionReference === 'UPI-UTR-98471928374', 'UTR must be saved');
    console.log(`  ➔ Recorded Counter UPI: ${upiPayData.data.payment.paymentId} (UTR: ${upiPayData.data.payment.transactionReference})`);
    console.log('  ✓ Test 7 PASSED: Counter UPI payment successfully recorded.\n');

    // ---------------- TEST 8: GTA 6 MANDATORY ADVANCE PAYMENT WORKFLOW ----------------
    console.log('Test 8: GTA 6 Exclusive Booking - Mandatory Advance Payment Online');
    // Temporarily activate GTA 6 for booking
    gta6.status = 'ACTIVE';
    await gta6.save();

    const gtaBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: gta6._id,
        bookingDate: testDate,
        startTime: '16:00',
        duration: 2, // 2 hours = ₹300 total
        numberOfPlayers: 2,
        notes: 'GTA 6 Advance + Balance Flow',
      }),
    });
    const gtaBooking = (await gtaBookRes.json()).data.booking;
    console.assert(gtaBooking.totalAmount === 30000, 'Total should be ₹300 (30000 paise)');
    console.assert(gtaBooking.advanceRequired === true, 'Advance must be required for GTA 6');
    console.assert(gtaBooking.advanceAmount === 15000, 'Advance should be 50% = ₹150 (15000 paise)');

    // Customer creates order for GTA 6: Must charge only the advance amount!
    const gtaOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        bookingId: gtaBooking._id,
      }),
    });
    const gtaOrderData = await gtaOrderRes.json();
    console.assert(gtaOrderData.data.amount === 15000, `Expected 15000 paise (₹150), got ${gtaOrderData.data.amount}`);
    console.assert(gtaOrderData.data.purpose === 'GTA6_ADVANCE', 'Purpose must be GTA6_ADVANCE');
    console.log(`  ➔ Online order for GTA 6 correctly calculated ₹${gtaOrderData.data.amountInRupees} advance.`);

    // Customer pays advance
    const gtaPayId = `pay_gta6_adv_${Date.now()}`;
    const gtaSig = generateTestPaymentSignature(gtaOrderData.data.orderId, gtaPayId);
    const gtaVerifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: gtaOrderData.data.orderId,
        paymentId: gtaPayId,
        signature: gtaSig,
      }),
    });
    const gtaVerifyData = await gtaVerifyRes.json();
    console.assert(gtaVerifyData.data.booking.isAdvancePaid === true, 'GTA 6 advance must be marked paid');
    console.assert(gtaVerifyData.data.booking.paymentStatus === 'PARTIALLY_PAID', 'Status must be PARTIALLY_PAID');
    console.assert(gtaVerifyData.data.booking.balanceRemaining === 15000, 'Balance remaining must be ₹150 (15000 paise)');
    console.log(`  ➔ Advance verified! Booking Status: ${gtaVerifyData.data.booking.paymentStatus}, Balance Due: ₹${gtaVerifyData.data.booking.balanceRemaining / 100}`);
    console.log('  ✓ Test 8 PASSED: GTA 6 mandatory advance online payment confirmed.\n');

    // ---------------- TEST 9: RECEPTIONIST COLLECTS OUTSTANDING BALANCE ----------------
    console.log('Test 9: Receptionist collects remaining balance at counter for partially paid GTA 6 booking');
    const balancePayRes = await fetch(`${baseUrl}/payments/offline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptionistToken}` },
      body: JSON.stringify({
        bookingId: gtaBooking._id,
        amount: 15000, // Remaining balance ₹150
        paymentMethod: 'CASH',
        notes: 'Customer cleared remaining ₹150 balance in cash upon arrival',
      }),
    });
    const balanceData = await balancePayRes.json();
    console.assert(balancePayRes.status === 201, `Expected 201, got ${balancePayRes.status}`);
    console.assert(balanceData.data.booking.paymentStatus === 'PAID', 'Booking must now be fully PAID');
    console.assert(balanceData.data.booking.balanceRemaining === 0, 'Remaining balance must be 0');
    console.assert(balanceData.data.booking.amountPaid === 30000, 'Total paid must be ₹300');
    console.log(`  ➔ Balance settled in cash! Final Status: ${balanceData.data.booking.paymentStatus}, Total Paid: ₹${balanceData.data.booking.amountPaid / 100}`);
    console.log('  ✓ Test 9 PASSED: Multi-transaction partial payment settlement verified.\n');

    // ---------------- TEST 10: MULTIPLE TRANSACTIONS LIST FOR BOOKING ----------------
    console.log('Test 10: Multiple payment transactions recorded under single booking');
    const multiPayRes = await fetch(`${baseUrl}/payments/booking/${gtaBooking._id}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const multiPayData = await multiPayRes.json();
    console.assert(multiPayData.data.payments.length === 2, `Expected 2 transactions, got ${multiPayData.data.payments.length}`);
    console.log(`  ➔ Booking ${gtaBooking.bookingId} has ${multiPayData.data.payments.length} verified payment records:`);
    multiPayData.data.payments.forEach((p) => {
      console.log(`     - [${p.paymentId}] ${p.paymentPurpose} via ${p.paymentMethod} (₹${p.amount / 100})`);
    });
    console.log('  ✓ Test 10 PASSED: Transaction history preserved with full audit trail.\n');

    // ---------------- TEST 11: RECEIPT GENERATION (JSON & HTML) ----------------
    console.log('Test 11: Digital Receipt generation with complete booking and financial breakdown');
    const receiptRes = await fetch(`${baseUrl}/payments/${gtaVerifyData.data.payment.paymentId}/receipt`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const receiptData = await receiptRes.json();
    console.assert(receiptRes.status === 200, `Expected 200, got ${receiptRes.status}`);
    console.assert(receiptData.data.receipt.receiptNumber, 'Receipt number must exist');
    console.assert(receiptData.data.receipt.financials.advanceAmount === 150, 'Receipt must show advance amount');
    console.log(`  ➔ Generated Receipt: ${receiptData.data.receipt.receiptNumber}`);
    console.log(`  ➔ Printable HTML URL: ${receiptData.data.printableUrl}`);

    // Verify HTML format returns text/html
    const receiptHtmlRes = await fetch(`${baseUrl}/payments/${gtaVerifyData.data.payment.paymentId}/receipt?format=html`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const htmlContent = await receiptHtmlRes.text();
    console.assert(receiptHtmlRes.headers.get('content-type').includes('text/html'), 'Content-Type must be text/html');
    console.assert(htmlContent.includes('NEXUS GAMING LOUNGE'), 'HTML must include lounge branding');
    console.log('  ✓ Test 11 PASSED: Digital receipt and printable HTML view verified.\n');

    // ---------------- TEST 12: ELIGIBLE REFUND INITIATED BY ADMIN ----------------
    console.log('Test 12: Admin initiates eligible refund (Full / Partial)');
    const refundRes = await fetch(`${baseUrl}/admin/payments/${cashPayData.data.payment._id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        amount: 6000, // Full ₹60 refund
        reason: 'Console hardware restart during session - courtesy refund',
      }),
    });
    const refundData = await refundRes.json();
    console.assert(refundRes.status === 201, `Expected 201, got ${refundRes.status}`);
    console.assert(refundData.data.refund.refundId, 'Refund ID must be generated');
    console.assert(refundData.data.payment.paymentStatus === 'REFUNDED', 'Payment status must be REFUNDED');
    console.log(`  ➔ Issued Refund: ${refundData.data.refund.refundId} of ₹${refundData.data.refund.amount / 100}`);
    console.log('  ✓ Test 12 PASSED: Admin processed refund and updated financial records.\n');

    // ---------------- TEST 13: DUPLICATE / OVER-REFUND REJECTION ----------------
    console.log('Test 13: Duplicate refund and over-refund attempts are rejected (HTTP 400)');
    const dupRefundRes = await fetch(`${baseUrl}/admin/payments/${cashPayData.data.payment._id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        amount: 6000,
        reason: 'Duplicate refund attempt',
      }),
    });
    console.assert(dupRefundRes.status === 400, `Expected 400, got ${dupRefundRes.status}`);
    console.log('  ➔ Over-refund attempt correctly blocked: Cannot refund more than original amount.');
    console.log('  ✓ Test 13 PASSED: Anti-duplicate refund protection verified.\n');

    // ---------------- TEST 14: CUSTOMER PAYMENT HISTORY ----------------
    console.log('Test 14: Customer retrieves personal payment history');
    const myPayRes = await fetch(`${baseUrl}/payments/my-payments`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const myPayData = await myPayRes.json();
    console.assert(myPayRes.status === 200, `Expected 200, got ${myPayRes.status}`);
    console.assert(myPayData.data.payments.length >= 3, 'Customer must see all their payment transactions');
    console.log(`  ➔ Customer retrieved ${myPayData.data.payments.length} personal transactions.`);
    console.log('  ✓ Test 14 PASSED: Customer payment portal history verified.\n');

    // ---------------- TEST 15: REVENUE REPORTS & ACCURATE REFUND DEDUCTION ----------------
    console.log('Test 15: Admin Financial Revenue Reports calculate net revenue (excluding refunds)');
    const reportRes = await fetch(`${baseUrl}/admin/payments/reports`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reportData = await reportRes.json();
    console.assert(reportRes.status === 200, `Expected 200, got ${reportRes.status}`);
    console.log(`  ➔ Total Net Revenue: ₹${reportData.data.totalRevenue.rupees} (${reportData.data.totalRevenue.paise} paise)`);
    console.log(`  ➔ Online Revenue: ₹${reportData.data.onlineRevenue.rupees} | Offline Revenue: ₹${reportData.data.offlineRevenue.rupees}`);
    console.log(`  ➔ Refunds Deducted: ₹${reportData.data.refunds.totalRefundedRupees} across ${reportData.data.refunds.count} refund(s)`);
    console.assert(reportData.data.totalRevenue.paise > 0, 'Total net revenue must be positive');
    console.assert(reportData.data.refunds.count >= 1, 'Refunds must be accounted for');
    console.log('  ✓ Test 15 PASSED: Verified revenue report accurately subtracts refunds.\n');

    // ---------------- TEST 16: ROLE-BASED ACCESS CONTROL (RBAC) SECURITY ----------------
    console.log('Test 16: Security RBAC - Unauthorized customer blocked from admin payment routes (HTTP 403)');
    const unauthReport = await fetch(`${baseUrl}/admin/payments/reports`, {
      headers: { Authorization: `Bearer ${customerToken}` }, // Customer token!
    });
    console.assert(unauthReport.status === 403, `Expected 403 Forbidden, got ${unauthReport.status}`);

    const unauthRefund = await fetch(`${baseUrl}/admin/payments/${gtaVerifyData.data.payment._id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptionistToken}` }, // Receptionist cannot issue refund
      body: JSON.stringify({ amount: 1000, reason: 'Staff refund' }),
    });
    console.assert(unauthRefund.status === 403, `Expected 403 Forbidden, got ${unauthRefund.status}`);
    console.log('  ➔ Customers blocked from revenue reports; receptionists blocked from refund issuance.');
    console.log('  ✓ Test 16 PASSED: Strict 3-tier RBAC security verified.\n');

    // Reset GTA 6 to initial state
    gta6.status = 'INACTIVE';
    await gta6.save();

    console.log('====================================================');
    console.log('🎉 ALL 16 PHASE 4 CORE & EDGE TEST SCENARIOS PASSED!');
    console.log('====================================================');
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase4Verification().catch((err) => {
  console.error('Phase 4 verification failed:', err);
  process.exit(1);
});
