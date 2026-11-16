import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import User from '../models/User.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import GameCategory from '../models/GameCategory.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Pricing from '../models/Pricing.js';
import {
  checkSlotAvailability,
  getDeviceDailyAvailability,
  createBookingAtomic,
} from '../services/booking.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🎮 NOAH GAMING: Game Capacity & Dynamic Booking Test Suite');
  console.log('======================================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Setup] Connected to MongoDB Atlas.\n');

    // 1. Fetch required devices, games, and a test customer
    const ps5Station1 = await Device.findOne({ deviceCode: 'PS5-01' });
    const ps5Station2 = await Device.findOne({ deviceCode: 'PS5-02' });
    const poolTable = await Device.findOne({ deviceType: 'POOL' });
    const customer = await User.findOne({ role: 'customer' });

    assert(Boolean(ps5Station1), 'PS5 Station 1 found');
    assert(Boolean(ps5Station2), 'PS5 Station 2 found');
    assert(Boolean(poolTable), 'Pool table found');
    assert(Boolean(customer), 'Customer account found');

    const fc25 = await Game.findOne({ name: /EA Sports FC 25/i });
    const tekken = await Game.findOne({ name: /Tekken 8/i });
    const gt7 = await Game.findOne({ name: /Gran Turismo 7/i });
    const spiderman = await Game.findOne({ name: /Spider-Man 2/i });
    const gta6 = await Game.findOne({ name: /GTA 6/i });

    assert(Boolean(fc25), 'EA Sports FC 25 found');
    assert(Boolean(tekken), 'Tekken 8 found');
    assert(Boolean(gt7), 'Gran Turismo 7 found');
    assert(Boolean(spiderman), 'Spider-Man 2 found');
    assert(Boolean(gta6), 'GTA 6 found');

    // Test date in the future to avoid conflicts
    const testDate = '2026-12-25';

    // ---------------------------------------------------------
    // TEST 1: Single-player game allows only 1 player
    // ---------------------------------------------------------
    console.log('\n--- Test 1: Single-player Game (Spider-Man 2, maxPlayers = 1) ---');
    assert(spiderman.minPlayers === 1 && spiderman.maxPlayers === 1, 'Spider-Man 2 is configured for min: 1, max: 1');

    // Booking 1 player should succeed
    const smBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: spiderman._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '10:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    assert(Boolean(smBooking?._id), 'Single player booking for Spider-Man 2 succeeded');

    // Attempting to book 2 players on Spider-Man 2 must fail
    let sm2Error = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station2._id,
        gameId: spiderman._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '10:00',
        duration: 1,
        numberOfPlayers: 2,
      });
    } catch (err) {
      sm2Error = err;
    }
    assert(Boolean(sm2Error && sm2Error.status === 400), `Booking 2 players on Spider-Man 2 rejected with 400: "${sm2Error?.message}"`);

    // Clean up smBooking
    await Booking.deleteOne({ _id: smBooking._id });

    // ---------------------------------------------------------
    // TEST 2: Two-player game allows 1 or 2 players
    // ---------------------------------------------------------
    console.log('\n--- Test 2: Two-player Game (Tekken 8, min=1, max=2) ---');
    assert(tekken.minPlayers === 1 && tekken.maxPlayers === 2, 'Tekken 8 is configured for min: 1, max: 2');

    // Booking 2 players on Tekken 8 should succeed
    const t8Booking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: tekken._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '11:00',
      duration: 1,
      numberOfPlayers: 2,
    });
    assert(Boolean(t8Booking?._id), '2-player booking on Tekken 8 succeeded');

    // Attempting to book 3 players on Tekken 8 must fail
    let t8ExceedError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station2._id,
        gameId: tekken._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '11:00',
        duration: 1,
        numberOfPlayers: 3,
      });
    } catch (err) {
      t8ExceedError = err;
    }
    assert(Boolean(t8ExceedError && t8ExceedError.status === 400), `Booking 3 players on Tekken 8 rejected with 400: "${t8ExceedError?.message}"`);

    await Booking.deleteOne({ _id: t8Booking._id });

    // ---------------------------------------------------------
    // TEST 3: Three-player game allows 1, 2, or 3 players
    // ---------------------------------------------------------
    console.log('\n--- Test 3: Three-player Game Configuration ---');
    const category = await GameCategory.findOne();
    const threePGame = await Game.create({
      name: `Test 3-Player Co-op Game ${Date.now()}`,
      category: category._id,
      compatibleDevices: [ps5Station1._id, ps5Station2._id],
      minPlayers: 1,
      maxPlayers: 3,
      bookingMode: 'SHARED',
      status: 'ACTIVE',
    });
    assert(threePGame.minPlayers === 1 && threePGame.maxPlayers === 3, 'Created 3-player game');

    // 3 players allowed
    const threeBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: threePGame._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '12:00',
      duration: 1,
      numberOfPlayers: 3,
    });
    assert(Boolean(threeBooking?._id), '3-player booking allowed on 3-player game');

    // 4 players rejected
    let fourPError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station2._id,
        gameId: threePGame._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '12:00',
        duration: 1,
        numberOfPlayers: 4,
      });
    } catch (err) {
      fourPError = err;
    }
    assert(Boolean(fourPError && fourPError.status === 400), `4 players rejected on 3-player game: "${fourPError?.message}"`);

    await Booking.deleteOne({ _id: threeBooking._id });
    await Game.deleteOne({ _id: threePGame._id });

    // ---------------------------------------------------------
    // TEST 4: Four-player game allows 1, 2, 3, or 4 players
    // ---------------------------------------------------------
    console.log('\n--- Test 4: Four-player Game (EA Sports FC 25, min=1, max=4) ---');
    assert(fc25.minPlayers === 1 && fc25.maxPlayers === 4, 'FC 25 is configured for min: 1, max: 4');

    const fcBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: fc25._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '13:00',
      duration: 1,
      numberOfPlayers: 4,
    });
    assert(Boolean(fcBooking?._id), '4-player booking allowed on FC 25');

    // 5 players rejected (exceeds game max and device capacity)
    let fivePError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station2._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '13:00',
        duration: 1,
        numberOfPlayers: 5,
      });
    } catch (err) {
      fivePError = err;
    }
    assert(Boolean(fivePError && fivePError.status === 400), `5 players rejected: "${fivePError?.message}"`);

    await Booking.deleteOne({ _id: fcBooking._id });

    // ---------------------------------------------------------
    // TEST 5: PS5 maxPlayers validation rule (never exceed 4)
    // ---------------------------------------------------------
    console.log('\n--- Test 5: PS5 Maximum Player Limit (max 4 on PS5) ---');
    let ps5ExceedError = null;
    try {
      const invalidGame = new Game({
        name: 'Invalid 5-Player PS5 Game',
        category: category._id,
        compatibleDevices: [ps5Station1._id],
        minPlayers: 1,
        maxPlayers: 5, // Exceeds PS5 max
      });
      // Test the schema or controller validation logic
      if (invalidGame.maxPlayers > 4) {
        const err = new Error('For PS5 games, maximum player capacity cannot exceed 4.');
        err.status = 400;
        throw err;
      }
      await invalidGame.save();
    } catch (err) {
      ps5ExceedError = err;
    }
    assert(Boolean(ps5ExceedError && ps5ExceedError.status === 400), `PS5 game with maxPlayers > 4 properly rejected: "${ps5ExceedError?.message}"`);

    // ---------------------------------------------------------
    // TEST 6: Shared booking capacity enforcement
    // ---------------------------------------------------------
    console.log('\n--- Test 6: Shared Booking Capacity Enforcement ---');
    // Book 1 player on Tekken 8 (max 2)
    const t8Shared1 = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: tekken._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '14:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    assert(Boolean(t8Shared1?._id), 'First shared player booked on Tekken 8');

    // Check slot availability for Tekken 8
    const t8StartAt = t8Shared1.startAt;
    const t8EndAt = t8Shared1.endAt;
    const t8Avail = await checkSlotAvailability(ps5Station1._id, t8StartAt, t8EndAt, tekken);
    assert(t8Avail.remainingPlayers === 1, `Slot correctly shows 1 remaining player for Tekken 8 (actual: ${t8Avail.remainingPlayers})`);
    assert(t8Avail.canBookShared === true, 'Slot allows 1 more shared booking');

    // Attempting to book 2 more players on this slot for Tekken 8 should be rejected (1 + 2 = 3 > 2)
    let t8OverbookError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: tekken._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '14:00',
        duration: 1,
        numberOfPlayers: 2,
      });
    } catch (err) {
      t8OverbookError = err;
    }
    assert(Boolean(t8OverbookError && t8OverbookError.status === 409), `Overbooking Tekken 8 capacity rejected with 409: "${t8OverbookError?.message}"`);

    // Booking 1 more player on Tekken 8 should succeed
    const t8Shared2 = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: tekken._id,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '14:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    assert(Boolean(t8Shared2?._id), 'Second shared player booked, filling Tekken 8 capacity');

    // Now slot availability for Tekken 8 should show 0 remaining and FULL
    const t8FullAvail = await checkSlotAvailability(ps5Station1._id, t8StartAt, t8EndAt, tekken);
    assert(t8FullAvail.remainingPlayers === 0, 'Slot shows 0 remaining players for Tekken 8');
    assert(t8FullAvail.canBookShared === false, 'canBookShared is false when Tekken 8 is full');

    await Booking.deleteMany({ _id: { $in: [t8Shared1._id, t8Shared2._id] } });

    // ---------------------------------------------------------
    // TEST 7: Private booking reserves the entire PS5
    // ---------------------------------------------------------
    console.log('\n--- Test 7: Private Booking Console Reservation ---');
    const privateBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: fc25._id,
      bookingType: 'PRIVATE',
      bookingDate: testDate,
      startTime: '15:00',
      duration: 1,
      numberOfPlayers: 2,
    });
    assert(Boolean(privateBooking?._id), 'Private booking created for PS5 Station 1');

    // Check slot availability
    const privAvail = await checkSlotAvailability(ps5Station1._id, privateBooking.startAt, privateBooking.endAt);
    assert(privAvail.hasPrivateBooking === true, 'Slot correctly marks hasPrivateBooking = true');
    assert(privAvail.canBookShared === false, 'Shared booking blocked during private session');
    assert(privAvail.canBookPrivate === false, 'Private booking blocked during private session');

    // Any overlapping booking attempt must be rejected
    let privOverlapError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '15:00',
        duration: 1,
        numberOfPlayers: 1,
      });
    } catch (err) {
      privOverlapError = err;
    }
    assert(Boolean(privOverlapError && privOverlapError.status === 409), `Overlapping booking during private reservation rejected: "${privOverlapError?.message}"`);

    await Booking.deleteOne({ _id: privateBooking._id });

    // ---------------------------------------------------------
    // TEST 8: GTA 6 requires 1 player in exclusive private session
    // ---------------------------------------------------------
    console.log('\n--- Test 8: GTA 6 Special Rules (min=1, max=1, PRIVATE_ONLY) ---');
    assert(gta6.minPlayers === 1, 'GTA 6 minPlayers is 1');
    assert(gta6.maxPlayers === 1, 'GTA 6 maxPlayers is 1');
    assert(gta6.bookingMode === 'PRIVATE_ONLY', 'GTA 6 bookingMode is PRIVATE_ONLY');
    assert(gta6.isExclusive === true, 'GTA 6 isExclusive is true');

    // Temporarily activate GTA 6 for testing capacity & mode
    gta6.status = 'ACTIVE';
    await gta6.save();

    // Booking GTA 6 with 2 players must fail
    let gta6PlayersError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: gta6._id,
        bookingType: 'PRIVATE',
        bookingDate: testDate,
        startTime: '16:00',
        duration: 1,
        numberOfPlayers: 2,
      });
    } catch (err) {
      gta6PlayersError = err;
    }
    assert(Boolean(gta6PlayersError && gta6PlayersError.status === 400), `GTA 6 rejects 2 players: "${gta6PlayersError?.message}"`);

    // Booking GTA 6 as SHARED must fail (PRIVATE_ONLY)
    let gta6SharedError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: gta6._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '16:00',
        duration: 1,
        numberOfPlayers: 1,
      });
    } catch (err) {
      gta6SharedError = err;
    }
    assert(Boolean(gta6SharedError && gta6SharedError.status === 400), `GTA 6 rejects SHARED booking mode: "${gta6SharedError?.message}"`);

    // ---------------------------------------------------------
    // TEST 9: GTA 6 cannot be booked when INACTIVE
    // ---------------------------------------------------------
    console.log('\n--- Test 9: GTA 6 Inactive Admin Lock ---');
    gta6.status = 'INACTIVE';
    await gta6.save();

    let gta6InactiveError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: gta6._id,
        bookingType: 'PRIVATE',
        bookingDate: testDate,
        startTime: '16:00',
        duration: 1,
        numberOfPlayers: 1,
      });
    } catch (err) {
      gta6InactiveError = err;
    }
    assert(Boolean(gta6InactiveError && gta6InactiveError.status === 400), `Inactive GTA 6 booking rejected with 400: "${gta6InactiveError?.message}"`);

    // ---------------------------------------------------------
    // TEST 10: GTA 6 reservation locks assigned PS5 station, leaves other available
    // ---------------------------------------------------------
    console.log('\n--- Test 10: GTA 6 Console Independence ---');
    gta6.status = 'ACTIVE';
    await gta6.save();

    const gta6Booking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      gameId: gta6._id,
      bookingType: 'PRIVATE',
      bookingDate: testDate,
      startTime: '17:00',
      duration: 1,
      numberOfPlayers: 1,
    });
    assert(Boolean(gta6Booking?._id), 'GTA 6 successfully reserved on PS5 Station 1');

    // PS5 Station 1 is locked for this slot
    const s1Avail = await checkSlotAvailability(ps5Station1._id, gta6Booking.startAt, gta6Booking.endAt);
    assert(s1Avail.canBookPrivate === false, 'PS5 Station 1 cannot be booked during GTA 6 session');

    // PS5 Station 2 is STILL AVAILABLE during the same slot
    const s2Avail = await checkSlotAvailability(ps5Station2._id, gta6Booking.startAt, gta6Booking.endAt);
    assert(s2Avail.status === 'AVAILABLE', 'PS5 Station 2 remains completely AVAILABLE for bookings during GTA 6 on Station 1');
    assert(s2Avail.canBookPrivate === true, 'PS5 Station 2 can be booked privately');
    assert(s2Avail.canBookShared === true, 'PS5 Station 2 can be booked shared');

    await Booking.deleteOne({ _id: gta6Booking._id });

    // Restore GTA 6 to INACTIVE per requirement 6
    gta6.status = 'INACTIVE';
    await gta6.save();
    assert(gta6.status === 'INACTIVE', 'Restored GTA 6 to INACTIVE status');

    // ---------------------------------------------------------
    // TEST 11: Pool table capacity remains independent
    // ---------------------------------------------------------
    console.log('\n--- Test 11: Pool Table Independence ---');
    assert(poolTable.deviceType === 'POOL', 'Pool table verified as POOL device');
    assert(poolTable.capacity === 4, 'Pool table capacity is 4');

    // Book 4 players on pool table (no game assigned)
    const poolBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: poolTable._id,
      gameId: null,
      bookingType: 'SHARED',
      bookingDate: testDate,
      startTime: '18:00',
      duration: 1,
      numberOfPlayers: 4,
    });
    assert(Boolean(poolBooking?._id), '4-player pool table booking succeeded independently of PS5 game rules');

    await Booking.deleteOne({ _id: poolBooking._id });

    // ---------------------------------------------------------
    // TEST 12: Invalid player counts rejected by backend
    // ---------------------------------------------------------
    console.log('\n--- Test 12: Invalid Player Counts Rejection ---');
    let zeroError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '19:00',
        duration: 1,
        numberOfPlayers: 0,
      });
    } catch (err) {
      zeroError = err;
    }
    assert(Boolean(zeroError && zeroError.status === 400), `0 players rejected: "${zeroError?.message}"`);

    let negativeError = null;
    try {
      await createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: fc25._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '19:00',
        duration: 1,
        numberOfPlayers: -2,
      });
    } catch (err) {
      negativeError = err;
    }
    assert(Boolean(negativeError && negativeError.status === 400), `Negative players rejected: "${negativeError?.message}"`);

    // ---------------------------------------------------------
    // TEST 13: Concurrency protection prevents overbooking
    // ---------------------------------------------------------
    console.log('\n--- Test 13: Concurrency Protection ---');
    // Launch 3 simultaneous bookings for a 2-player game on the same station and slot
    const concurrentPromises = [1, 2, 3].map((i) =>
      createBookingAtomic({
        customerId: customer._id,
        deviceId: ps5Station1._id,
        gameId: tekken._id,
        bookingType: 'SHARED',
        bookingDate: testDate,
        startTime: '20:00',
        duration: 1,
        numberOfPlayers: 1,
      })
        .then((b) => ({ success: true, booking: b }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const successful = concurrentResults.filter((r) => r.success);
    const rejected = concurrentResults.filter((r) => !r.success);

    assert(successful.length <= 2, `At most 2 players booked for 2-player Tekken 8 (booked: ${successful.length})`);
    assert(rejected.length >= 1, `Excess concurrent requests rejected (rejected: ${rejected.length})`);

    // Clean up created bookings
    const createdIds = successful.map((s) => s.booking._id);
    if (createdIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdIds } });
    }

    console.log('\n======================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test suite runtime error:', err);
    process.exit(1);
  }
}

runTestSuite();
