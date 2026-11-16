import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import GameCategory from '../models/GameCategory.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Pricing from '../models/Pricing.js';
import ActivityLog from '../models/ActivityLog.js';
import { ROLES, DEFAULT_CONFIG } from '../config/constants.js';

async function seedDatabase() {
  try {
    console.log('--- Initiating Full Database Seeding (Phase 1 & Phase 2) ---');
    await connectDB();

    // 1. Settings
    const defaultSettings = [
      {
        key: 'pricing_config',
        category: 'PRICING',
        description: 'Configurable hourly rates and capacity per equipment category',
        value: {
          ps5HourlyRate: DEFAULT_CONFIG.PS5_HOURLY_RATE,
          ps5MaxPlayers: DEFAULT_CONFIG.PS5_MAX_CAPACITY,
          poolHourlyRate: DEFAULT_CONFIG.POOL_HOURLY_RATE,
          poolMaxPlayers: DEFAULT_CONFIG.POOL_MAX_CAPACITY,
          gta6HourlyRate: DEFAULT_CONFIG.GTA6_HOURLY_RATE,
          gta6Active: DEFAULT_CONFIG.GTA6_ACTIVE,
          advancePaymentMinPct: DEFAULT_CONFIG.ADVANCE_PAYMENT_MIN_PCT,
        },
      },
      {
        key: 'operating_hours',
        category: 'HOURS',
        description: 'Daily opening and closing times in IST',
        value: {
          openTime: '10:00',
          closeTime: '23:00',
          slotDurationMinutes: 60,
          allowCustomDuration: true,
        },
      },
      {
        key: 'booking_rules',
        category: 'RULES',
        description: 'Auto-release unpaid hold timer and cancellation terms',
        value: {
          autoReleaseUnpaidMinutes: DEFAULT_CONFIG.AUTO_RELEASE_UNPAID_MINUTES,
          cancellationRefundThresholdHours: 2,
          reminderMinutesBefore: [15, 5],
        },
      },
    ];

    for (const setting of defaultSettings) {
      await Setting.findOneAndUpdate(
        { key: setting.key },
        { $set: setting },
        { upsert: true, new: true }
      );
    }
    console.log('✓ Configurable Settings Initialized');

    // 2. Default Accounts
    const defaultAccounts = [
      {
        name: 'Lounge Admin',
        email: 'admin@gaminglounge.com',
        phone: '9876543210',
        password: 'AdminPassword@123',
        role: ROLES.ADMIN,
      },
      {
        name: 'Front Desk Reception',
        email: 'reception@gaminglounge.com',
        phone: '9876543211',
        password: 'StaffPassword@123',
        role: ROLES.RECEPTIONIST,
      },
      {
        name: 'Aryan Sharma',
        email: 'customer@gaminglounge.com',
        phone: '9876543212',
        password: 'CustomerPassword@123',
        role: ROLES.CUSTOMER,
      },
    ];

    for (const acc of defaultAccounts) {
      let user = await User.findOne({ email: acc.email });
      if (!user) {
        user = new User(acc);
        await user.save();
        console.log(`✓ Seeded ${acc.role.toUpperCase()}: ${acc.email} / ${acc.password}`);

        await ActivityLog.create({
          userId: user._id,
          userName: user.name,
          userRole: user.role,
          action: 'SEED_INITIAL_ACCOUNT',
          category: 'AUTH',
          details: { email: user.email, role: user.role },
        });
      } else {
        console.log(`ℹ Account already exists: ${acc.email} (${acc.role})`);
      }
    }

    // 3. Game Categories (Phase 2 Requirement)
    const initialCategories = [
      { name: 'Sports', description: 'Competitive athletics, football, and team simulation titles' },
      { name: 'Racing', description: 'High-speed track and open-road motorsport games' },
      { name: 'Action', description: 'Fast-paced combat, shooter, and blockbuster titles' },
      { name: 'Adventure', description: 'Immersive story-driven campaigns and open worlds' },
      { name: 'Fighting', description: '1v1 and tag-team martial arts and brawlers' },
      { name: 'Multiplayer', description: 'Cooperative and competitive party and couch games' },
      { name: 'Exclusive Games', description: 'VIP marquee games requiring advance reservation' },
    ];

    const categoryMap = {};
    for (const cat of initialCategories) {
      const savedCat = await GameCategory.findOneAndUpdate(
        { name: cat.name },
        { $set: cat },
        { upsert: true, new: true }
      );
      categoryMap[cat.name] = savedCat._id;
    }
    console.log(`✓ Seeded ${initialCategories.length} Game Categories`);

    // 4. Initial Gaming Equipment / Devices (Phase 2 Requirement)
    const initialDevices = [
      {
        name: 'PS5 Station 1',
        deviceCode: 'PS5-01',
        deviceType: 'PS5',
        description: 'Custom 4K 120Hz Sony PlayStation 5 Station with 4 DualSense wireless controllers.',
        image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80',
        capacity: 4,
        status: 'ACTIVE',
      },
      {
        name: 'PS5 Station 2',
        deviceCode: 'PS5-02',
        deviceType: 'PS5',
        description: 'Sony PlayStation 5 Station with ultra-low latency OLED display and 4 controllers.',
        image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
        capacity: 4,
        status: 'ACTIVE',
      },
      {
        name: '8-Ball Pool Table',
        deviceCode: 'POOL-01',
        deviceType: 'POOL',
        description: 'Tournament-grade slate bed billiards table with premium cues and Belgian balls.',
        image: 'https://images.unsplash.com/photo-1596707255563-7186a8b792e3?w=600&auto=format&fit=crop&q=80',
        capacity: 2,
        status: 'ACTIVE',
      },
    ];

    const deviceMap = {};
    for (const dev of initialDevices) {
      const savedDev = await Device.findOneAndUpdate(
        { deviceCode: dev.deviceCode },
        { $set: dev },
        { upsert: true, new: true }
      );
      deviceMap[dev.deviceCode] = savedDev._id;
    }
    console.log(`✓ Seeded ${initialDevices.length} Gaming Devices`);

    // 5. Centralized Pricing Rules (Phase 2 Requirement - Stored in precision-safe paise)
    const initialPricing = [
      {
        name: 'PS5 Standard Hourly Rate',
        deviceType: 'PS5',
        billingType: 'PER_PLAYER_HOURLY',
        amount: 7000, // ₹70 per player per hour
        currency: 'INR',
        minimumDuration: 60,
        maximumDuration: 240,
        status: 'ACTIVE',
      },
      {
        name: '8-Ball Pool Table Rate',
        deviceType: 'POOL',
        billingType: 'PER_PLAYER_HOURLY',
        amount: 15000, // ₹150 per player per hour
        currency: 'INR',
        minimumDuration: 60,
        maximumDuration: 240,
        status: 'ACTIVE',
      },
      {
        name: 'GTA 6 Exclusive Hourly Rate',
        deviceType: 'EXCLUSIVE',
        billingType: 'PER_DEVICE_HOURLY',
        amount: 15000, // ₹150 per hour
        currency: 'INR',
        minimumDuration: 60,
        maximumDuration: 240,
        status: 'ACTIVE',
      },
    ];

    const pricingMap = {};
    for (const pr of initialPricing) {
      const savedPr = await Pricing.findOneAndUpdate(
        { name: pr.name },
        { $set: pr },
        { upsert: true, new: true }
      );
      pricingMap[pr.deviceType] = savedPr._id;
    }
    console.log(`✓ Seeded ${initialPricing.length} Centralized Pricing Rules in Paise`);

    // 6. Games (including GTA 6 Exclusive - DISABLED by default)
    const ps5DeviceIds = [deviceMap['PS5-01'], deviceMap['PS5-02']].filter(Boolean);

    const initialGames = [
      {
        name: 'EA Sports FC 25',
        description: 'The premier next-gen football experience featuring 19,000+ players and authentic tournament modes.',
        thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop&q=80',
        category: categoryMap['Sports'],
        compatibleDevices: ps5DeviceIds,
        isExclusive: false,
        pricing: pricingMap['PS5'],
        advancePaymentRequired: false,
        status: 'ACTIVE',
      },
      {
        name: 'Tekken 8',
        description: 'The legendary 3D fighting game series returns with visceral Next-Gen graphics and new Heat system.',
        thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&auto=format&fit=crop&q=80',
        category: categoryMap['Fighting'],
        compatibleDevices: ps5DeviceIds,
        isExclusive: false,
        pricing: pricingMap['PS5'],
        advancePaymentRequired: false,
        status: 'ACTIVE',
      },
      {
        name: 'Gran Turismo 7',
        description: 'The real driving simulator featuring over 400 meticulously modeled cars and dynamic weather.',
        thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&auto=format&fit=crop&q=80',
        category: categoryMap['Racing'],
        compatibleDevices: ps5DeviceIds,
        isExclusive: false,
        pricing: pricingMap['PS5'],
        advancePaymentRequired: false,
        status: 'ACTIVE',
      },
      {
        name: 'Spider-Man 2',
        description: 'Peter Parker and Miles Morales team up in Marvel’s New York to battle Venom and Kraven the Hunter.',
        thumbnail: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=400&auto=format&fit=crop&q=80',
        category: categoryMap['Action'],
        compatibleDevices: ps5DeviceIds,
        isExclusive: false,
        pricing: pricingMap['PS5'],
        advancePaymentRequired: false,
        status: 'ACTIVE',
      },
      {
        name: 'GTA 6',
        description: 'Grand Theft Auto VI takes players to the neon-soaked streets of Vice City. Premium exclusive title.',
        thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&auto=format&fit=crop&q=80',
        category: categoryMap['Exclusive Games'],
        compatibleDevices: ps5DeviceIds,
        isExclusive: true,
        pricing: pricingMap['EXCLUSIVE'],
        advancePaymentRequired: true,
        minimumAdvancePayment: 7500, // 50% = ₹75 (stored in paise)
        minimumDuration: 60,
        maximumDuration: 240,
        status: 'INACTIVE', // CRITICAL: DISABLED by default until Admin activates it!
      },
    ];

    for (const gm of initialGames) {
      const savedGame = await Game.findOneAndUpdate(
        { name: gm.name },
        { $set: gm },
        { upsert: true, new: true }
      );
      // Link game to devices
      if (gm.compatibleDevices && gm.compatibleDevices.length > 0) {
        await Device.updateMany(
          { _id: { $in: gm.compatibleDevices } },
          { $addToSet: { supportedGames: savedGame._id } }
        );
      }
    }
    console.log(`✓ Seeded ${initialGames.length} Games (GTA 6 confirmed DISABLED by default)`);

    console.log('-------------------------------------------');
    console.log('🎉 Phase 2 Database Seeding Completed Successfully!');
    console.log('-------------------------------------------');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
