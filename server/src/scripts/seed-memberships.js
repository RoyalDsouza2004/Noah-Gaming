import { connectDB } from '../config/db.js';
import MembershipPlan from '../models/MembershipPlan.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';

async function seedMemberships() {
  await connectDB();
  console.log('\n--- Seeding Initial Membership Plans & Customer Profiles ---');

  // 1. Ensure all existing customers have customerId
  const users = await User.find();
  for (const user of users) {
    let changed = false;
    if (!user.customerId) {
      const dateStr = user.createdAt ? user.createdAt.toISOString().slice(0, 10).replace(/-/g, '') : '20261114';
      const rand = Math.floor(1000 + Math.random() * 9000);
      user.customerId = `CUST-${dateStr}-${rand}`;
      changed = true;
    }
    if (!user.accountStatus) {
      user.accountStatus = 'ACTIVE';
      changed = true;
    }
    if (changed) await user.save();
  }
  console.log(`✓ Verified ${users.length} user profiles with customer IDs.`);

  // 2. Fetch devices & games
  const ps51 = await Device.findOne({ deviceCode: 'PS5-01' });
  const ps52 = await Device.findOne({ deviceCode: 'PS5-02' });
  const pool = await Device.findOne({ deviceCode: 'POOL-01' });
  const gta6 = await Game.findOne({ name: 'GTA 6' });

  const ps5Devices = [ps51?._id, ps52?._id].filter(Boolean);
  const allDevices = [ps51?._id, ps52?._id, pool?._id].filter(Boolean);

  // 3. Define standard plans
  const plansData = [
    {
      name: 'Basic Gamer Monthly',
      description: 'Ideal for casual players. 1 hour of daily gaming on any PS5 station or Pool Table.',
      price: 49900, // ₹499
      validityDuration: 30,
      validityUnit: 'DAYS',
      eligibleDevices: allDevices,
      eligibleGames: [], // All standard games
      isUnlimited: false,
      dailyUsageLimit: 60, // 1 hour / day
      maximumSessionDuration: 60,
      maximumBookingsPerDay: 1,
      advanceBookingLimit: 3,
      privateBookingAllowed: false,
      sharedBookingAllowed: true,
      includesExclusiveGames: false,
      discountPercentage: 100,
      status: 'ACTIVE',
    },
    {
      name: 'Standard Pro Pass',
      description: 'Our most popular plan. 2 hours of daily gaming across all PS5 consoles and 8-ball pool table.',
      price: 99900, // ₹999
      validityDuration: 30,
      validityUnit: 'DAYS',
      eligibleDevices: allDevices,
      eligibleGames: [],
      isUnlimited: false,
      dailyUsageLimit: 120, // 2 hours / day
      maximumSessionDuration: 120,
      maximumBookingsPerDay: 2,
      advanceBookingLimit: 7,
      privateBookingAllowed: false,
      sharedBookingAllowed: true,
      includesExclusiveGames: false,
      discountPercentage: 100,
      status: 'ACTIVE',
    },
    {
      name: 'Premium Unlimited Membership',
      description: 'Unlimited monthly gaming access with 3 hours daily fair-use allowance and priority booking advance.',
      price: 199900, // ₹1,999
      validityDuration: 30,
      validityUnit: 'DAYS',
      eligibleDevices: allDevices,
      eligibleGames: [],
      isUnlimited: true,
      dailyUsageLimit: 180, // 3 hours / day
      maximumSessionDuration: 180,
      maximumBookingsPerDay: 3,
      advanceBookingLimit: 14,
      privateBookingAllowed: false,
      sharedBookingAllowed: true,
      includesExclusiveGames: false, // GTA 6 requires separate exclusive tier
      discountPercentage: 100,
      status: 'ACTIVE',
    },
    {
      name: 'Ultimate VIP (Includes GTA 6)',
      description: 'All-inclusive VIP membership covering regular titles and exclusive GTA 6 private station bookings.',
      price: 349900, // ₹3,499
      validityDuration: 30,
      validityUnit: 'DAYS',
      eligibleDevices: allDevices,
      eligibleGames: [],
      isUnlimited: true,
      dailyUsageLimit: 240, // 4 hours / day
      maximumSessionDuration: 180,
      maximumBookingsPerDay: 4,
      advanceBookingLimit: 30,
      privateBookingAllowed: true, // Allows private exclusive console locking
      sharedBookingAllowed: true,
      includesExclusiveGames: true, // EXPLICITLY COVERS GTA 6!
      discountPercentage: 100,
      status: 'ACTIVE',
    },
  ];

  for (const p of plansData) {
    const existing = await MembershipPlan.findOne({ name: p.name });
    if (!existing) {
      await MembershipPlan.create(p);
      console.log(`✓ Created plan: ${p.name} (₹${p.price / 100})`);
    } else {
      Object.assign(existing, p);
      await existing.save();
      console.log(`✓ Updated plan: ${p.name} (₹${p.price / 100})`);
    }
  }

  console.log('--- Seeding Complete ---\n');
  process.exit(0);
}

seedMemberships().catch((err) => {
  console.error('Seeding Error:', err);
  process.exit(1);
});
