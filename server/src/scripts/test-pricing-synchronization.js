import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import Pricing from '../models/Pricing.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runTests() {
  console.log('\n======================================================');
  console.log('   NOAH GAMING: PRICING SYNCHRONIZATION TEST SUITE');
  console.log('======================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  // 1. Verify Database Pricing collection records
  console.log('--- 1. DATABASE PRICING RECORDS AUDIT ---');
  const ps5Rule = await Pricing.findOne({ deviceType: 'PS5', game: null, status: 'ACTIVE' });
  const poolRule = await Pricing.findOne({ deviceType: 'POOL', status: 'ACTIVE' });
  const gta6Rule = await Pricing.findOne({
    $or: [{ deviceType: 'EXCLUSIVE' }, { name: /GTA 6/i }],
    status: 'ACTIVE',
  });

  assert(ps5Rule && ps5Rule.amount === 7000, 'PS5 Standard Rate is 7000 paise (₹70)', `Found: ${ps5Rule?.amount}`);
  assert(poolRule && poolRule.amount === 15000, '8-Ball Pool Rate is 15000 paise (₹150)', `Found: ${poolRule?.amount}`);
  assert(gta6Rule && gta6Rule.amount === 15000, 'GTA 6 Exclusive Rate is 15000 paise (₹150)', `Found: ${gta6Rule?.amount}`);

  // 2. Fetch Devices & Games for Calculation Testing
  console.log('\n--- 2. REAL-TIME CALCULATION ENGINE VERIFICATION ---');
  const ps5Device = await Device.findOne({ deviceType: 'PS5' });
  const poolDevice = await Device.findOne({ deviceType: 'POOL' });
  const gta6Game = await Game.findOne({ name: 'GTA 6' });
  const standardGame = await Game.findOne({ name: { $ne: 'GTA 6' }, isExclusive: { $ne: true } });

  assert(!!ps5Device, 'PS5 device found in database', ps5Device?._id);
  assert(!!poolDevice, 'Pool table found in database', poolDevice?._id);

  // Test: PS5 1 player for 1 hour
  const calcPs5_1p_1h = await calculateSessionPrice({
    deviceId: ps5Device._id,
    gameId: standardGame?._id,
    durationMinutes: 60,
    playersCount: 1,
  });
  assert(
    calcPs5_1p_1h.totalAmountRupees === 70 && calcPs5_1p_1h.totalAmountPaise === 7000,
    'PS5 (1 player, 1 hour) = ₹70 (7000 paise)',
    `Got ₹${calcPs5_1p_1h.totalAmountRupees}`
  );

  // Test: PS5 2 players for 1 hour
  const calcPs5_2p_1h = await calculateSessionPrice({
    deviceId: ps5Device._id,
    gameId: standardGame?._id,
    durationMinutes: 60,
    playersCount: 2,
  });
  assert(
    calcPs5_2p_1h.totalAmountRupees === 140 && calcPs5_2p_1h.totalAmountPaise === 14000,
    'PS5 (2 players, 1 hour) = ₹140 (14000 paise)',
    `Got ₹${calcPs5_2p_1h.totalAmountRupees}`
  );

  // Test: PS5 4 players for 2 hours
  const calcPs5_4p_2h = await calculateSessionPrice({
    deviceId: ps5Device._id,
    gameId: standardGame?._id,
    durationMinutes: 120,
    playersCount: 4,
  });
  assert(
    calcPs5_4p_2h.totalAmountRupees === 560 && calcPs5_4p_2h.totalAmountPaise === 56000,
    'PS5 (4 players, 2 hours) = ₹560 (56000 paise)',
    `Got ₹${calcPs5_4p_2h.totalAmountRupees}`
  );

  // Test: Pool 1 player for 1 hour
  const calcPool_1p_1h = await calculateSessionPrice({
    deviceId: poolDevice._id,
    durationMinutes: 60,
    playersCount: 1,
  });
  assert(
    calcPool_1p_1h.totalAmountRupees === 150 && calcPool_1p_1h.totalAmountPaise === 15000,
    '8-Ball Pool (1 player, 1 hour) = ₹150 (15000 paise)',
    `Got ₹${calcPool_1p_1h.totalAmountRupees}`
  );

  // Test: Pool 2 players for 1 hour
  const calcPool_2p_1h = await calculateSessionPrice({
    deviceId: poolDevice._id,
    durationMinutes: 60,
    playersCount: 2,
  });
  assert(
    calcPool_2p_1h.totalAmountRupees === 300 && calcPool_2p_1h.totalAmountPaise === 30000,
    '8-Ball Pool (2 players, 1 hour) = ₹300 (30000 paise)',
    `Got ₹${calcPool_2p_1h.totalAmountRupees}`
  );

  // Test: Pool 4 players for 2 hours
  const calcPool_4p_2h = await calculateSessionPrice({
    deviceId: poolDevice._id,
    durationMinutes: 120,
    playersCount: 4,
  });
  assert(
    calcPool_4p_2h.totalAmountRupees === 1200 && calcPool_4p_2h.totalAmountPaise === 120000,
    '8-Ball Pool (4 players, 2 hours) = ₹1200 (120000 paise)',
    `Got ₹${calcPool_4p_2h.totalAmountRupees}`
  );

  // Test: GTA 6 Exclusive Rate (Per Device Hourly, flat console rate)
  if (gta6Game) {
    const calcGta6_1h = await calculateSessionPrice({
      deviceId: ps5Device._id,
      gameId: gta6Game._id,
      durationMinutes: 60,
      playersCount: 1,
    });
    assert(
      calcGta6_1h.totalAmountRupees === 150 && calcGta6_1h.totalAmountPaise === 15000,
      'GTA 6 Exclusive (1 hour) = ₹150 flat console lock',
      `Got ₹${calcGta6_1h.totalAmountRupees}`
    );
    assert(
      calcGta6_1h.advanceRequired === true && calcGta6_1h.minimumAdvanceRupees === 75,
      'GTA 6 Exclusive requires mandatory 50% advance = ₹75',
      `Got advanceRequired: ${calcGta6_1h.advanceRequired}, advance: ₹${calcGta6_1h.minimumAdvanceRupees}`
    );
  }

  // 3. Historical Bookings and Payment Records Integrity Check
  console.log('\n--- 3. HISTORICAL DATA INTEGRITY AUDIT ---');
  const pastBookings = await Booking.find().lean();
  const pastPayments = await Payment.find().lean();
  console.log(`  Auditing ${pastBookings.length} bookings and ${pastPayments.length} payment records.`);

  let allValid = true;
  pastBookings.forEach((b) => {
    if (typeof b.totalAmount !== 'number' || b.totalAmount < 0) {
      console.log('Invalid booking totalAmount:', b.bookingId, b.totalAmount);
      allValid = false;
    } else if (b.totalAmount === 0 && !b.membershipApplied) {
      console.log('Zero booking without membership:', b.bookingId, b.totalAmount);
      allValid = false;
    }
  });
  assert(allValid, 'All historical bookings maintain valid monetary totals and integrity');

  let allPaymentsValid = true;
  pastPayments.forEach((p) => {
    if (typeof p.amount !== 'number' || p.amount <= 0) {
      allPaymentsValid = false;
    }
  });
  assert(allPaymentsValid, 'All historical payments maintain valid recorded amounts without mutation');

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
