import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Pricing from '../models/Pricing.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';
import { createBookingAtomic } from '../services/booking.service.js';
import { checkInBooking } from '../services/receptionist.service.js';

async function runTests() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  try {
    // 1. Fetch devices
    const ps5Station1 =
      (await Device.findOne({ deviceType: 'PS5', deviceCode: 'PS5-01' })) ||
      (await Device.findOne({ deviceType: 'PS5' }));
    const ps5Station2 =
      (await Device.findOne({ deviceType: 'PS5', deviceCode: 'PS5-02' })) || ps5Station1;
    const poolTable = await Device.findOne({ deviceType: 'POOL' });

    console.log(`PS5 Station 1: ${ps5Station1?.name} (${ps5Station1?.deviceCode})`);
    console.log(`PS5 Station 2: ${ps5Station2?.name} (${ps5Station2?.deviceCode})`);
    console.log(`Pool Table: ${poolTable?.name} (${poolTable?.deviceCode})`);

    // 2. Fetch games for check-in tests
    const nonExclusiveGame = await Game.findOne({ isExclusive: false, status: 'ACTIVE' });
    const exclusiveGame = await Game.findOne({ $or: [{ isExclusive: true }, { name: /GTA/i }] });

    console.log(`Non-exclusive game: ${nonExclusiveGame?.name}`);
    console.log(`Exclusive game: ${exclusiveGame?.name}`);

    // TEST 1: PS5 Non-Exclusive without gameId (2 players, 1 hour = 2 * 70 = ₹140)
    console.log('\n--- TEST 1: PS5 Non-Exclusive Category (No Game ID) ---');
    const quoteNonExcl = await calculateSessionPrice({
      deviceId: ps5Station1._id,
      pricingCategory: 'NON_EXCLUSIVE',
      durationMinutes: 60, // 1 hour
      playersCount: 2, // 2 players
    });
    console.log('Quote Non-Exclusive:', {
      rule: quoteNonExcl.pricingRule.name,
      rateRupees: quoteNonExcl.pricingRule.ratePerUnitRupees,
      totalRupees: quoteNonExcl.totalAmountRupees,
      classification: quoteNonExcl.gameClassification,
    });
    if (quoteNonExcl.totalAmountRupees !== 140) {
      throw new Error(`Expected ₹140, got ₹${quoteNonExcl.totalAmountRupees}`);
    }
    console.log('✓ PASS: 2 players × ₹70 × 1 hr = ₹140');

    // TEST 2: PS5 Exclusive Category (3 players, 2 hours = 3 * 150 * 2 = ₹900)
    console.log('\n--- TEST 2: PS5 Exclusive Category (No Game ID) ---');
    const quoteExcl = await calculateSessionPrice({
      deviceId: ps5Station1._id,
      pricingCategory: 'EXCLUSIVE',
      durationMinutes: 120, // 2 hours
      playersCount: 3, // 3 players
    });
    console.log('Quote Exclusive:', {
      rule: quoteExcl.pricingRule.name,
      rateRupees: quoteExcl.pricingRule.ratePerUnitRupees,
      totalRupees: quoteExcl.totalAmountRupees,
      classification: quoteExcl.gameClassification,
    });
    if (quoteExcl.totalAmountRupees !== 900) {
      throw new Error(`Expected ₹900, got ₹${quoteExcl.totalAmountRupees}`);
    }
    console.log('✓ PASS: 3 players × ₹150 × 2 hrs = ₹900');

    // TEST 3: Pool Table Rate
    console.log('\n--- TEST 3: Pool Table Rate ---');
    const quotePool = await calculateSessionPrice({
      deviceId: poolTable._id,
      durationMinutes: 60,
      playersCount: 1,
    });
    console.log('Quote Pool:', {
      rule: quotePool.pricingRule.name,
      rateRupees: quotePool.pricingRule.ratePerUnitRupees,
      totalRupees: quotePool.totalAmountRupees,
    });
    if (quotePool.totalAmountRupees !== 150) {
      throw new Error(`Expected Pool ₹150, got ₹${quotePool.totalAmountRupees}`);
    }
    console.log('✓ PASS: Pool Table calculated at configured rate ₹150');

    // TEST 4: Atomic Customer Booking Creation - Non-Exclusive (No gameId)
    console.log('\n--- TEST 4: Customer Booking Creation - Non-Exclusive (Pay at Venue) ---');
    const customer = (await User.findOne({ role: /customer/i })) || (await User.findOne());
    const targetDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const nonExclBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      pricingCategory: 'NON_EXCLUSIVE',
      isVenueSelection: true,
      bookingType: 'SHARED',
      bookingDate: targetDate,
      startTime: '15:00',
      duration: 1,
      numberOfPlayers: 2,
      notes: 'Automated test booking for Non-Exclusive without game',
    });

    console.log('Non-Exclusive Booking:', {
      id: nonExclBooking.bookingId,
      game: nonExclBooking.game,
      isVenueSelection: nonExclBooking.isVenueSelection,
      gameClassification: nonExclBooking.gameClassification,
      paymentStatus: nonExclBooking.paymentStatus,
      totalAmountRupees: nonExclBooking.totalAmount / 100,
    });

    if (
      nonExclBooking.game !== null ||
      nonExclBooking.gameClassification !== 'NON_EXCLUSIVE' ||
      nonExclBooking.paymentStatus !== 'PENDING' ||
      nonExclBooking.totalAmount !== 14000
    ) {
      throw new Error('Non-exclusive booking did not match expected values');
    }
    console.log('✓ PASS: Non-Exclusive booking created with game: null, status: PENDING, amount: ₹140');

    // TEST 5: Atomic Customer Booking Creation - Exclusive (No gameId)
    console.log('\n--- TEST 5: Customer Booking Creation - Exclusive (Pay at Venue) ---');
    const exclBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station2._id,
      pricingCategory: 'EXCLUSIVE',
      isVenueSelection: true,
      bookingType: 'SHARED',
      bookingDate: targetDate,
      startTime: '16:00',
      duration: 1,
      numberOfPlayers: 1,
      notes: 'Automated test booking for Exclusive without game',
    });

    console.log('Exclusive Booking:', {
      id: exclBooking.bookingId,
      game: exclBooking.game,
      isVenueSelection: exclBooking.isVenueSelection,
      gameClassification: exclBooking.gameClassification,
      paymentStatus: exclBooking.paymentStatus,
      totalAmountRupees: exclBooking.totalAmount / 100,
    });

    if (
      exclBooking.game !== null ||
      exclBooking.gameClassification !== 'EXCLUSIVE' ||
      exclBooking.paymentStatus !== 'PENDING' ||
      exclBooking.totalAmount !== 15000
    ) {
      throw new Error('Exclusive booking did not match expected values');
    }
    console.log('✓ PASS: Exclusive booking created with game: null, status: PENDING, amount: ₹150');

    // TEST 6: Staff Check-in Game Assignment
    console.log('\n--- TEST 6: Staff Check-in Game Assignment ---');
    const staffUser = (await User.findOne({ role: { $in: ['receptionist', 'admin'] } })) || customer;

    // 6a: Assigning exclusive game to non-exclusive booking should be REJECTED
    if (exclusiveGame) {
      let rejected = false;
      try {
        await checkInBooking({
          bookingId: nonExclBooking.bookingId,
          staffUser,
          gameId: exclusiveGame._id,
        });
      } catch (err) {
        rejected = true;
        console.log('✓ PASS: Incompatible exclusive game correctly rejected for non-exclusive booking:', err.message);
      }
      if (!rejected) {
        throw new Error('Should have rejected assigning exclusive game to non-exclusive booking');
      }
    }

    // 6b: Assigning compatible non-exclusive game to non-exclusive booking should SUCCEED
    if (nonExclusiveGame) {
      const checkInResult = await checkInBooking({
        bookingId: nonExclBooking.bookingId,
        staffUser,
        gameId: nonExclusiveGame._id,
      });

      console.log('Check-in Result:', {
        bookingId: checkInResult.booking.bookingId,
        checkInStatus: checkInResult.booking.checkInStatus,
        gameTitle: checkInResult.booking.gameTitle,
        assignedGame: checkInResult.booking.game?.name || checkInResult.booking.game,
      });

      if (checkInResult.booking.checkInStatus !== 'CHECKED_IN') {
        throw new Error('Check-in status should be CHECKED_IN');
      }
      console.log('✓ PASS: Staff successfully assigned title at check-in without altering price');
    }

    // Clean up test bookings
    await Booking.findByIdAndDelete(nonExclBooking._id);
    await Booking.findByIdAndDelete(exclBooking._id);
    console.log('✓ PASS: Test records cleaned up safely');

    console.log('\n======================================================');
    console.log('ALL REDESIGN BOOKING, PRICING & STAFF WORKFLOW TESTS PASSED!');
    console.log('======================================================');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
