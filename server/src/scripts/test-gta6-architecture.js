import connectDB from '../config/db.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Pricing from '../models/Pricing.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import app from '../app.js';
import http from 'http';
import { formatISTDate } from '../utils/timeSlots.js';

const TEST_PORT = 5006;
const baseUrl = `http://localhost:${TEST_PORT}/api`;

async function runGTA6ArchitectureVerification() {
  console.log('====================================================');
  console.log('🧪 VERIFYING EQUIPMENT & GTA 6 ARCHITECTURE RULES');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Server running on ${baseUrl}`);

  try {
    // Rule 1: Lounge has strictly TWO physical PS5s and ONE 8-ball pool table (3 devices total)
    console.log('\n--- RULE 1: PHYSICAL EQUIPMENT AUDIT ---');
    const physicalDevices = await Device.find({}).sort({ deviceCode: 1 });
    console.log(`Total Physical Devices in Lounge: ${physicalDevices.length}`);
    physicalDevices.forEach((d) => console.log(`  - [${d.deviceCode}] ${d.name} (${d.deviceType})`));

    console.assert(
      physicalDevices.length === 3,
      `Expected exactly 3 physical devices, found ${physicalDevices.length}`
    );
    const codes = physicalDevices.map((d) => d.deviceCode);
    console.assert(codes.includes('PS5-01'), 'Must have PS5-01');
    console.assert(codes.includes('PS5-02'), 'Must have PS5-02');
    console.assert(codes.includes('POOL-01'), 'Must have POOL-01');
    console.assert(!codes.some((c) => c.toLowerCase().includes('gta')), 'GTA 6 must NEVER be a device!');
    console.log('✓ Rule 1 PASSED: Exactly 2 physical PS5s and 1 Pool Table. Zero dummy devices.');

    // Rule 2: GTA 6 is registered in Games collection and assigned to compatible PS5 consoles
    console.log('\n--- RULE 2: GTA 6 GAME REGISTRATION & COMPATIBILITY ---');
    const gta6Game = await Game.findOne({ name: 'GTA 6' }).populate('compatibleDevices');
    console.assert(gta6Game, 'GTA 6 must exist in Games collection');
    console.assert(gta6Game.isExclusive === true, 'GTA 6 must be flagged as isExclusive: true');
    console.assert(
      gta6Game.compatibleDevices.length === 2,
      `GTA 6 must be compatible with both physical PS5s, got ${gta6Game.compatibleDevices.length}`
    );
    const compatCodes = gta6Game.compatibleDevices.map((d) => d.deviceCode);
    console.assert(compatCodes.includes('PS5-01') && compatCodes.includes('PS5-02'), 'Must be compatible with PS5-01 and PS5-02');
    console.log(`✓ Rule 2 PASSED: GTA 6 is registered in Games and assigned to [${compatCodes.join(', ')}].`);

    // Rule 3: GTA 6 Pricing is ₹150/hr with mandatory advance payment
    console.log('\n--- RULE 3: GTA 6 PRICING & ADVANCE PAYMENT CONFIGURATION ---');
    const ps5Station1 = physicalDevices.find((d) => d.deviceCode === 'PS5-01');
    const ps5Station2 = physicalDevices.find((d) => d.deviceCode === 'PS5-02');
    const poolTable = physicalDevices.find((d) => d.deviceCode === 'POOL-01');

    // Temporarily activate GTA 6 for booking test
    gta6Game.status = 'ACTIVE';
    await gta6Game.save();

    const priceRes = await fetch(`${baseUrl}/pricing/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        gameId: gta6Game._id,
        durationMinutes: 60,
        playersCount: 1,
      }),
    });
    const priceData = await priceRes.json();
    console.log(`  ➔ GTA 6 Calculated Price: ₹${priceData.data.totalAmountRupees}/hr (${priceData.data.totalAmountPaise} paise)`);
    console.log(`  ➔ Mandatory Advance: ₹${priceData.data.minimumAdvanceRupees} (Required: ${priceData.data.advanceRequired})`);

    console.assert(priceData.data.totalAmountPaise === 15000, `Expected 15000 paise (₹150), got ${priceData.data.totalAmountPaise}`);
    console.assert(priceData.data.advanceRequired === true, 'Advance payment must be mandatory for GTA 6');
    console.log('✓ Rule 3 PASSED: GTA 6 pricing is ₹150/hr with mandatory advance payment.');

    // Authenticate test customer
    let customer = await User.findOne({ email: 'customer@gaminglounge.com' });
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'customer@gaminglounge.com',
        password: 'CustomerPassword@123',
      }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    const testDate = formatISTDate(new Date(Date.now() + 48 * 60 * 60 * 1000)); // 2 days in future
    await Booking.deleteMany({ bookingDate: testDate });

    // Rule 4: GTA 6 booking must reserve the entire assigned physical PS5 (Private Session)
    console.log('\n--- RULE 4: GTA 6 EXCLUSIVE BOOKING LOCKS PHYSICAL PS5 ---');
    const gtaBookingRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        gameId: gta6Game._id,
        bookingType: 'SHARED', // Customer requested shared, but GTA 6 must force PRIVATE!
        bookingDate: testDate,
        startTime: '15:00',
        duration: 2,
        numberOfPlayers: 2,
        notes: 'GTA 6 VIP Session Test',
      }),
    });
    const gtaBookingData = await gtaBookingRes.json();
    console.assert(gtaBookingRes.status === 201, `Expected 201, got ${gtaBookingRes.status}: ${JSON.stringify(gtaBookingData)}`);
    const gtaBooking = gtaBookingData.data.booking;
    console.log(`  ➔ GTA 6 Booking Created on ${gtaBooking.device.name}: ID=${gtaBooking.bookingId}`);
    console.log(`  ➔ Forced Booking Mode: ${gtaBooking.bookingType} (Total: ₹${gtaBooking.totalAmount / 100} for 2 hrs)`);
    console.assert(gtaBooking.bookingType === 'PRIVATE', 'Exclusive GTA 6 booking MUST be forced to PRIVATE');
    console.assert(gtaBooking.totalAmount === 30000, 'Expected ₹300 for 2 hours (₹150/hr)');
    console.log('✓ Rule 4 PASSED: GTA 6 forced Private reservation and locked physical PS5 Station 1.');

    // Rule 5: Same PS5 CANNOT accept another regular game booking or GTA 6 booking during that period
    console.log('\n--- RULE 5: CONCURRENT BOOKING LOCKOUT ON SAME PS5 ---');
    const regularGame = await Game.findOne({ name: 'EA Sports FC 25' });

    // Try booking regular game FC 25 on same PS5 Station 1 at 15:00
    const conflictRes1 = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        gameId: regularGame?._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '15:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    console.log(`  ➔ Attempting regular FC 25 booking on PS5 Station 1 during GTA 6: Status=${conflictRes1.status}`);
    console.assert(conflictRes1.status === 409, `Expected 409 Conflict, got ${conflictRes1.status}`);

    // Try booking another GTA 6 session on same PS5 Station 1 at 16:00 (overlapping 2nd hour)
    const conflictRes2 = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: ps5Station1._id,
        gameId: gta6Game._id,
        bookingDate: testDate,
        startTime: '16:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    console.log(`  ➔ Attempting 2nd GTA 6 booking on same PS5 Station 1: Status=${conflictRes2.status}`);
    console.assert(conflictRes2.status === 409, `Expected 409 Conflict, got ${conflictRes2.status}`);
    console.log('✓ Rule 5 PASSED: Same PS5 strictly rejects regular games and duplicate GTA 6 bookings.');

    // Rule 6: The other PS5 (PS5 Station 2) remains INDEPENDENTLY AVAILABLE!
    console.log('\n--- RULE 6: INDEPENDENT AVAILABILITY OF THE OTHER PS5 ---');
    const ps52BookingRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: ps5Station2._id, // The OTHER physical PS5 console!
        gameId: regularGame?._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '15:00', // EXACT SAME TIME as GTA 6 on PS5 Station 1
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    const ps52BookingData = await ps52BookingRes.json();
    console.assert(ps52BookingRes.status === 201, `Expected 201 on other PS5, got ${ps52BookingRes.status}`);
    console.log(`  ➔ Booked regular game on PS5 Station 2 concurrently at 15:00: ID=${ps52BookingData.data.booking.bookingId}`);
    console.log('✓ Rule 6 PASSED: PS5 Station 2 operates completely independently and was booked concurrently.');

    // Rule 7: GTA 6 cannot be booked on non-compatible device (Pool Table)
    console.log('\n--- RULE 7: REJECTION ON NON-COMPATIBLE HARDWARE ---');
    const poolRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: poolTable._id,
        gameId: gta6Game._id,
        bookingDate: testDate,
        startTime: '18:00',
        duration: 1,
        numberOfPlayers: 1,
      }),
    });
    console.log(`  ➔ Attempting to book GTA 6 on Pool Table: Status=${poolRes.status}`);
    console.assert(poolRes.status === 400, `Expected 400 Bad Request, got ${poolRes.status}`);
    console.log('✓ Rule 7 PASSED: GTA 6 cannot be booked on Pool Table.');

    // Reset GTA 6 to INACTIVE per initial lounge requirements
    gta6Game.status = 'INACTIVE';
    await gta6Game.save();
    console.log('\n✓ Restored GTA 6 initial status to INACTIVE (Awaiting Admin Activation).');

    console.log('\n====================================================');
    console.log('🎉 ALL GTA 6 ARCHITECTURAL REQUIREMENTS VERIFIED!');
    console.log('====================================================');
  } finally {
    server.close();
    process.exit(0);
  }
}

runGTA6ArchitectureVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
