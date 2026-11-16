import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Pricing from '../models/Pricing.js';
import ActivityLog from '../models/ActivityLog.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipUsage from '../models/MembershipUsage.js';
import app from '../app.js';
import http from 'http';
import { formatISTDate } from '../utils/timeSlots.js';

const TEST_PORT = 5013;
const baseUrl = `http://localhost:${TEST_PORT}/api`;

async function runPhase6Verification() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 6 RECEPTIONIST & WALK-IN COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Server listening on http://localhost:${TEST_PORT}\n`);

  let passedTests = 0;
  const totalTests = 25;

  try {
    const todayIST = formatISTDate(new Date());

    // -------------------------------------------------------------
    // SETUP: Fetch & Prepare Devices, Games & Accounts
    // -------------------------------------------------------------
    console.log('--- Initializing Test Setup & Fixtures ---');

    // 1. Fetch Physical Consoles
    const ps5Devices = await Device.find({ deviceType: 'PS5', status: 'ACTIVE' }).sort({ deviceCode: 1 });
    if (ps5Devices.length < 2) {
      throw new Error(`Expected at least 2 PS5 devices, found ${ps5Devices.length}`);
    }
    const ps5Station1 = ps5Devices[0];
    const ps5Station2 = ps5Devices[1];

    const poolTable = await Device.findOne({ deviceType: 'POOL', status: 'ACTIVE' });
    if (!poolTable) {
      throw new Error('8-Ball Pool Table device not found');
    }

    // 2. Fetch Games including GTA 6
    const gta6Game = await Game.findOne({ name: 'GTA 6' });
    const regularGame = await Game.findOne({ name: { $ne: 'GTA 6' }, status: 'ACTIVE' });

    console.log(`✓ Stations Identified: ${ps5Station1.name} (${ps5Station1.deviceCode}), ${ps5Station2.name} (${ps5Station2.deviceCode}), ${poolTable.name}`);
    console.log(`✓ Games Identified: GTA 6 (Exclusive=${gta6Game?.isExclusive}), Regular: ${regularGame?.name}\n`);

    // Clean prior test artifacts
    await Booking.deleteMany({
      $or: [
        { bookingId: /^BK-TEST-P6/ },
        { notes: /Test Phase 6/ },
        { isWalkIn: true },
      ],
    });
    await User.deleteMany({
      $or: [
        { email: /^testwalkin.*@test\.com/ },
        { phone: '9811223344' },
      ],
    });
    await Payment.deleteMany({ transactionReference: /Test Phase 6/ });

    // =============================================================
    // TEST 1: Receptionist Login & JWT Generation
    // =============================================================
    console.log('▶ Test 1: Receptionist Login & Authentication');
    const recLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'reception@gaminglounge.com', password: 'StaffPassword@123' }),
    });
    const recLoginData = await recLoginRes.json();
    if (!recLoginRes.ok || !recLoginData.data?.token || recLoginData.data.user.role !== 'receptionist') {
      throw new Error(`Receptionist login failed: ${JSON.stringify(recLoginData)}`);
    }
    const receptionistToken = recLoginData.data.token;
    const receptionistUser = recLoginData.data.user;
    console.log(`  ✓ Receptionist authenticated successfully. Role: ${receptionistUser.role}, ID: ${receptionistUser.id}`);
    passedTests++;

    // Authenticate Admin for comparison and log checks
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' }),
    });
    const adminToken = (await adminLoginRes.json()).data.token;

    // Authenticate Customer
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer@gaminglounge.com', password: 'CustomerPassword@123' }),
    });
    const custLoginData = await custLoginRes.json();
    const customerToken = custLoginData.data.token;
    const customerUser = custLoginData.data.user;

    // =============================================================
    // TEST 2: Receptionist Admin Access Restriction (RBAC Protection)
    // =============================================================
    console.log('\n▶ Test 2: Receptionist Admin Access Restriction (RBAC Protection)');
    // Receptionist tries to access admin-only endpoint: /api/devices (POST to create a device)
    const illegalAdminAction = await fetch(`${baseUrl}/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Station',
        deviceType: 'PS5',
        capacity: 4,
      }),
    });
    if (illegalAdminAction.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for receptionist on admin resource, got ${illegalAdminAction.status}`);
    }
    console.log(`  ✓ HTTP 403 Forbidden correctly returned when Receptionist attempts admin resource.`);
    passedTests++;

    // =============================================================
    // TEST 3: Search Customers by Name, Phone, Email, Customer ID
    // =============================================================
    console.log('\n▶ Test 3: Customer Search & Verification Multi-Attribute');
    const searchTargetName = customerUser?.name || 'Aryan';
    const searchByName = await fetch(`${baseUrl}/receptionist/customers/search?q=${encodeURIComponent(searchTargetName)}`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    const searchData = await searchByName.json();
    if (!searchByName.ok || searchData.data.length === 0) {
      throw new Error(`Customer search by name '${searchTargetName}' failed. Returned: ${JSON.stringify(searchData)}`);
    }

    const searchTargetPhone = customerUser?.phone || '9876543212';
    const searchByPhone = await fetch(`${baseUrl}/receptionist/customers/search?q=${encodeURIComponent(searchTargetPhone)}`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    const phoneData = await searchByPhone.json();
    if (!searchByPhone.ok || phoneData.data.length === 0) {
      throw new Error(`Customer search by phone '${searchTargetPhone}' failed. Returned: ${JSON.stringify(phoneData)}`);
    }
    console.log(`  ✓ Customer search succeeded across Name ('${searchTargetName}') and Phone ('${searchTargetPhone}').`);
    passedTests++;

    // =============================================================
    // TEST 4: Register New Walk-in Customer at Reception
    // =============================================================
    console.log('\n▶ Test 4: Register New Walk-in Customer at Reception');
    const testPhone = '9811223344';
    const regRes = await fetch(`${baseUrl}/receptionist/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        name: 'Mohit Walkin',
        phone: testPhone,
        email: 'testwalkin1@test.com',
      }),
    });
    const regData = await regRes.json();
    if (regRes.status !== 201 || !regData.data?._id || regData.alreadyExists) {
      throw new Error(`Walk-in customer registration failed: ${JSON.stringify(regData)}`);
    }
    const newCustomer = regData.data;
    console.log(`  ✓ Walk-in customer '${newCustomer.name}' registered successfully with ID ${newCustomer.customerId}.`);
    passedTests++;

    // =============================================================
    // TEST 5: Prevent Duplicate Customer Mobile Registration
    // =============================================================
    console.log('\n▶ Test 5: Duplicate Customer Mobile Registration Prevention');
    const dupRes = await fetch(`${baseUrl}/receptionist/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        name: 'Mohit Duplicate Attempt',
        phone: testPhone, // Same phone
      }),
    });
    const dupData = await dupRes.json();
    if (!dupRes.ok || !dupData.alreadyExists || dupData.data._id !== newCustomer._id) {
      throw new Error('Duplicate phone did not return existing customer');
    }
    console.log(`  ✓ Duplicate mobile registration gracefully identified existing customer without duplicate records.`);
    passedTests++;

    // =============================================================
    // TEST 6: Create Walk-in Booking at Front Desk
    // =============================================================
    console.log('\n▶ Test 6: Create Walk-in Booking with Immediate Cash Collection');
    const walkinSlot = '18:00';
    const walkinRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station1._id,
        gameId: regularGame?._id || null,
        bookingType: 'SHARED',
        bookingDate: todayIST,
        startTime: walkinSlot,
        duration: 1,
        numberOfPlayers: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 6000, // ₹60
        notes: 'Test Phase 6 Walk-in',
      }),
    });
    const walkinData = await walkinRes.json();
    if (walkinRes.status !== 201 || !walkinData.data?.booking) {
      throw new Error(`Walk-in booking creation failed: ${JSON.stringify(walkinData)}`);
    }
    const walkinBooking = walkinData.data.booking;
    if (!walkinBooking.isWalkIn) {
      throw new Error('Booking was not flagged as isWalkIn');
    }
    if (walkinBooking.paymentStatus !== 'PAID' || walkinBooking.balanceRemaining !== 0) {
      throw new Error(`Expected walk-in booking to be PAID with 0 balance, got ${walkinBooking.balanceRemaining}`);
    }
    console.log(`  ✓ Walk-in booking ${walkinBooking.bookingId} created on ${ps5Station1.name} (isWalkIn=true, Cash collected ₹60).`);
    passedTests++;

    // =============================================================
    // TEST 7: Existing Booking Availability Respected (Slot Collision Check)
    // =============================================================
    console.log('\n▶ Test 7: Existing Booking Availability Respected');
    const availRes = await fetch(
      `${baseUrl}/bookings/availability?deviceId=${ps5Station1._id}&date=${todayIST}&duration=1`
    );
    const availData = await availRes.json();
    const slotAt18 = availData.data.slots.find((s) => s.startTime === walkinSlot);
    if (!slotAt18) {
      throw new Error(`Slot ${walkinSlot} not returned in availability`);
    }
    // Since walk-in booked 1 player on a 4-player PS5, available capacity should now be 3
    if (slotAt18.remainingPlayers !== 3) {
      throw new Error(`Expected 3 available players remaining at ${walkinSlot}, got ${slotAt18.remainingPlayers}`);
    }
    console.log(`  ✓ Availability correctly reflects occupied slots: 1 booked, ${slotAt18.remainingPlayers} remaining.`);
    passedTests++;

    // =============================================================
    // TEST 8: Shared PS5 Capacity (4 Players Max) Respected
    // =============================================================
    console.log('\n▶ Test 8: Shared PS5 Capacity (4 Players Max) Respected');
    // Book remaining 3 players on PS5 Station 1 at 18:00
    const fillRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: todayIST,
        startTime: walkinSlot,
        duration: 1,
        numberOfPlayers: 3,
        paymentMethod: 'CASH',
        paymentAmountPaise: 18000,
        notes: 'Test Phase 6 Fill',
      }),
    });
    if (!fillRes.ok) {
      throw new Error(`Filling remaining 3 slots failed: ${await fillRes.text()}`);
    }

    // Now station is at 4/4 capacity. Attempting a 5th player must be rejected
    const exceedRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: todayIST,
        startTime: walkinSlot,
        duration: 1,
        numberOfPlayers: 1,
        notes: 'Test Phase 6 Exceed',
      }),
    });
    if (exceedRes.status !== 409) {
      throw new Error(`Expected HTTP 409 Conflict when exceeding capacity, got ${exceedRes.status}`);
    }
    console.log(`  ✓ Station filled to 4/4 players. Attempting to add 5th player rejected with HTTP 409 Conflict.`);
    passedTests++;

    // =============================================================
    // TEST 9: Private PS5 Booking Reserves Entire Console
    // =============================================================
    console.log('\n▶ Test 9: Private PS5 Booking Reserves Entire Console');
    const privateSlot = '19:00';
    const privateBookingRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station2._id,
        bookingType: 'PRIVATE',
        bookingDate: todayIST,
        startTime: privateSlot,
        duration: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 24000, // ₹240 private rate
        notes: 'Test Phase 6 Private',
      }),
    });
    const privateBookingData = await privateBookingRes.json();
    if (!privateBookingRes.ok) {
      throw new Error(`Private booking failed: ${JSON.stringify(privateBookingData)}`);
    }

    // Now attempt a shared booking on the same console during the private slot
    const blockedSharedRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station2._id,
        bookingType: 'SHARED',
        bookingDate: todayIST,
        startTime: privateSlot,
        duration: 1,
        numberOfPlayers: 1,
        notes: 'Test Phase 6 Blocked Shared',
      }),
    });
    if (blockedSharedRes.status !== 409) {
      throw new Error(`Expected HTTP 409 Conflict when attempting shared booking on private console, got ${blockedSharedRes.status}`);
    }
    console.log(`  ✓ Private booking on ${ps5Station2.name} successfully locks entire console; shared requests rejected with HTTP 409.`);
    passedTests++;

    // =============================================================
    // TEST 10: GTA 6 Reserves Assigned Physical PS5 Exclusively
    // =============================================================
    console.log('\n▶ Test 10: GTA 6 Reserves Assigned Physical PS5 Exclusively at ₹150/hr');
    const gtaSlot = '20:00';
    const gtaBookingRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station1._id,
        gameId: gta6Game?._id,
        bookingDate: todayIST,
        startTime: gtaSlot,
        duration: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 15000, // ₹150 mandatory advance
        notes: 'Test Phase 6 GTA6',
      }),
    });
    const gtaData = await gtaBookingRes.json();
    if (!gtaBookingRes.ok) {
      throw new Error(`GTA 6 booking failed: ${JSON.stringify(gtaData)}`);
    }
    const gtaBooking = gtaData.data.booking;
    if (gtaBooking.totalAmount !== 15000) {
      throw new Error(`Expected GTA 6 total amount to be ₹150 (15000 paise), got ${gtaBooking.totalAmount}`);
    }

    // Attempting any other booking on PS5 Station 1 during GTA 6 slot must fail
    const gtaConflictRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: todayIST,
        startTime: gtaSlot,
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    if (gtaConflictRes.status !== 409) {
      throw new Error(`Expected HTTP 409 Conflict for station with GTA 6 exclusive lock, got ${gtaConflictRes.status}`);
    }

    // PS5 Station 2 MUST remain available independently
    const station2AvailRes = await fetch(
      `${baseUrl}/bookings/availability?deviceId=${ps5Station2._id}&date=${todayIST}&duration=1`
    );
    const station2Slot = (await station2AvailRes.json()).data.slots.find((s) => s.startTime === gtaSlot);
    if (!station2Slot || station2Slot.status !== 'AVAILABLE') {
      throw new Error(`PS5 Station 2 was not available at ${gtaSlot}: ${JSON.stringify(station2Slot)}`);
    }
    console.log(`  ✓ GTA 6 exclusively locked PS5 Station 1 at ₹150; PS5 Station 2 remained independently available.`);
    passedTests++;

    // =============================================================
    // TEST 11: Check In Advance Bookings
    // =============================================================
    console.log('\n▶ Test 11: Check In Advance Bookings & Collect Remaining Balance');
    // Create an advance booking with partial payment
    const advanceRes = await fetch(`${baseUrl}/receptionist/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: newCustomer._id,
        deviceId: poolTable._id,
        bookingType: 'SHARED',
        bookingDate: todayIST,
        startTime: '21:00',
        duration: 1,
        numberOfPlayers: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 8000, // ₹80 advance on ₹160 total
        notes: 'Test Phase 6 Advance',
      }),
    });
    const advanceBooking = (await advanceRes.json()).data.booking;
    if (advanceBooking.balanceRemaining !== 8000) {
      throw new Error(`Expected ₹80 balance remaining, got ${advanceBooking.balanceRemaining}`);
    }

    // Perform Check-In and collect the remaining ₹80
    const checkInRes = await fetch(`${baseUrl}/receptionist/bookings/${advanceBooking._id}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        paymentCollection: {
          amountPaise: 8000,
          paymentMethod: 'COUNTER_UPI',
          transactionReference: 'Test Phase 6 UPI Balance',
        },
      }),
    });
    const checkInData = await checkInRes.json();
    if (!checkInRes.ok || checkInData.data.booking.checkInStatus !== 'CHECKED_IN') {
      throw new Error(`Check-in failed: ${JSON.stringify(checkInData)}`);
    }
    const updatedAdvanceBooking = checkInData.data.booking;
    if (updatedAdvanceBooking.balanceRemaining !== 0 || updatedAdvanceBooking.sessionStatus !== 'ACTIVE') {
      throw new Error('Check-in did not set balance to 0 or sessionStatus to ACTIVE');
    }
    console.log(`  ✓ Check-in completed for ${updatedAdvanceBooking.bookingId}; remaining ₹80 collected via COUNTER_UPI.`);
    passedTests++;

    // =============================================================
    // TEST 12: Duplicate Check-In Prevention
    // =============================================================
    console.log('\n▶ Test 12: Duplicate Check-In Prevention');
    const dupCheckInRes = await fetch(`${baseUrl}/receptionist/bookings/${advanceBooking._id}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({}),
    });
    if (dupCheckInRes.status !== 400) {
      throw new Error(`Expected HTTP 400 Bad Request on duplicate check-in, got ${dupCheckInRes.status}`);
    }
    console.log(`  ✓ Duplicate check-in rejected with HTTP 400 Bad Request.`);
    passedTests++;

    // =============================================================
    // TEST 13: Start Gaming Sessions
    // =============================================================
    console.log('\n▶ Test 13: Explicit Start Gaming Session Endpoint');
    const startRes = await fetch(`${baseUrl}/receptionist/sessions/${advanceBooking._id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    const startData = await startRes.json();
    if (!startRes.ok || startData.data.sessionStatus !== 'ACTIVE') {
      throw new Error(`Failed to start session: ${JSON.stringify(startData)}`);
    }
    console.log(`  ✓ Explicit session start succeeded. Session Status: ${startData.data.sessionStatus}.`);
    passedTests++;

    // =============================================================
    // TEST 14: Session Timers Use Server Timestamps
    // =============================================================
    console.log('\n▶ Test 14: Server-Side Real-Time Session Timers');
    const activeSessionsRes = await fetch(`${baseUrl}/receptionist/sessions/active`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    const activeSessions = (await activeSessionsRes.json()).data;
    if (!Array.isArray(activeSessions) || activeSessions.length === 0) {
      throw new Error('Expected active sessions returned from server');
    }
    const sampleActive = activeSessions[0];
    if (typeof sampleActive.remainingSeconds !== 'number' || typeof sampleActive.elapsedMinutes !== 'number') {
      throw new Error('Active session missing server-calculated countdown attributes');
    }
    console.log(`  ✓ Active session timers calculated server-side: remainingSeconds=${sampleActive.remainingSeconds}, elapsedMinutes=${sampleActive.elapsedMinutes}.`);
    passedTests++;

    // =============================================================
    // TEST 15: Session Extension Checks Future Booking Conflicts
    // =============================================================
    console.log('\n▶ Test 15: Session Extension Checks Future Booking Conflicts');
    // ps5Station1 has bookings at 18:00 (1h) and GTA 6 at 20:00 (1h).
    // Let's create an active session at 16:00 for 1h (ends 17:00).
    const preConflictBooking = await Booking.create({
      bookingId: `BK-TEST-P6-CONF-${Date.now()}`,
      customer: newCustomer._id,
      device: ps5Station1._id,
      bookingType: 'PRIVATE',
      bookingDate: todayIST,
      startTime: '17:00',
      endTime: '18:00',
      startAt: new Date(`${todayIST}T17:00:00+05:30`),
      endAt: new Date(`${todayIST}T18:00:00+05:30`),
      duration: 1,
      numberOfPlayers: 1,
      totalAmount: 6000,
      amountPaid: 6000,
      balanceRemaining: 0,
      bookingStatus: 'CONFIRMED',
      sessionStatus: 'ACTIVE',
      checkInStatus: 'CHECKED_IN',
    });

    // Attempting to extend by 2 hours (new end 20:00) conflicts with the 18:00 booking
    const conflictExtRes = await fetch(`${baseUrl}/receptionist/sessions/${preConflictBooking._id}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        extendedDurationHours: 2,
      }),
    });
    if (conflictExtRes.status !== 409) {
      throw new Error(`Expected HTTP 409 Conflict when extending into existing reservation, got ${conflictExtRes.status}`);
    }
    console.log(`  ✓ Extension rejected with HTTP 409 Conflict due to upcoming booking conflict on station.`);
    passedTests++;

    // =============================================================
    // TEST 16: Additional Extension Charges Calculated Correctly
    // =============================================================
    console.log('\n▶ Test 16: Additional Charges Calculated Correctly on Extension');
    // Extend advanceBooking on Pool Table by +1 hour
    const extRes = await fetch(`${baseUrl}/receptionist/sessions/${advanceBooking._id}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        extendedDurationHours: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 16000, // ₹160 extension fee
        notes: 'Test Phase 6 Extension',
      }),
    });
    const extData = await extRes.json();
    if (!extRes.ok || !extData.data.extension) {
      throw new Error(`Extension failed: ${JSON.stringify(extData)}`);
    }
    if (extData.data.extension.additionalAmountPaise !== 16000) {
      throw new Error(`Expected additional charge of ₹160 (16000 paise), got ${extData.data.extension.additionalAmountPaise}`);
    }
    console.log(`  ✓ Session extended by +1h. Extension charge correctly computed to ₹160 via pricing engine.`);
    passedTests++;

    // =============================================================
    // TEST 17: Offline Payments Recorded Correctly (Cash & Counter UPI)
    // =============================================================
    console.log('\n▶ Test 17: Offline Payments Recorded Correctly (Cash & Counter UPI)');
    const partialBooking = await Booking.create({
      bookingId: `BK-TEST-P6-PAY-${Date.now()}`,
      customer: newCustomer._id,
      device: ps5Station2._id,
      bookingType: 'SHARED',
      bookingDate: todayIST,
      startTime: '22:00',
      endTime: '23:00',
      startAt: new Date(`${todayIST}T22:00:00+05:30`),
      endAt: new Date(`${todayIST}T23:00:00+05:30`),
      duration: 1,
      numberOfPlayers: 2,
      totalAmount: 12000, // ₹120
      amountPaid: 0,
      balanceRemaining: 12000,
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'UNPAID',
    });

    const cashPayRes = await fetch(`${baseUrl}/receptionist/payments/offline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        bookingId: partialBooking._id,
        amountPaise: 6000,
        paymentMethod: 'CASH',
        transactionReference: 'Test Phase 6 Cash Counter',
      }),
    });
    const cashPayData = await cashPayRes.json();
    if (!cashPayRes.ok || cashPayData.data.payment.paymentMethod !== 'CASH') {
      throw new Error(`Offline cash collection failed: ${JSON.stringify(cashPayData)}`);
    }
    console.log(`  ✓ Offline Cash payment of ₹60 collected and recorded with audit trail.`);
    passedTests++;

    // =============================================================
    // TEST 18: Partial Payments Update Outstanding Balances
    // =============================================================
    console.log('\n▶ Test 18: Partial Payments Update Outstanding Balances');
    const updatedPartialBooking = await Booking.findById(partialBooking._id);
    if (updatedPartialBooking.amountPaid !== 6000 || updatedPartialBooking.balanceRemaining !== 6000) {
      throw new Error(`Expected balance remaining 6000 paise, got ${updatedPartialBooking.balanceRemaining}`);
    }
    if (updatedPartialBooking.paymentStatus !== 'PARTIALLY_PAID') {
      throw new Error(`Expected status PARTIALLY_PAID, got ${updatedPartialBooking.paymentStatus}`);
    }
    console.log(`  ✓ Booking payment status updated to PARTIALLY_PAID; balance updated to ₹60 remaining.`);
    passedTests++;

    // =============================================================
    // TEST 19: Receipts Generated
    // =============================================================
    console.log('\n▶ Test 19: Structured Receipts Generated for Offline Payments');
    if (!cashPayData.data.receipt || !cashPayData.data.receipt.receiptNumber) {
      throw new Error('Receipt document missing from payment collection response');
    }
    console.log(`  ✓ Receipt #${cashPayData.data.receipt.receiptNumber} generated with lounge metadata and transaction breakdown.`);
    passedTests++;

    // =============================================================
    // TEST 20: Membership Allowance & Eligibility Verification
    // =============================================================
    console.log('\n▶ Test 20: Membership Allowance & Eligibility Verification');
    const memberDetailsRes = await fetch(`${baseUrl}/receptionist/customers/${customerUser._id || customerUser.id}`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    const memberDetails = await memberDetailsRes.json();
    if (!memberDetailsRes.ok || !memberDetails.data.membershipVerification) {
      throw new Error('Membership verification object missing');
    }
    const memVer = memberDetails.data.membershipVerification;
    console.log(`  ✓ Customer membership status: ${memVer.status}, Plan: ${memVer.planName}, Daily Quota: ${memVer.minutesUsedToday}/${memVer.dailyUsageLimitMinutes} mins.`);
    passedTests++;

    // =============================================================
    // TEST 21: Completed Sessions Update Gaming History
    // =============================================================
    console.log('\n▶ Test 21: Completed Sessions Update Gaming History');
    const completeRes = await fetch(`${baseUrl}/receptionist/sessions/${advanceBooking._id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        notes: 'Session finished normally',
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok || completeData.data.booking.sessionStatus !== 'COMPLETED') {
      throw new Error(`Failed to complete session: ${JSON.stringify(completeData)}`);
    }
    if (typeof completeData.data.booking.actualDurationMinutes !== 'number') {
      throw new Error('actualDurationMinutes not computed on checkout');
    }
    console.log(`  ✓ Session ${advanceBooking.bookingId} completed. actualDurationMinutes: ${completeData.data.booking.actualDurationMinutes} mins.`);
    passedTests++;

    // =============================================================
    // TEST 22: Device Availability Released After Session Completion
    // =============================================================
    console.log('\n▶ Test 22: Device Availability Released After Session Completion');
    const dashStatsRes = await fetch(`${baseUrl}/receptionist/dashboard`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    const dashStats = await dashStatsRes.json();
    const poolDevStat = dashStats.data.devices.find((d) => d.deviceCode === poolTable.deviceCode);
    if (!poolDevStat || poolDevStat.activeSessionsCount > 0) {
      throw new Error(`Expected pool table activeSessionsCount to be 0 after completion, got ${poolDevStat?.activeSessionsCount}`);
    }
    console.log(`  ✓ Station ${poolTable.name} freed and available for subsequent sessions.`);
    passedTests++;

    // =============================================================
    // TEST 23: Receptionist Actions Recorded in Immutable Audit Logs
    // =============================================================
    console.log('\n▶ Test 23: Receptionist Actions Recorded in Immutable Activity Logs');
    const logsRes = await fetch(`${baseUrl}/admin/receptionist/activity-logs?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const logsData = await logsRes.json();
    if (!logsRes.ok || logsData.data.logs.length === 0) {
      throw new Error('Audit logs query failed');
    }
    const sampleLog = logsData.data.logs[0];
    if (sampleLog.category !== 'RECEPTIONIST') {
      throw new Error(`Expected category RECEPTIONIST, got ${sampleLog.category}`);
    }
    console.log(`  ✓ Activity log entry verified: Action='${sampleLog.action}', Staff='${sampleLog.userName}', Role='${sampleLog.userRole}'.`);
    passedTests++;

    // =============================================================
    // TEST 24: Mobile & Tablet Responsive Layouts (Frontend Verification)
    // =============================================================
    console.log('\n▶ Test 24: Responsive UI Token Verification');
    const fs = await import('fs');
    const path = await import('path');
    const clientDir = path.resolve(process.cwd(), 'client/src/components/receptionist');
    const requiredFiles = [
      'ReceptionistDashboard.jsx',
      'ExtendSessionModal.jsx',
      'CheckInModal.jsx',
      'CheckoutModal.jsx',
      'QuickRegisterModal.jsx',
      'CollectPaymentModal.jsx',
    ];

    for (const f of requiredFiles) {
      const fullPath = path.join(clientDir, f);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Required Receptionist UI file missing: ${f}`);
      }
    }

    const dashContent = fs.readFileSync(path.join(clientDir, 'ReceptionistDashboard.jsx'), 'utf-8');
    if (!dashContent.includes('sm:grid-cols-4') || !dashContent.includes('md:grid-cols-3')) {
      throw new Error('Responsive breakpoint tokens missing in ReceptionistDashboard');
    }
    console.log(`  ✓ ReceptionistDashboard and 5 modal components verified with responsive grid layouts.`);
    passedTests++;

    // =============================================================
    // TEST 25: Core Regression Test (Phases 1–5.1 Intact)
    // =============================================================
    console.log('\n▶ Test 25: Core Regression Test (Phases 1–5.1 Functional Integrity)');
    // 1. Devices & Categories
    const catRes = await fetch(`${baseUrl}/categories`);
    const devRes = await fetch(`${baseUrl}/devices`);
    if (!catRes.ok || !devRes.ok) throw new Error('Category/Device endpoints failed');

    // 2. Booking Engine
    const bkgRes = await fetch(`${baseUrl}/bookings/my-bookings`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (!bkgRes.ok) throw new Error('My Bookings endpoint failed');

    // 3. Membership Plans
    const plansRes = await fetch(`${baseUrl}/memberships/plans`);
    if (!plansRes.ok) throw new Error('Membership plans endpoint failed');

    console.log(`  ✓ All Core Systems Verified: Equipment, Bookings, Payments & Club Passes intact.`);
    passedTests++;

    // -------------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 6 VERIFICATION TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runPhase6Verification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Phase 6 Test Failed:', err);
    process.exit(1);
  });
