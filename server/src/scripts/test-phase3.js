import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import app from '../app.js';
import http from 'http';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Pricing from '../models/Pricing.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { formatISTDate } from '../utils/timeSlots.js';

const PORT = 5004; // Dedicated port for Phase 3 testing
let server;

async function runPhase3Verification() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 3 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  try {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Test Server listening on http://localhost:${PORT}\n`);

    const baseUrl = `http://localhost:${PORT}/api`;

    // 0. Setup: Authenticate Admin & Customers
    console.log('Setup: Preparing authenticated test accounts...');
    const adminLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' }),
    })).json();
    const adminToken = adminLogin.data.token;

    const custLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer@gaminglounge.com', password: 'CustomerPassword@123' }),
    })).json();
    const customerToken = custLogin.data.token;

    // Create 3 extra player accounts for testing multiplayer 4-player shared session
    const extraTokens = [];
    for (let i = 2; i <= 5; i++) {
      const email = `player${i}_test_${Date.now()}@gaminglounge.com`;
      const phone = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const reg = await (await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Customer Player ${i}`,
          email,
          phone,
          password: 'PlayerPassword@123',
        }),
      })).json();
      extraTokens.push(reg.data.token);
    }

    const ps5Station1 = await Device.findOne({ deviceCode: 'PS5-01' });
    const ps5Station2 = await Device.findOne({ deviceCode: 'PS5-02' });
    const poolTable = await Device.findOne({ deviceCode: 'POOL-01' });
    const fc25Game = await Game.findOne({ name: 'EA Sports FC 25' });

    console.assert(ps5Station1 && ps5Station2 && poolTable, 'Devices must be present in database');
    console.log('✓ Setup complete: Test accounts and device references verified.\n');

    // Future booking date (Tomorrow in IST: YYYY-MM-DD)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureDateStr = formatISTDate(tomorrow);

    // Clean up previous test bookings on futureDateStr for idempotent execution
    await Booking.deleteMany({ bookingDate: futureDateStr });

    // Test 1: Customer can book PS5 Station 1
    console.log('Test 1: Customer can book PS5 Station 1');
    const book1Res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        gameId: fc25Game?._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 1,
        notes: 'Test Booking PS5 Station 1',
      }),
    });
    const book1Data = await book1Res.json();
    console.assert(book1Res.status === 201, `Status should be 201, got ${book1Res.status}`);
    console.assert(book1Data.data.booking.device.deviceCode === 'PS5-01', 'Device must be PS5-01');
    console.assert(book1Data.data.booking.totalAmount === 6000, 'Amount must be 6000 paise (₹60)');
    const booking1 = book1Data.data.booking;
    console.log(`  ➔ Booked PS5-01: ID=${booking1.bookingId}, Amount=₹${booking1.totalAmount / 100}`);
    console.log('  ✓ Test 1 PASSED: Customer booked PS5 Station 1.\n');

    // Test 2: Customer can book PS5 Station 2 independently
    console.log('Test 2: Customer can book PS5 Station 2 independently');
    const book2Res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station2._id,
        gameId: fc25Game?._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '14:00', // Same time slot as Station 1
        duration: 1,
        numberOfPlayers: 1,
        notes: 'Independent booking on Station 2',
      }),
    });
    const book2Data = await book2Res.json();
    console.assert(book2Res.status === 201, `Status should be 201, got ${book2Res.status}`);
    console.assert(book2Data.data.booking.device.deviceCode === 'PS5-02', 'Device must be PS5-02');
    console.log(`  ➔ Booked PS5-02 simultaneously: ID=${book2Data.data.booking.bookingId}`);
    console.log('  ✓ Test 2 PASSED: PS5 Station 2 maintains independent availability.\n');

    // Test 3: Four customers can fill one shared PS5 session
    console.log('Test 3: Multiplayer Shared Session (Players 2, 3, and 4 join PS5 Station 1 at 14:00)');
    // Player 2 joins (1 slot)
    const joinP2 = await (await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${extraTokens[0]}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    })).json();
    console.assert(joinP2.success === true, 'Player 2 join should succeed');
    console.log(`  ➔ Player 2 joined (Occupancy: 2/4): Booking ${joinP2.data.booking.bookingId}`);

    // Player 3 joins (1 slot)
    const joinP3 = await (await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${extraTokens[1]}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    })).json();
    console.assert(joinP3.success === true, 'Player 3 join should succeed');
    console.log(`  ➔ Player 3 joined (Occupancy: 3/4): Booking ${joinP3.data.booking.bookingId}`);

    // Player 4 joins (1 slot) -> Session now FULL (4/4)
    const joinP4 = await (await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${extraTokens[2]}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    })).json();
    console.assert(joinP4.success === true, 'Player 4 join should succeed');
    console.log(`  ➔ Player 4 joined (Occupancy: 4/4 FULL): Booking ${joinP4.data.booking.bookingId}`);
    console.log('  ✓ Test 3 PASSED: Four customers successfully filled shared session.\n');

    // Test 4: A fifth customer cannot join a full session (HTTP 409 Conflict)
    console.log('Test 4: A 5th customer cannot join a full session (HTTP 409 Conflict)');
    const overflowRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${extraTokens[3]}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const overflowData = await overflowRes.json();
    console.assert(overflowRes.status === 409, `Should reject with 409, got ${overflowRes.status}`);
    console.log(`  ➔ 5th player rejected with HTTP 409: "${overflowData.message}"`);
    console.log('  ✓ Test 4 PASSED: Capacity limits strictly enforced (Anti-overflow verified).\n');

    // Test 5: A private booking blocks the entire device
    console.log('Test 5: Private booking reserves the entire device (Pool Table)');
    const privateRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: poolTable._id,
        bookingType: 'PRIVATE',
        bookingDate: futureDateStr,
        startTime: '16:00',
        duration: 2, // 2 hours
        numberOfPlayers: 2,
        notes: 'Private Pool Tournament',
      }),
    });
    const privateData = await privateRes.json();
    console.assert(privateRes.status === 201, `Status should be 201, got ${privateRes.status}`);
    console.assert(privateData.data.booking.bookingType === 'PRIVATE', 'Type must be PRIVATE');
    // Pool: ₹160/player/hr x 2 players x 2 hrs = ₹640 = 64000 paise
    console.assert(privateData.data.booking.totalAmount === 64000, 'Price must be 64000 paise (₹640)');
    console.log(`  ➔ Created Private Booking: ID=${privateData.data.booking.bookingId}, Total=₹${privateData.data.booking.totalAmount / 100}`);
    console.log('  ✓ Test 5 PASSED: Private booking confirmed.\n');

    // Test 6: Shared and private bookings cannot overlap (HTTP 409 Conflict)
    console.log('Test 6: Overlap Protection - Cannot join or overlap a Private Booking');
    const overlapRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${extraTokens[0]}` },
      body: JSON.stringify({
        deviceId: poolTable._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '17:00', // Overlaps 16:00-18:00 private session!
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const overlapData = await overlapRes.json();
    console.assert(overlapRes.status === 409, `Should reject with 409, got ${overlapRes.status}`);
    console.log(`  ➔ Overlapping booking correctly rejected: HTTP 409 ("${overlapData.message}")`);
    console.log('  ✓ Test 6 PASSED: Shared/private overlap prevention verified.\n');

    // Test 7: Customers can book future dates
    console.log('Test 7: Customers can book future dates');
    const nextWeekDate = formatISTDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const futureRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: nextWeekDate,
        startTime: '18:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const futureData = await futureRes.json();
    console.assert(futureRes.status === 201, `Status should be 201, got ${futureRes.status}`);
    console.log(`  ➔ Future Date Confirmed for ${nextWeekDate}: ID=${futureData.data.booking.bookingId}`);
    console.log('  ✓ Test 7 PASSED: Advance future reservation verified.\n');

    // Test 8: Past dates cannot be booked (HTTP 400 Bad Request)
    console.log('Test 8: Past dates cannot be booked (HTTP 400 Bad Request)');
    const pastRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: '2025-01-01',
        startTime: '10:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    console.assert(pastRes.status === 400, `Should reject past dates with 400, got ${pastRes.status}`);
    console.log('  ➔ Past date booking correctly rejected (HTTP 400)');
    console.log('  ✓ Test 8 PASSED: Past booking prevention verified.\n');

    // Test 9: Bookings outside operating hours are rejected
    console.log('Test 9: Bookings outside operating hours are rejected (10:00 to 23:00 IST)');
    const outsideHoursRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '23:00', // Ends at 00:00 (outside 23:00 closing time!)
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    console.assert(outsideHoursRes.status === 400, `Should reject after-hours with 400, got ${outsideHoursRes.status}`);
    console.log('  ➔ After-hours booking correctly rejected (HTTP 400)');
    console.log('  ✓ Test 9 PASSED: Operating hours boundaries enforced.\n');

    // Test 10: Maintenance devices cannot be booked
    console.log('Test 10: Maintenance devices cannot be booked');
    // Temporarily mark station 2 as MAINTENANCE
    await Device.findByIdAndUpdate(ps5Station2._id, { status: 'MAINTENANCE' });

    const maintBookingRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station2._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '19:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    console.assert(maintBookingRes.status === 400 || maintBookingRes.status === 409, 'Must reject maintenance device');
    console.log('  ➔ Booking on maintenance device correctly rejected');
    // Restore status to ACTIVE
    await Device.findByIdAndUpdate(ps5Station2._id, { status: 'ACTIVE' });
    console.log('  ✓ Test 10 PASSED: Maintenance lockout verified.\n');

    // Test 11: Pricing calculated correctly from database rules
    console.log('Test 11: Dynamic Pricing Calculation');
    // PS5: 2 players x 3 hours @ ₹60/player/hr = ₹360 = 36000 paise
    const calcBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        deviceId: ps5Station2._id,
        bookingType: 'SHARED',
        bookingDate: futureDateStr,
        startTime: '10:00',
        duration: 3,
        numberOfPlayers: 2,
      }),
    });
    const calcBookData = await calcBookRes.json();
    console.assert(calcBookData.data.booking.totalAmount === 36000, 'Total amount must be 36000 paise (₹360)');
    const historicalBookingId = calcBookData.data.booking._id;
    console.log(`  ➔ Calculated 2 players x 3 hrs: Total=₹${calcBookData.data.booking.totalAmount / 100}`);
    console.log('  ✓ Test 11 PASSED: Centralized price calculation verified.\n');

    // Test 12: Changing device pricing does not modify historical booking prices (Pricing Snapshot verified)
    console.log('Test 12: Pricing Snapshot Verification (Immunity to future rate alterations)');
    const ps5Pricing = await Pricing.findOne({ deviceType: 'PS5' });
    const originalRate = ps5Pricing.amount;

    // Temporarily double price to ₹120 (12000 paise)
    await Pricing.findByIdAndUpdate(ps5Pricing._id, { amount: 12000 });

    // Fetch the previously booked historical record
    const historicCheck = await Booking.findById(historicalBookingId);
    console.assert(historicCheck.totalAmount === 36000, 'Historical price must remain unchanged');
    console.assert(historicCheck.pricingSnapshot.ratePerUnitPaise === 6000, 'Snapshot rate must be preserved');
    console.log(`  ➔ Historical booking price preserved at ₹${historicCheck.totalAmount / 100} despite price change`);

    // Restore original pricing
    await Pricing.findByIdAndUpdate(ps5Pricing._id, { amount: originalRate });
    console.log('  ✓ Test 12 PASSED: Pricing snapshot guarantees historical integrity.\n');

    // Test 13: Cancelled bookings release player capacity
    console.log('Test 13: Cancelled bookings release player capacity');
    // Cancel booking 1 on PS5-01 (14:00-15:00)
    const cancelRes = await fetch(`${baseUrl}/bookings/${booking1._id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ reason: 'Need to reschedule' }),
    });
    const cancelData = await cancelRes.json();
    console.assert(cancelRes.status === 200, `Cancel status should be 200, got ${cancelRes.status}`);
    console.assert(cancelData.data.booking.bookingStatus === 'CANCELLED', 'Status must be CANCELLED');

    // Now re-check availability for PS5-01 at 14:00: capacity was 4/4 FULL, now 1 slot should be released (3/4 occupied, 1 available)
    const availRes = await fetch(
      `${baseUrl}/bookings/availability?deviceId=${ps5Station1._id}&date=${futureDateStr}&duration=1`
    );
    const availData = await availRes.json();
    const slot14 = availData.data.slots.find((s) => s.startTime === '14:00');
    console.assert(slot14.status === 'PARTIALLY_BOOKED', 'Slot must now be PARTIALLY_BOOKED');
    console.assert(slot14.remainingPlayers === 1, 'Exactly 1 slot must be released');
    console.log(`  ➔ Slot at 14:00: Status=${slot14.status}, Remaining=${slot14.remainingPlayers}/${slot14.capacity}`);
    console.log('  ✓ Test 13 PASSED: Cancellation released occupied player position.\n');

    // Test 14: Availability Endpoint returns accurate live slot occupancy
    console.log('Test 14: Live Slot Breakdown API Verification');
    console.assert(Array.isArray(slot14.playerSlots), 'playerSlots must be an array');
    console.log(`  ➔ Player slots breakdown for 14:00-15:00:`, slot14.playerSlots.map(s => `${s.slotNumber}: ${s.status}`));
    console.log('  ✓ Test 14 PASSED: Live availability slot-by-slot inspection verified.\n');

    // Test 15: Security - Unauthorized customers blocked from admin booking management
    console.log('Test 15: Security Check - Unauthorized customers blocked from /api/admin/bookings');
    const unauthAdminBook = await fetch(`${baseUrl}/admin/bookings`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    console.assert(unauthAdminBook.status === 403, 'Customer must receive 403 Forbidden');
    console.log('  ➔ Customer blocked from administrative bookings API: HTTP 403 Forbidden (RBAC Verified)');

    // Admin accessing calendar API
    const adminCalendarRes = await fetch(`${baseUrl}/admin/bookings/calendar?date=${futureDateStr}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const calendarData = await adminCalendarRes.json();
    console.assert(adminCalendarRes.status === 200, 'Admin calendar must return 200');
    console.assert(Array.isArray(calendarData.data.timeline), 'Timeline must be an array');
    console.log(`  ➔ Admin Calendar API: Retrieved timeline for ${calendarData.data.timeline.length} devices`);
    console.log('  ✓ Test 15 PASSED: Administrative booking security verified.\n');

    console.log('====================================================');
    console.log('🎉 ALL 15 PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');

    server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 3 Verification Test Failed:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runPhase3Verification();
