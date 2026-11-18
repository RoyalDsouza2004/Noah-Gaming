import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Device from '../models/Device.js';
import Game from '../models/Game.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Pricing from '../models/Pricing.js';
import MembershipPlan from '../models/MembershipPlan.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import MembershipUsage from '../models/MembershipUsage.js';
import MembershipEntitlement from '../models/MembershipEntitlement.js';
import { calculateSessionPrice } from '../utils/pricingCalculator.js';
import { isMultiplayerGame, checkSlotAvailability, createBookingAtomic } from '../services/booking.service.js';

async function runTests() {
  console.log('=================================================================');
  console.log('🧪 VERIFYING MEMBERSHIP ENTITLEMENT & MULTIPLAYER RULES');
  console.log('=================================================================');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing from environment');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB Atlas');

  try {
    // 1. Fetch devices and games
    const ps5 = await Device.findOne({ deviceType: 'PS5' });
    if (!ps5) throw new Error('PS5 device not found');

    const tekken = await Game.findOne({ name: /Tekken/i }) || await Game.findOne({ maxPlayers: { $gt: 1 } });
    if (!tekken) throw new Error('Multiplayer game not found');

    const spiderman = await Game.findOne({ name: /Spider-Man/i }) || await Game.findOne({ maxPlayers: 1 });

    console.log(`✓ PS5 Device: ${ps5.name} (Code: ${ps5.deviceCode}, Capacity: ${ps5.capacity})`);
    console.log(`✓ Multiplayer Game: ${tekken.name} (Min: ${tekken.minPlayers}, Max: ${tekken.maxPlayers})`);
    if (spiderman) {
      console.log(`✓ Single-Player Game: ${spiderman.name} (Min: ${spiderman.minPlayers}, Max: ${spiderman.maxPlayers})`);
    }

    // -------------------------------------------------------------
    // TEST 1: MULTIPLAYER DETECTION & PRIVATE RESTRICTION
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Multiplayer Detection & Private Booking Restriction ---');
    const isTekkenMultiplayer = isMultiplayerGame(tekken);
    console.log(`isMultiplayerGame('${tekken.name}'):`, isTekkenMultiplayer);
    if (!isTekkenMultiplayer) {
      throw new Error(`Expected '${tekken.name}' to be classified as multiplayer!`);
    }

    if (spiderman) {
      const isSpideyMulti = isMultiplayerGame(spiderman);
      console.log(`isMultiplayerGame('${spiderman.name}'):`, isSpideyMulti);
    }

    // Check slot availability for multiplayer game
    const testDate = '2026-11-20';
    const startAt = new Date(`${testDate}T19:00:00+05:30`);
    const endAt = new Date(`${testDate}T20:00:00+05:30`);

    const availTekken = await checkSlotAvailability(ps5._id, startAt, endAt, tekken);
    console.log(`Slot availability for '${tekken.name}' 7 PM - 8 PM:`);
    console.log(`- canBookShared: ${availTekken.canBookShared}`);
    console.log(`- canBookPrivate: ${availTekken.canBookPrivate} (MUST BE FALSE for multiplayer!)`);
    if (availTekken.canBookPrivate !== false) {
      throw new Error('FAIL: Multiplayer game offered canBookPrivate=true!');
    }
    console.log('✓ PASS: canBookPrivate is false for multiplayer titles.');

    // -------------------------------------------------------------
    // TEST 2: MEMBERSHIP FREE HOUR CALCULATION (1 PLAYER ONLY)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Membership Free Hour Entitlement for Multiplayer PS5 ---');

    // Create a temporary test member user with active membership
    const plan = await MembershipPlan.findOne({ status: 'ACTIVE' });
    if (!plan) throw new Error('Active membership plan not found');

    const testEmail = `testmember_${Date.now()}@noahgaming.test`;
    const testUser = await User.create({
      name: 'Test Member Player',
      email: testEmail,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'customer',
      membership: {
        status: 'ACTIVE',
        planId: plan._id,
        planName: plan.name,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const testSub = await MembershipSubscription.create({
      subscriptionId: `SUB-${Date.now()}`,
      customer: testUser._id,
      membershipPlan: plan._id,
      startDate: new Date(),
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      amount: plan.price,
    });

    testUser.membership.subscriptionId = testSub._id;
    await testUser.save();

    console.log(`✓ Test Member User created: ${testUser.name} (${testUser.membership.planName})`);

    // Case A: 1 Hour, 4 Players
    // Expected: 1 Member gets 1h free (₹0). 3 extra players pay 3 * ₹70 = ₹210. Total = ₹210.
    const price1h4p = await calculateSessionPrice({
      deviceId: ps5._id,
      gameId: tekken._id,
      durationMinutes: 60,
      playersCount: 4,
      customerId: testUser._id,
      bookingDate: testDate,
      startTime: '19:00',
      bookingType: 'SHARED',
    });

    console.log('\n[Case A: 1 Hour, 4 Players]');
    console.log(`- Standard Amount: ₹${price1h4p.standardAmountRupees} (${price1h4p.standardAmountPaise} paise)`);
    console.log(`- Membership Discount: -₹${price1h4p.membershipBenefit?.discountRupees}`);
    console.log(`- Member Amount: ₹${price1h4p.memberBreakdown?.memberAmountRupees}`);
    console.log(`- Additional 3 Players Amount: ₹${price1h4p.memberBreakdown?.additionalPlayersAmountRupees}`);
    console.log(`- Total Payable: ₹${price1h4p.totalAmountRupees}`);
    console.log(`- Breakdown Notice: ${price1h4p.memberBreakdown?.breakdownMessage}`);

    if (price1h4p.totalAmountRupees !== 210) {
      throw new Error(`FAIL: Expected Total Amount for 1h 4p with member to be ₹210, got ₹${price1h4p.totalAmountRupees}`);
    }
    console.log('✓ PASS: Case A correctly calculated ₹210 total (1 member @ ₹0, 3 players @ ₹70).');

    // Case B: 2 Hours, 4 Players
    // Expected: 1 Member: 1st hour free, 2nd hour ₹70 -> ₹70.
    // 3 extra players: 2 hours @ ₹70 each = 3 * ₹140 = ₹420.
    // Total = ₹70 + ₹420 = ₹490.
    const price2h4p = await calculateSessionPrice({
      deviceId: ps5._id,
      gameId: tekken._id,
      durationMinutes: 120,
      playersCount: 4,
      customerId: testUser._id,
      bookingDate: testDate,
      startTime: '19:00',
      bookingType: 'SHARED',
    });

    console.log('\n[Case B: 2 Hours, 4 Players]');
    console.log(`- Standard Amount: ₹${price2h4p.standardAmountRupees}`);
    console.log(`- Membership Discount: -₹${price2h4p.membershipBenefit?.discountRupees}`);
    console.log(`- Member Amount: ₹${price2h4p.memberBreakdown?.memberAmountRupees}`);
    console.log(`- Additional 3 Players Amount: ₹${price2h4p.memberBreakdown?.additionalPlayersAmountRupees}`);
    console.log(`- Total Payable: ₹${price2h4p.totalAmountRupees}`);
    console.log(`- Breakdown Notice: ${price2h4p.memberBreakdown?.breakdownMessage}`);

    if (price2h4p.totalAmountRupees !== 490) {
      throw new Error(`FAIL: Expected Total Amount for 2h 4p with member to be ₹490, got ₹${price2h4p.totalAmountRupees}`);
    }
    console.log('✓ PASS: Case B correctly calculated ₹490 total (Member pays ₹70, 3 players pay ₹420).');

    // Case C: 1 Hour, 1 Player (Solo member booking)
    // Expected: ₹0 (Free session)
    const price1h1p = await calculateSessionPrice({
      deviceId: ps5._id,
      gameId: tekken._id,
      durationMinutes: 60,
      playersCount: 1,
      customerId: testUser._id,
      bookingDate: testDate,
      startTime: '19:00',
      bookingType: 'SHARED',
    });

    console.log('\n[Case C: 1 Hour, 1 Player (Member solo)]');
    console.log(`- Total Payable: ₹${price1h1p.totalAmountRupees} (isFullyCovered: ${price1h1p.membershipBenefit?.isFullyCovered})`);
    if (price1h1p.totalAmountRupees !== 0) {
      throw new Error(`FAIL: Expected Solo Member 1h to be ₹0, got ₹${price1h1p.totalAmountRupees}`);
    }
    console.log('✓ PASS: Case C correctly calculated ₹0 total for solo member.');

    // -------------------------------------------------------------
    // TEST 3: BACKEND PRIVATE BOOKING REJECTION FOR MULTIPLAYER
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Direct API Rejection of Private Booking for Multiplayer ---');
    try {
      await createBookingAtomic({
        customerId: testUser._id,
        deviceId: ps5._id,
        gameId: tekken._id,
        bookingType: 'PRIVATE',
        bookingDate: '2026-11-19',
        startTime: '18:00',
        duration: 1,
        numberOfPlayers: 1,
      });
      throw new Error('FAIL: Backend allowed Private booking for multiplayer title!');
    } catch (apiErr) {
      console.log(`✓ Caught expected error: "${apiErr.message}"`);
      if (!apiErr.message.includes('multiplayer')) {
        throw new Error(`Unexpected error message: ${apiErr.message}`);
      }
      console.log('✓ PASS: Backend successfully blocked Private booking for multiplayer game.');
    }

    // Cleanup temporary test data
    await MembershipSubscription.deleteOne({ _id: testSub._id });
    await User.deleteOne({ _id: testUser._id });
    console.log('\n✓ Test cleanup complete.');

    console.log('\n=================================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    console.log('=================================================================');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
