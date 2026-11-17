import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });

import { connectDB } from '../config/db.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Pricing from '../models/Pricing.js';
import { searchCustomersForReceptionist } from '../services/receptionist.service.js';

async function run() {
  await connectDB();
  console.log('--- DIAGNOSTIC SCRIPT ---');

  // 1. Check Active Bookings
  const activeBookings = await Booking.find({ sessionStatus: { $in: ['ACTIVE', 'EXTENDED'] } })
    .populate('customer device game');
  console.log('Active bookings count:', activeBookings.length);
  for (const b of activeBookings) {
    console.log({
      bookingId: b.bookingId,
      customer: b.customer?.name,
      device: b.device?.name,
      gameId: b.game?._id,
      gameName: b.game?.name,
      gameIsExclusive: b.game?.isExclusive,
      isVenueSelection: b.isVenueSelection,
      gameClassification: b.gameClassification,
      gameTitle: b.gameTitle,
      bookingType: b.bookingType,
      numberOfPlayers: b.numberOfPlayers,
      totalAmount: b.totalAmount,
    });
  }

  // 2. Check Customer Search
  console.log('\n--- TESTING CUSTOMER SEARCH ---');
  const testQueries = ['customer', '9876543212', 'admin', 'Test', '98765'];
  for (const q of testQueries) {
    const results = await searchCustomersForReceptionist({ query: q });
    console.log(`Query "${q}" matched ${results.length} users:`, results.map(u => ({
      name: u.name,
      phone: u.phone,
      email: u.email,
      customerId: u.customerId,
      accountType: u.accountType,
      role: u.role
    })));
  }

  // 3. Check Pricing Models
  console.log('\n--- PRICING CONFIGURATION ---');
  const pricings = await Pricing.find({});
  console.log('Pricing rules count:', pricings.length);
  for (const p of pricings) {
    console.log({
      name: p.name,
      deviceType: p.deviceType,
      billingType: p.billingType,
      basePriceRupees: p.basePrice,
      hourlyRateRupees: p.hourlyRate,
      isActive: p.isActive,
    });
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
