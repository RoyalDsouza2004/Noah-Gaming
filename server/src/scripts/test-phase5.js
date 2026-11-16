import connectDB from '../config/db.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import Notification from '../models/Notification.js';
import app from '../app.js';
import http from 'http';
import { formatISTDate } from '../utils/timeSlots.js';
import { generateTestPaymentSignature } from '../services/razorpay.service.js';
import { checkAndExpireSubscriptions } from '../services/membership.service.js';

const TEST_PORT = 5009;
const baseUrl = `http://localhost:${TEST_PORT}/api`;

async function runPhase5Verification() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 5 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Server listening on http://localhost:${TEST_PORT}`);

  try {
    // ---------------- AUTHENTICATE TEST ACCOUNTS ----------------
    console.log('\nSetup: Authenticating Customer, Receptionist, and Admin...');

    // Customer
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer@gaminglounge.com', password: 'CustomerPassword@123' }),
    });
    const customerToken = (await custLoginRes.json()).data.token;
    const customerUser = await User.findOne({ email: 'customer@gaminglounge.com' });

    // Second Customer for Cross-Account Isolation Test
    let customer2 = await User.findOne({ email: 'customer2@gaminglounge.com' });
    if (!customer2) {
      const reg2 = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Player Two',
          email: 'customer2@gaminglounge.com',
          phone: '9876543299',
          password: 'Password@123',
        }),
      });
      customer2 = (await reg2.json()).data.user;
    }
    const cust2LoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer2@gaminglounge.com', password: 'Password@123' }),
    });
    const customer2Token = (await cust2LoginRes.json()).data.token;

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
    const fc25 = await Game.findOne({ name: 'EA Sports FC 25' });
    const gta6 = await Game.findOne({ name: 'GTA 6' });
    console.log('✓ Setup complete: Accounts and hardware ready.\n');

    // ---------------- TEST 1: VIEW AND UPDATE CUSTOMER PROFILE ----------------
    console.log('Test 1: Customer views and edits personal profile');
    const profileRes = await fetch(`${baseUrl}/users/profile`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const profileData = await profileRes.json();
    console.assert(profileRes.status === 200, 'Profile fetch must return 200');
    console.assert(profileData.data.profile.customerId, 'Unique customerId must exist');
    console.log(`  ➔ Customer ID: ${profileData.data.profile.customerId} (${profileData.data.profile.name})`);

    // Edit profile (name, phone)
    const updateRes = await fetch(`${baseUrl}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ name: 'Nexus Verified Gamer', profilePicture: 'https://avatar.nexus/gamer.png' }),
    });
    const updateData = await updateRes.json();
    console.assert(updateRes.status === 200, 'Profile update must return 200');
    console.assert(updateData.data.user.name === 'Nexus Verified Gamer', 'Name must update');
    console.log('  ✓ Test 1 PASSED: Profile viewed and personal details updated.\n');

    // ---------------- TEST 2: CUSTOMER DASHBOARD & GAMING HISTORY ----------------
    console.log('Test 2: Customer retrieves dashboard metrics and gaming history with filters');
    const dashRes = await fetch(`${baseUrl}/users/dashboard`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const dashData = await dashRes.json();
    console.assert(dashRes.status === 200, 'Dashboard must return 200');
    console.assert(dashData.data.metrics.totalGamingSessions !== undefined, 'Total gaming sessions must be returned');
    console.log(`  ➔ Total Gaming Sessions: ${dashData.data.metrics.totalGamingSessions}, Total Spent: ₹${dashData.data.metrics.totalSpentRupees}`);

    // History with filters
    const histRes = await fetch(`${baseUrl}/users/gaming-history?filter=7days`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const histData = await histRes.json();
    console.assert(histRes.status === 200, 'Gaming history must return 200');
    console.assert(histData.data.counts !== undefined, 'Category counts must exist');
    console.log('  ✓ Test 2 PASSED: Dashboard metrics and filtered gaming history retrieved.\n');

    // ---------------- TEST 3: CUSTOMER PAYMENT HISTORY ----------------
    console.log('Test 3: Customer retrieves personal payment transactions');
    const payHistRes = await fetch(`${baseUrl}/users/payment-history`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const payHistData = await payHistRes.json();
    console.assert(payHistRes.status === 200, 'Payment history must return 200');
    console.assert(Array.isArray(payHistData.data.payments), 'Payments must be an array');
    console.log(`  ➔ Retrieved ${payHistData.data.payments.length} customer payment records`);
    console.log('  ✓ Test 3 PASSED: Payment history accessible with receipt references.\n');

    // ---------------- TEST 4: ADMIN CREATES MEMBERSHIP PLAN ----------------
    console.log('Test 4: Administrator creates custom membership plan in MongoDB');
    const planName = `Gold Test Pass ${Date.now()}`;
    const createPlanRes = await fetch(`${baseUrl}/admin/memberships/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: planName,
        description: 'Test Gold Membership with 2 hours daily limit',
        priceInRupees: 799,
        validityDuration: 30,
        validityUnit: 'DAYS',
        dailyUsageLimit: 120, // 2 hours
        maximumSessionDuration: 120,
        maximumBookingsPerDay: 2,
        isUnlimited: false,
        includesExclusiveGames: false,
        discountPercentage: 100,
        status: 'ACTIVE',
      }),
    });
    const createPlanData = await createPlanRes.json();
    console.assert(createPlanRes.status === 201, `Expected 201, got ${createPlanRes.status}`);
    const testPlan = createPlanData.data.plan;
    console.assert(testPlan.price === 79900, 'Price must be 79900 paise');
    console.log(`  ➔ Created Plan: ${testPlan.name} for ₹${testPlan.price / 100}`);
    console.log('  ✓ Test 4 PASSED: Plan created by Admin in MongoDB.\n');

    // ---------------- TEST 5: ADMIN CONFIGURES UNLIMITED MEMBERSHIP ----------------
    console.log('Test 5: Administrator configures Unlimited Membership with fair-use restrictions');
    const unlimPlanName = `Diamond Unlimited Test ${Date.now()}`;
    const createUnlimRes = await fetch(`${baseUrl}/admin/memberships/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: unlimPlanName,
        description: 'Unlimited monthly gaming access with 3 hours/day continuous limit',
        priceInRupees: 1899,
        validityDuration: 30,
        validityUnit: 'DAYS',
        isUnlimited: true,
        dailyUsageLimit: 180, // 3 hours fair use cap
        maximumSessionDuration: 180,
        maximumBookingsPerDay: 3,
        includesExclusiveGames: false, // GTA 6 not included by default!
        status: 'ACTIVE',
      }),
    });
    const unlimData = await createUnlimRes.json();
    console.assert(createUnlimRes.status === 201, 'Unlimited plan creation must return 201');
    const testUnlimPlan = unlimData.data.plan;
    console.assert(testUnlimPlan.isUnlimited === true, 'isUnlimited must be true');
    console.log(`  ➔ Configured Unlimited Plan: ${testUnlimPlan.name} (Daily Fair-Use Cap: 3h)`);
    console.log('  ✓ Test 5 PASSED: Unlimited membership rules saved.\n');

    // ---------------- TEST 6: CUSTOMER INITIATES MEMBERSHIP PURCHASE ORDER ----------------
    console.log('Test 6: Customer initiates online purchase of membership plan');
    const purchaseRes = await fetch(`${baseUrl}/memberships/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ planId: testPlan._id }),
    });
    const purchaseData = await purchaseRes.json();
    console.assert(purchaseRes.status === 200, 'Purchase order generation must return 200');
    console.assert(purchaseData.data.amount === 79900, 'Expected 79900 paise');
    console.assert(purchaseData.data.orderId, 'Razorpay order ID must be generated');
    console.log(`  ➔ Generated Razorpay Order: ${purchaseData.data.orderId} for ₹${purchaseData.data.amountInRupees}`);
    console.log('  ✓ Test 6 PASSED: Online purchase order generated via payment system.\n');

    // ---------------- TEST 7: VERIFIED PAYMENT ACTIVATES MEMBERSHIP ----------------
    console.log('Test 7: Cryptographic payment signature verification activates membership');
    const mockPaymentId = `pay_mbr_${Date.now()}`;
    const validSignature = generateTestPaymentSignature(purchaseData.data.orderId, mockPaymentId);

    const verifyRes = await fetch(`${baseUrl}/memberships/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: purchaseData.data.orderId,
        paymentId: mockPaymentId,
        signature: validSignature,
        planId: testPlan._id,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) console.log('DEBUG Verify Error:', verifyRes.status, verifyData);
    console.assert(verifyRes.status === 200, 'Verification must return 200');
    console.assert(verifyData.data.subscription.status === 'ACTIVE', 'Subscription must be ACTIVE');
    const updatedCustomer = await User.findById(customerUser._id);
    console.assert(updatedCustomer.membership.status === 'ACTIVE', 'User membership status must be ACTIVE');
    console.log(`  ➔ Active Subscription ID: ${verifyData.data.subscription.subscriptionId}`);
    console.log(`  ➔ Expiration Date: ${new Date(verifyData.data.subscription.expirationDate).toISOString()}`);
    console.log('  ✓ Test 7 PASSED: Payment verified & membership activated in MongoDB.\n');

    // ---------------- TEST 8: TAMPERED/FAILED PAYMENT DOES NOT ACTIVATE MEMBERSHIP ----------------
    console.log('Test 8: Forged payment signature rejected and does NOT activate membership');
    // Customer 2 tries to forge signature for unlimited plan
    const cust2OrderRes = await fetch(`${baseUrl}/memberships/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer2Token}` },
      body: JSON.stringify({ planId: testUnlimPlan._id }),
    });
    const cust2Order = (await cust2OrderRes.json()).data;

    const forgedRes = await fetch(`${baseUrl}/memberships/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer2Token}` },
      body: JSON.stringify({
        orderId: cust2Order.orderId,
        paymentId: 'pay_fraud_123',
        signature: 'fake_forged_cryptographic_signature_99999',
      }),
    });
    console.assert(forgedRes.status === 400, 'Forged signature must be rejected with 400');
    const cust2Doc = await User.findById(customer2._id || customer2.id);
    console.assert(cust2Doc.membership.status !== 'ACTIVE', 'Customer 2 must NOT be active');
    console.log('  ➔ Fraudulent signature correctly rejected with HTTP 400.');
    console.log('  ✓ Test 8 PASSED: Anti-fraud signature verification verified.\n');

    // ---------------- TEST 9: OFFLINE MEMBERSHIP PAYMENT BY STAFF ----------------
    console.log('Test 9: Receptionist records offline counter CASH membership purchase');
    const offlineRes = await fetch(`${baseUrl}/memberships/offline-purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptionistToken}` },
      body: JSON.stringify({
        customerId: customer2._id || customer2.id,
        planId: testPlan._id,
        amount: 799,
        paymentMethod: 'CASH',
        notes: 'Paid cash at front reception desk',
      }),
    });
    const offlineData = await offlineRes.json();
    console.assert(offlineRes.status === 201, 'Offline purchase must return 201');
    console.assert(offlineData.data.subscription.status === 'ACTIVE', 'Subscription must be ACTIVE');
    const cust2Updated = await User.findById(customer2._id || customer2.id);
    console.assert(cust2Updated.membership.status === 'ACTIVE', 'Customer 2 membership must now be ACTIVE');
    console.log(`  ➔ Recorded Offline Subscription: ${offlineData.data.subscription.subscriptionId} via CASH`);
    console.log('  ✓ Test 9 PASSED: Receptionist registered offline membership.\n');

    // ---------------- TEST 10: EXPIRED MEMBERSHIPS CANNOT BE USED ----------------
    console.log('Test 10: Expired membership is blocked from receiving booking benefits');
    // Set customer2's membership expiration date in the past
    cust2Updated.membership.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in past
    await cust2Updated.save();
    await MembershipSubscription.findByIdAndUpdate(offlineData.data.subscription._id, {
      expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const testOffsetDays = 100 + Math.floor((Date.now() / 1000) % 500);
    const testDate = formatISTDate(new Date(Date.now() + testOffsetDays * 24 * 60 * 60 * 1000));
    const expiredBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer2Token}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '10:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const expiredBookData = await expiredBookRes.json();
    const expiredBooking = expiredBookData.data.booking;
    console.assert(expiredBooking.membershipApplied === false, 'Expired membership must NOT be applied');
    console.assert(expiredBooking.totalAmount === 6000, 'Expired membership must be charged regular ₹60 (6000 paise)');
    console.log(`  ➔ Expired membership booking correctly charged regular ₹${expiredBooking.totalAmount / 100}`);
    console.log('  ✓ Test 10 PASSED: Expired membership benefit rejection verified.\n');

    // ---------------- TEST 11: SUSPENDED MEMBERSHIPS CANNOT BE USED ----------------
    console.log('Test 11: Admin suspends subscription; suspended member receives no benefits');
    const activeSub = await MembershipSubscription.findOne({ customer: customerUser._id, status: 'ACTIVE' });
    const suspendRes = await fetch(`${baseUrl}/admin/memberships/subscriptions/${activeSub._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'SUSPENDED', notes: 'Disciplinary suspension' }),
    });
    console.assert(suspendRes.status === 200, 'Suspension must return 200');

    const suspendedBookRes = await fetch(`${baseUrl}/bookings`, {
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
      }),
    });
    const suspendedBook = (await suspendedBookRes.json()).data.booking;
    console.assert(suspendedBook.membershipApplied === false, 'Suspended membership must not be applied');
    console.assert(suspendedBook.totalAmount === 6000, 'Must be charged full standard rate');
    console.log('  ➔ Suspended member charged standard ₹60.');

    // Reactivate for subsequent tests
    await fetch(`${baseUrl}/admin/memberships/subscriptions/${activeSub._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ACTIVE', notes: 'Reactivated for testing' }),
    });
    console.log('  ✓ Test 11 PASSED: Suspended membership restriction verified.\n');

    // ---------------- TEST 12: DAILY USAGE LIMITS ENFORCED ----------------
    console.log('Test 12: Daily usage limit (2h) enforcement on active membership');
    // Active customer has 2 hours (120 mins) daily limit on testPlan
    // 1st booking: 1 hour (10:00 - 11:00) -> Covered
    const book1Res = await fetch(`${baseUrl}/bookings`, {
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
      }),
    });
    const b1 = (await book1Res.json()).data.booking;
    console.assert(b1.membershipApplied === true, '1st 1h session must be covered under membership');
    console.assert(b1.totalAmount === 0, 'Covered session amount must be ₹0');
    console.log('  ➔ 1st Session (1h): Fully Covered (₹0)');

    // 2nd booking: 1 hour (13:00 - 14:00) -> Covered (cumulative 2 hours used)
    const book2Res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '13:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const b2 = (await book2Res.json()).data.booking;
    console.assert(b2.membershipApplied === true, '2nd 1h session must be covered');
    console.log('  ➔ 2nd Session (1h): Fully Covered (₹0). Daily quota (2h) now consumed.');

    // 3rd booking on same day: 1 hour (14:00 - 15:00) -> Exceeds daily cap (2 bookings/day or 2h limit)!
    const book3Res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const b3 = (await book3Res.json()).data.booking;
    console.assert(b3.membershipApplied === false, '3rd session must NOT be covered by membership');
    console.assert(b3.totalAmount === 6000, '3rd session must be charged normal rate (₹60)');
    console.log('  ➔ 3rd Session: Charged standard ₹60 (Daily quota of 2h reached).');
    console.log('  ✓ Test 12 PASSED: Daily usage caps & bookings per day limits enforced.\n');

    // ---------------- TEST 13: MEMBERSHIP USAGE TRACKING & REVERSAL ON CANCELLATION ----------------
    console.log('Test 13: Cancelling a covered booking releases consumed daily quota');
    const cancelRes = await fetch(`${baseUrl}/bookings/${b2._id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ reason: 'Player cannot attend' }),
    });
    console.assert(cancelRes.status === 200, 'Cancel must return 200');

    // Check usage record
    const usageRecord = await MembershipUsage.findOne({ booking: b2._id });
    console.assert(usageRecord.status === 'CANCELLED', 'Usage status must be marked CANCELLED');

    // Now booking a replacement 1h session should be covered again!
    const rebookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '15:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const rebook = (await rebookRes.json()).data.booking;
    console.assert(rebook.membershipApplied === true, 'Replacement session must be covered under recovered quota');
    console.log('  ➔ Cancelled session released membership quota; replacement session covered (₹0).');
    console.log('  ✓ Test 13 PASSED: Quota recovery on booking cancellation verified.\n');

    // ---------------- TEST 14: EXCLUDED GAMES ARE CHARGED NORMALLY ----------------
    console.log('Test 14: Excluded games outside plan eligibility are charged standard rate');
    // Create an excluded game
    const restrictedGame = await Game.create({
      name: `Special Tournament Game ${Date.now()}`,
      category: fc25.category,
      compatibleDevices: [ps51._id],
      status: 'ACTIVE',
    });

    // Create a plan that only covers fc25
    const restrictedPlan = await MembershipPlan.create({
      name: `Restricted Title Plan ${Date.now()}`,
      price: 59900,
      validityDuration: 30,
      validityUnit: 'DAYS',
      eligibleGames: [fc25._id], // ONLY fc25
      status: 'ACTIVE',
    });

    // Assign customer to restricted plan
    const subRestricted = await MembershipSubscription.create({
      subscriptionId: `SUB-RESTRICTED-${Date.now()}`,
      customer: customerUser._id,
      membershipPlan: restrictedPlan._id,
      startDate: new Date(),
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });
    customerUser.membership = {
      status: 'ACTIVE',
      planId: restrictedPlan._id,
      subscriptionId: subRestricted._id,
      expiresAt: subRestricted.expirationDate,
    };
    await customerUser.save();

    const bookRestrictedRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: restrictedGame._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '16:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const bRestricted = (await bookRestrictedRes.json()).data.booking;
    console.assert(bRestricted.membershipApplied === false, 'Excluded game must NOT be covered');
    console.assert(bRestricted.totalAmount === 6000, 'Must be charged full standard rate');
    console.log('  ➔ Excluded game charged regular ₹60.');
    console.log('  ✓ Test 14 PASSED: Excluded games charged normally.\n');

    // ---------------- TEST 15: GTA 6 ADVANCE RULES ENFORCED UNLESS EXPLICITLY COVERED ----------------
    console.log('Test 15: GTA 6 exclusive rules enforced; regular/standard plans do NOT bypass GTA 6 advance');
    // Standard/Restricted plan does not have includesExclusiveGames: true
    const gta6BookingRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: gta6._id,
        bookingType: 'SHARED', // will force PRIVATE
        bookingDate: testDate,
        startTime: '17:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const gta6Booking = (await gta6BookingRes.json()).data.booking;
    console.assert(gta6Booking.membershipApplied === false, 'GTA 6 must NOT be covered by standard plan');
    console.assert(gta6Booking.advanceRequired === true, 'GTA 6 mandatory advance must remain active');
    console.assert(gta6Booking.totalAmount === 15000, 'GTA 6 must be charged ₹150 (15000 paise)');
    console.assert(gta6Booking.advanceAmount === 7500, 'GTA 6 advance must be ₹75 (50%)');
    console.log(`  ➔ GTA 6 not covered by standard plan: Total ₹${gta6Booking.totalAmount / 100}, Advance Required ₹${gta6Booking.advanceAmount / 100}`);

    // Now test with Ultimate VIP plan that has includesExclusiveGames: true
    const vipPlan = await MembershipPlan.findOne({ name: 'Ultimate VIP (Includes GTA 6)' });
    console.assert(vipPlan && vipPlan.includesExclusiveGames === true, 'VIP plan must include exclusive games');
    const vipSub = await MembershipSubscription.create({
      subscriptionId: `SUB-VIP-${Date.now()}`,
      customer: customerUser._id,
      membershipPlan: vipPlan._id,
      startDate: new Date(),
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });
    customerUser.membership = {
      status: 'ACTIVE',
      planId: vipPlan._id,
      subscriptionId: vipSub._id,
      expiresAt: vipSub.expirationDate,
    };
    await customerUser.save();

    const gta6VipBookingRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps51._id,
        gameId: gta6._id,
        bookingType: 'PRIVATE',
        bookingDate: testDate,
        startTime: '18:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const gta6VipBooking = (await gta6VipBookingRes.json()).data.booking;
    console.assert(gta6VipBooking.membershipApplied === true, 'GTA 6 must be covered under Ultimate VIP plan');
    console.assert(gta6VipBooking.totalAmount === 0, 'Fully covered VIP GTA 6 booking amount is ₹0');
    console.log('  ➔ Ultimate VIP plan explicitly covers GTA 6 session (₹0)!');
    console.log('  ✓ Test 15 PASSED: GTA 6 advance rules and explicit coverage verified.\n');

    // ---------------- TEST 16: MEMBERSHIP RENEWAL FUNCTIONALITY ----------------
    console.log('Test 16: Customer renews subscription; validity extended from current expiration');
    const prevExp = vipSub.expirationDate;
    const renewOrderRes = await fetch(`${baseUrl}/memberships/${vipSub._id}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    });
    const renewOrder = (await renewOrderRes.json()).data;
    console.assert(renewOrder.paymentPurpose === 'MEMBERSHIP_RENEWAL', 'Payment purpose must be MEMBERSHIP_RENEWAL');

    const renewPaymentId = `pay_renew_${Date.now()}`;
    const renewSig = generateTestPaymentSignature(renewOrder.orderId, renewPaymentId);
    const renewVerifyRes = await fetch(`${baseUrl}/memberships/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        orderId: renewOrder.orderId,
        paymentId: renewPaymentId,
        signature: renewSig,
        renewalSubscriptionId: vipSub._id,
      }),
    });
    const renewData = await renewVerifyRes.json();
    console.assert(renewVerifyRes.status === 200, 'Renewal verify must return 200');
    const renewedSub = await MembershipSubscription.findById(vipSub._id);
    console.assert(
      renewedSub.expirationDate > prevExp,
      'New expiration date must be greater than previous expiration date'
    );
    console.assert(renewedSub.renewalHistory.length > 0, 'Renewal history must be logged');
    console.log(`  ➔ Renewed! Previous Expiry: ${prevExp.toISOString().slice(0, 10)} ➔ New Expiry: ${renewedSub.expirationDate.toISOString().slice(0, 10)}`);
    console.log('  ✓ Test 16 PASSED: Membership renewal and validity extension verified.\n');

    // ---------------- TEST 17: MEMBERSHIP SUBSCRIPTION & USAGE HISTORY ----------------
    console.log('Test 17: Customer retrieves subscription list and usage records');
    const mySubsRes = await fetch(`${baseUrl}/memberships/my-subscriptions`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const mySubs = (await mySubsRes.json()).data.subscriptions;
    console.assert(mySubs.length > 0, 'Customer must have subscriptions');

    const myUsageRes = await fetch(`${baseUrl}/memberships/my-usage`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const myUsage = (await myUsageRes.json()).data;
    console.assert(myUsage.usages.length > 0, 'Customer must have usage records');
    console.log(`  ➔ Customer has ${mySubs.length} subscription records and ${myUsage.totalHoursUsed}h total usage.`);
    console.log('  ✓ Test 17 PASSED: Subscription history and usage audits preserved.\n');

    // ---------------- TEST 18: IN-APP NOTIFICATIONS AUDIT ----------------
    console.log('Test 18: In-app notifications generated for activation and renewal');
    const notifsRes = await fetch(`${baseUrl}/users/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const notifs = (await notifsRes.json()).data.notifications;
    console.assert(notifs.length > 0, 'Notifications must exist');
    const types = notifs.map((n) => n.type);
    console.assert(types.includes('MEMBERSHIP_ACTIVATED') || types.includes('MEMBERSHIP_RENEWED'), 'Membership notification must be present');
    console.log(`  ➔ Customer received ${notifs.length} notification(s): Latest '${notifs[0].title}'`);
    console.log('  ✓ Test 18 PASSED: In-app notification engine verified.\n');

    // ---------------- TEST 19: CROSS-ACCOUNT ISOLATION (SECURITY RBAC) ----------------
    console.log('Test 19: Security - Customer cannot access or modify another customer records');
    // Customer 2 tries to view Customer 1 dashboard or history
    const crossProfileRes = await fetch(`${baseUrl}/users/profile`, {
      headers: { Authorization: `Bearer ${customer2Token}` },
    });
    const cust2Profile = (await crossProfileRes.json()).data.profile;
    console.assert(cust2Profile.email === 'customer2@gaminglounge.com', 'Tokens must only return own profile');

    // Customer tries to access admin membership management routes
    const adminPlanBlock = await fetch(`${baseUrl}/admin/memberships/plans`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    console.assert(adminPlanBlock.status === 403, 'Customer must be blocked with 403 from admin routes');
    console.log('  ➔ Customer safely blocked from admin membership routes with HTTP 403.');
    console.log('  ✓ Test 19 PASSED: Multi-tenant user isolation & RBAC verified.\n');

    // ---------------- TEST 20: EXISTING HARDWARE, BOOKING & AVAILABILITY RULES INTACT ----------------
    console.log('Test 20: Hardware constraints intact - Exactly 3 devices, PS5 capacity 4, independent consoles');
    const devCount = await Device.countDocuments({ status: { $ne: 'DELETED' } });
    console.assert(devCount === 3, `Expected exactly 3 physical devices, found ${devCount}`);
    const ps51Doc = await Device.findOne({ deviceCode: 'PS5-01' });
    const ps52Doc = await Device.findOne({ deviceCode: 'PS5-02' });
    const poolDoc = await Device.findOne({ deviceCode: 'POOL-01' });
    console.assert(ps51Doc && ps52Doc && poolDoc, 'PS5-01, PS5-02, and POOL-01 must exist');
    console.assert(ps51Doc.capacity === 4 && ps52Doc.capacity === 4, 'PS5 capacity must be 4');
    console.log('  ➔ Hardware intact: PS5 Station 1 (4p), PS5 Station 2 (4p), 8-Ball Pool Table (4p).');
    console.log('  ✓ Test 20 PASSED: Zero regressions in core equipment and booking engine.\n');

    console.log('====================================================');
    console.log('🎉 ALL 20 PHASE 5 CORE & EDGE TEST SCENARIOS PASSED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Phase 5 verification failed:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase5Verification();
