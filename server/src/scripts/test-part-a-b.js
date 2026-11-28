import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import mongoose from 'mongoose';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import GamingSession from '../models/GamingSession.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipEntitlement from '../models/MembershipEntitlement.js';
import { createBookingAtomic, cancelBookingService } from '../services/booking.service.js';
import { runBookingReminderChecks, runSessionTimerChecks, getAutomationSettings } from '../services/automation.service.js';
import { recordMembershipUsage } from '../services/membership.service.js';
import { completeSession } from '../services/receptionist.service.js';
import { getCanonicalEquipmentName, format12HourTimeStr } from '../utils/timeSlots.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function runTests() {
  console.log('--- STARTING PART A & PART B E2E VERIFICATION ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  const createdBookings = [];
  const createdNotifs = [];
  const createdUsages = [];
  const createdSubs = [];
  const createdEntitlements = [];
  let testCustomer = null;
  let testMember = null;
  let adminUser = null;
  let orphanSess = null;

  try {
    adminUser = await User.findOne({ role: 'admin' });
    const ps5_1 = await Device.findOne({ deviceType: 'PS5', deviceCode: 'PS5-01' });
    const ps5_2 = await Device.findOne({ deviceType: 'PS5', deviceCode: 'PS5-02' });
    const pool = await Device.findOne({ deviceType: 'POOL' });
    const plan = await MembershipPlan.findOne({ status: 'ACTIVE' });

    testCustomer = await User.create({
      name: 'Notif Regular Tester',
      email: `notif_reg_${Date.now()}@noahgaming.in`,
      phone: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'customer',
      accountType: 'REGISTERED',
    });

    testMember = await User.create({
      name: 'Member Checkout Tester',
      email: `mem_chk_${Date.now()}@noahgaming.in`,
      phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'customer',
      accountType: 'REGISTERED',
    });

    // =========================================================================
    // PART A: NOTIFICATION TESTS
    // =========================================================================
    console.log('\n[PART A] Testing Canonical Equipment Names & 12-Hour Formatting...');
    assert(getCanonicalEquipmentName(ps5_1) === 'PlayStation 5 Station 1', 'PS5-01 canonical name mismatch');
    assert(getCanonicalEquipmentName(ps5_2) === 'PlayStation 5 Station 2', 'PS5-02 canonical name mismatch');
    assert(getCanonicalEquipmentName(pool) === 'Pool Table', 'POOL canonical name mismatch');
    assert(format12HourTimeStr('21:00') === '9:00 PM', '21:00 -> 9:00 PM');
    assert(format12HourTimeStr('00:00') === '12:00 AM', '00:00 -> 12:00 AM');
    console.log('  ✓ PASS: Canonical names & 12h formatting verified');

    // Booking Confirmation & Cancellation Notifications
    const testDate = '2026-12-29';
    const b1 = await createBookingAtomic({
      customerId: testCustomer._id,
      deviceId: ps5_1._id,
      pricingCategory: 'NON_EXCLUSIVE',
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '14:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    createdBookings.push(b1._id);

    const confNotif = await Notification.findOne({ relatedBooking: b1._id, category: 'BOOKING_CONFIRMED' });
    assert(confNotif, 'Booking confirmed notification must exist');
    assert(confNotif.message.includes('PlayStation 5 Station 1'), `Expected canonical name in: ${confNotif.message}`);
    assert(confNotif.message.includes('2:00 PM'), `Expected 12-hour AM/PM in: ${confNotif.message}`);
    assert(!confNotif.message.includes('undefined'), 'Must NOT contain undefined');
    createdNotifs.push(confNotif._id);
    console.log(`  ✓ PASS: Booking Confirmation Notification clean: "${confNotif.message}"`);

    // Cancel booking -> must create BOOKING_CANCELLED notification cleanly
    await cancelBookingService(b1._id, testCustomer._id, 'customer', 'Test cancel');
    const cancelNotif = await Notification.findOne({ relatedBooking: b1._id, category: 'BOOKING_CANCELLED' });
    assert(cancelNotif, 'BOOKING_CANCELLED notification must be created without enum validation error');
    assert(cancelNotif.message.includes('PlayStation 5 Station 1') && !cancelNotif.message.includes('undefined'), 'Cancellation message invalid');
    createdNotifs.push(cancelNotif._id);
    console.log(`  ✓ PASS: Booking Cancellation Notification clean: "${cancelNotif.message}"`);

    // 15-Minute Reminder Tests
    console.log('\n[PART A] Testing 15-Minute Booking Reminder & Duplicate Prevention...');
    const now = new Date();
    const in10Min = new Date(now.getTime() + 10 * 60 * 1000);
    const created2HrsAgo = new Date(now.getTime() - 2 * 3600 * 1000);

    const remBooking = await Booking.create({
      bookingId: `BK-REM-${Date.now()}`,
      customer: testCustomer._id,
      device: pool._id,
      bookingDate: testDate,
      startTime: '15:00',
      endTime: '16:00',
      duration: 1,
      startAt: in10Min,
      endAt: new Date(in10Min.getTime() + 3600 * 1000),
      numberOfPlayers: 2,
      bookingStatus: 'CONFIRMED',
      checkInStatus: 'NOT_CHECKED_IN',
      totalAmount: 15000,
      amountPaid: 0,
      balanceRemaining: 15000,
      paymentStatus: 'PENDING',
      pricingRuleSnapshot: { hourlyRate: 15000, billingType: 'FIXED_HOURLY' },
      createdAt: created2HrsAgo,
    });
    createdBookings.push(remBooking._id);

    const settings = await getAutomationSettings();
    const remRun1 = await runBookingReminderChecks(settings);
    const poolRemNotif = await Notification.findOne({ relatedBooking: remBooking._id, category: 'UPCOMING_BOOKING' });
    assert(poolRemNotif, '15-minute Pool Table reminder should be created');
    assert(poolRemNotif.message === 'Your Pool Table booking will start in 15 minutes. Get ready for your session!', `Unexpected reminder text: ${poolRemNotif.message}`);
    createdNotifs.push(poolRemNotif._id);
    console.log(`  ✓ PASS: Pool Table 15-min reminder created: "${poolRemNotif.message}"`);

    // Run again immediately -> must NOT duplicate!
    await runBookingReminderChecks(settings);
    const remCount = await Notification.countDocuments({ relatedBooking: remBooking._id, category: 'UPCOMING_BOOKING' });
    assert(remCount === 1, `Expected 1 reminder (no duplicates), got ${remCount}`);
    console.log('  ✓ PASS: Duplicate 15-min reminder prevented');

    // Reschedule remBooking (+3 mins) -> new startMs generates fresh reminder
    const newStart = new Date(now.getTime() + 13 * 60 * 1000);
    remBooking.startAt = newStart;
    await remBooking.save();
    await runBookingReminderChecks(settings);
    const remNotifsAfterResched = await Notification.find({ relatedBooking: remBooking._id, category: 'UPCOMING_BOOKING' });
    assert(remNotifsAfterResched.length === 2, `Rescheduled booking should get reminder for new time, got ${remNotifsAfterResched.length}`);
    remNotifsAfterResched.forEach((n) => createdNotifs.push(n._id));
    console.log('  ✓ PASS: Rescheduled booking received reminder for new start time');

    // Orphaned session in runSessionTimerChecks -> must NOT generate "Booking undefined..."
    orphanSess = await GamingSession.create({
      booking: new mongoose.Types.ObjectId(),
      customer: testCustomer._id,
      device: ps5_1._id,
      startedAt: new Date(now.getTime() - 50 * 60 * 1000),
      scheduledEndAt: new Date(now.getTime() + 10 * 60 * 1000),
      status: 'ACTIVE',
    });
    await runSessionTimerChecks(settings);
    const badNotifs = await Notification.find({ message: /undefined/i, recipient: testCustomer._id });
    assert(badNotifs.length === 0, 'Found notification containing "undefined"!');
    console.log('  ✓ PASS: Orphaned session skipped cleanly (no "Booking undefined" notifications)');

    // =========================================================================
    // PART B: MEMBERSHIP CHECKOUT & USAGE VALIDATION TESTS
    // =========================================================================
    console.log('\n[PART B] Testing Membership Checkout, Subscription Reference & Checkout Completion...');

    // 1. Regular customer booking without membership -> NO MembershipUsage created
    const regB = await createBookingAtomic({
      customerId: testCustomer._id,
      deviceId: ps5_2._id,
      pricingCategory: 'NON_EXCLUSIVE',
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '16:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    createdBookings.push(regB._id);
    const regUsage = await MembershipUsage.findOne({ booking: regB._id });
    assert(!regUsage, 'Regular customer without membership must NOT create MembershipUsage');
    console.log('  ✓ PASS: Regular customer booking created without MembershipUsage');

    // 2. Active Member booking & Checkout completion
    const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const sub = await MembershipSubscription.create({
      subscriptionId: `SUB-TEST-${Date.now()}`,
      customer: testMember._id,
      membershipPlan: plan._id,
      purchaseDate: now,
      startDate: now,
      expirationDate: expiresAt,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      amountPaid: plan.price,
    });
    createdSubs.push(sub._id);

    testMember.membership = {
      status: 'ACTIVE',
      planId: plan._id,
      subscriptionId: sub._id,
      expiresAt,
      remainingHours: 2,
    };
    await testMember.save();

    const tomorrowDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
      new Date(now.getTime() + 24 * 3600 * 1000)
    );

    const memBooking = await createBookingAtomic({
      customerId: testMember._id,
      deviceId: ps5_1._id,
      pricingCategory: 'NON_EXCLUSIVE',
      bookingType: 'SHARED',
      bookingDate: tomorrowDate,
      startTime: '11:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    createdBookings.push(memBooking._id);

    const memUsage = await MembershipUsage.findOne({ booking: memBooking._id });
    assert(memUsage, 'MembershipUsage must be created for active member booking');
    assert(String(memUsage.subscription) === String(sub._id), 'MembershipUsage.subscription MUST match active subscription _id');
    createdUsages.push(memUsage._id);
    console.log(`  ✓ PASS: Active member booking created MembershipUsage with valid subscription ref (${memUsage.subscription})`);

    // 3. Complete / Checkout session via Front Desk -> must NOT throw "MembershipUsage validation failed: subscription: Subscription reference is required"!
    memBooking.checkInStatus = 'CHECKED_IN';
    memBooking.sessionStatus = 'ACTIVE';
    memBooking.sessionStartedAt = new Date(now.getTime() - 30 * 60 * 1000);
    await memBooking.save();

    await completeSession({
      bookingId: memBooking.bookingId,
      staffUser: adminUser,
      notes: 'E2E checkout test',
    });
    const completedUsageCount = await MembershipUsage.countDocuments({ booking: memBooking._id, status: 'COMPLETED' });
    assert(completedUsageCount === 1, `Expected 1 COMPLETED MembershipUsage after checkout, got ${completedUsageCount}`);
    console.log('  ✓ PASS: Session checkout/completion succeeded with valid subscription ref & no duplicate usage!');

    // 4. Test recordMembershipUsage rejection when customer has NO valid subscription
    let threwOnInvalid = false;
    try {
      await recordMembershipUsage({
        booking: regB,
        customerId: testCustomer._id,
        subscriptionId: null,
      });
    } catch (e) {
      threwOnInvalid = true;
    }
    assert(threwOnInvalid, 'recordMembershipUsage MUST reject when customer has no valid active subscription');
    console.log('  ✓ PASS: recordMembershipUsage strictly enforces valid subscription presence');

    console.log('\n--- ALL PART A & PART B E2E TESTS PASSED! ---');
  } finally {
    // Cleanup temporary test data
    if (createdNotifs.length > 0) await Notification.deleteMany({ _id: { $in: createdNotifs } });
    if (createdUsages.length > 0) await MembershipUsage.deleteMany({ _id: { $in: createdUsages } });
    if (createdBookings.length > 0) {
      await MembershipEntitlement.deleteMany({ booking: { $in: createdBookings } });
      await Booking.deleteMany({ _id: { $in: createdBookings } });
    }
    if (createdSubs.length > 0) await MembershipSubscription.deleteMany({ _id: { $in: createdSubs } });
    if (orphanSess) await GamingSession.deleteOne({ _id: orphanSess._id });
    if (testCustomer) await User.deleteOne({ _id: testCustomer._id });
    if (testMember) await User.deleteOne({ _id: testMember._id });
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Error:', err);
  process.exit(1);
});
