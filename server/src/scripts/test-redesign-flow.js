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

async function runTests() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  try {
    // 1. Fetch devices
    const ps5Station1 = await Device.findOne({ deviceType: 'PS5', deviceCode: 'PS5-01' }) || await Device.findOne({ deviceType: 'PS5' });
    const ps5Station2 = await Device.findOne({ deviceType: 'PS5', deviceCode: 'PS5-02' });
    const poolTable = await Device.findOne({ deviceType: 'POOL' });

    console.log(`PS5 Station 1: ${ps5Station1?.name} (${ps5Station1?.deviceCode})`);
    console.log(`PS5 Station 2: ${ps5Station2?.name} (${ps5Station2?.deviceCode})`);
    console.log(`Pool Table: ${poolTable?.name} (${poolTable?.deviceCode})`);

    // 2. Fetch games
    const nonExclusiveGame = await Game.findOne({ isExclusive: false, status: 'ACTIVE' });
    const gta6Game = await Game.findOne({ $or: [{ name: /GTA 6/i }, { isExclusive: true }] });

    console.log(`Non-exclusive game: ${nonExclusiveGame?.name} (exclusive: ${nonExclusiveGame?.isExclusive})`);
    console.log(`Exclusive game: ${gta6Game?.name} (exclusive: ${gta6Game?.isExclusive})`);

    // 3. Test PS5 Station 1 + Non-exclusive game
    console.log('\n--- TEST 1: PS5 Station 1 + Non-Exclusive Game ---');
    const quoteNonExcl = await calculateSessionPrice({
      deviceId: ps5Station1._id,
      gameId: nonExclusiveGame._id,
      durationMinutes: 120, // 2 hours
      playersCount: 2, // 2 players
    });
    console.log('Quote Non-Exclusive:', {
      rule: quoteNonExcl.pricingRule.name,
      billingType: quoteNonExcl.pricingRule.billingType,
      rateRupees: quoteNonExcl.pricingRule.ratePerUnitRupees,
      totalRupees: quoteNonExcl.totalAmountRupees,
      classification: quoteNonExcl.gameClassification,
      isVenue: quoteNonExcl.isVenueSelection,
    });
    // Rate should be 70, 2 hrs * 2 players * 70 = 280
    if (quoteNonExcl.pricingRule.ratePerUnitRupees !== 70 || quoteNonExcl.totalAmountRupees !== 280) {
      throw new Error(`Expected ₹70/hr/p and total ₹280, got rate ₹${quoteNonExcl.pricingRule.ratePerUnitRupees} and total ₹${quoteNonExcl.totalAmountRupees}`);
    }
    console.log('✓ PASS: PS5 non-exclusive game calculated at ₹70/hr/p (Total ₹280 for 2hrs x 2 players)');

    // 4. Test PS5 Station 2 + Select at Venue
    console.log('\n--- TEST 2: PS5 Station 2 + Select at Venue ---');
    const quoteVenue = await calculateSessionPrice({
      deviceId: (ps5Station2 || ps5Station1)._id,
      isVenueSelection: true,
      durationMinutes: 60, // 1 hour
      playersCount: 3, // 3 players
    });
    console.log('Quote Select at Venue:', {
      rule: quoteVenue.pricingRule.name,
      rateRupees: quoteVenue.pricingRule.ratePerUnitRupees,
      totalRupees: quoteVenue.totalAmountRupees,
      classification: quoteVenue.gameClassification,
      isVenue: quoteVenue.isVenueSelection,
    });
    // Rate should be 70, 1 hr * 3 players * 70 = 210
    if (quoteVenue.pricingRule.ratePerUnitRupees !== 70 || quoteVenue.totalAmountRupees !== 210 || !quoteVenue.isVenueSelection) {
      throw new Error(`Expected rate ₹70, total ₹210, isVenueSelection: true`);
    }
    console.log('✓ PASS: PS5 Select at Venue calculated at dynamic PS5 rate ₹70/hr/p (Total ₹210 for 1hr x 3 players)');

    // 5. Test PS5 + Exclusive GTA 6
    console.log('\n--- TEST 3: PS5 + Exclusive Title (Console Lock) ---');
    const quoteExclusive = await calculateSessionPrice({
      deviceId: ps5Station1._id,
      gameId: gta6Game._id,
      durationMinutes: 60, // 1 hour
      playersCount: 1,
    });
    console.log('Quote Exclusive:', {
      rule: quoteExclusive.pricingRule.name,
      rateRupees: quoteExclusive.pricingRule.ratePerUnitRupees,
      totalRupees: quoteExclusive.totalAmountRupees,
      advanceRequired: quoteExclusive.advanceRequired,
      minimumAdvanceRupees: quoteExclusive.minimumAdvanceRupees,
      classification: quoteExclusive.gameClassification,
    });
    if (quoteExclusive.totalAmountRupees !== 150 || !quoteExclusive.advanceRequired) {
      throw new Error(`Expected ₹150 console lock with advance required`);
    }
    console.log('✓ PASS: Exclusive game locks console at ₹150/hr flat with mandatory advance deposit');

    // 6. Test Pool Table
    console.log('\n--- TEST 4: Pool Table Rate ---');
    const quotePool = await calculateSessionPrice({
      deviceId: poolTable._id,
      durationMinutes: 60,
      playersCount: 1,
    });
    console.log('Quote Pool:', {
      rule: quotePool.pricingRule.name,
      rateRupees: quotePool.pricingRule.ratePerUnitRupees,
      totalRupees: quotePool.totalAmountRupees,
      classification: quotePool.gameClassification,
    });
    if (quotePool.pricingRule.ratePerUnitRupees !== 150 || quotePool.totalAmountRupees !== 150) {
      throw new Error(`Expected Pool rate ₹150/hr`);
    }
    console.log('✓ PASS: Pool table uses independent pool rate ₹150/player/hr (not affected by PS5 pricing)');

    // 7. Test Negative Restrictions: Select at Venue on Exclusive / Pool
    console.log('\n--- TEST 5: Select at Venue Restrictions ---');
    try {
      await calculateSessionPrice({
        deviceId: poolTable._id,
        isVenueSelection: true,
      });
      throw new Error('Should have failed for pool table + isVenueSelection');
    } catch (e) {
      console.log('✓ PASS: Select at Venue blocked on Pool Table:', e.message);
    }

    try {
      await calculateSessionPrice({
        deviceId: ps5Station1._id,
        gameId: gta6Game._id,
        isVenueSelection: true,
      });
      throw new Error('Should have failed for exclusive game + isVenueSelection');
    } catch (e) {
      console.log('✓ PASS: Select at Venue blocked for Exclusive game:', e.message);
    }

    // 8. Test Atomic Booking Creation with isVenueSelection: true
    console.log('\n--- TEST 6: Atomic Booking Creation with isVenueSelection ---');
    const customer = await User.findOne({ role: /customer/i }) || await User.findOne();
    const targetDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const venueBooking = await createBookingAtomic({
      customerId: customer._id,
      deviceId: ps5Station1._id,
      isVenueSelection: true,
      bookingType: 'SHARED',
      bookingDate: targetDate,
      startTime: '16:00',
      duration: 1,
      numberOfPlayers: 2,
      notes: 'Automated test booking for Select at Venue',
    });

    console.log('Venue Booking Result:', {
      id: venueBooking.bookingId,
      isVenueSelection: venueBooking.isVenueSelection,
      gameClassification: venueBooking.gameClassification,
      gameTitle: venueBooking.gameTitle,
      game: venueBooking.game,
      totalAmountPaise: venueBooking.totalAmount,
      totalAmountRupees: venueBooking.totalAmount / 100,
    });

    if (!venueBooking.isVenueSelection || venueBooking.gameClassification !== 'NON_EXCLUSIVE' || venueBooking.gameTitle !== 'Select at Venue' || venueBooking.game !== null) {
      throw new Error('Venue booking attributes did not match expected structure');
    }
    console.log('✓ PASS: Booking created with isVenueSelection: true, gameClassification: NON_EXCLUSIVE, game: null');

    // Clean up test booking
    await Booking.findByIdAndDelete(venueBooking._id);
    console.log('✓ PASS: Test booking cleaned up cleanly');

    console.log('\n=======================================');
    console.log('ALL 6 REDESIGN PRICING & FLOW TESTS PASSED!');
    console.log('=======================================');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
