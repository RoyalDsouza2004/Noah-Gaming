import connectDB from '../config/db.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import Pricing from '../models/Pricing.js';

async function sanitizeEquipment() {
  console.log('Sanitizing Lounge Equipment & Games Architecture...');
  await connectDB();

  // 1. Strictly remove any devices that are NOT PS5 Station 1, PS5 Station 2, or 8-Ball Pool Table
  const deletedDevices = await Device.deleteMany({
    deviceCode: { $nin: ['PS5-01', 'PS5-02', 'POOL-01'] },
  });
  console.log(`✓ Removed ${deletedDevices.deletedCount} non-canonical devices.`);

  // 2. Ensure only exactly the 3 physical devices exist with canonical details
  const ps51 = await Device.findOneAndUpdate(
    { deviceCode: 'PS5-01' },
    {
      name: 'PS5 Station 1',
      deviceCode: 'PS5-01',
      deviceType: 'PS5',
      description: 'PlayStation 5 Console Station 1 with DualSense 4K HDR gaming setup.',
      capacity: 4,
      status: 'ACTIVE',
    },
    { upsert: true, new: true }
  );

  const ps52 = await Device.findOneAndUpdate(
    { deviceCode: 'PS5-02' },
    {
      name: 'PS5 Station 2',
      deviceCode: 'PS5-02',
      deviceType: 'PS5',
      description: 'PlayStation 5 Console Station 2 with DualSense 4K HDR gaming setup.',
      capacity: 4,
      status: 'ACTIVE',
    },
    { upsert: true, new: true }
  );

  const pool = await Device.findOneAndUpdate(
    { deviceCode: 'POOL-01' },
    {
      name: '8-Ball Pool Table',
      deviceCode: 'POOL-01',
      deviceType: 'POOL',
      description: 'Professional tournament slate 8-ball pool table with cues and tournament ball set.',
      capacity: 4,
      status: 'ACTIVE',
    },
    { upsert: true, new: true }
  );

  // 3. Remove test games or duplicates
  await Game.deleteMany({ name: 'God of War Ragnarök' });

  // 4. Update or create GTA 6 exclusive pricing plan (₹150/hr per console)
  let gtaPricing = await Pricing.findOne({
    $or: [{ name: /GTA 6/i }, { deviceType: 'EXCLUSIVE' }],
  });

  if (!gtaPricing) {
    gtaPricing = new Pricing({
      name: 'GTA 6 Exclusive Hourly Rate',
      deviceType: 'PS5',
      billingType: 'PER_DEVICE_HOURLY',
      amount: 15000, // ₹150.00
      minimumDuration: 60,
      maximumDuration: 240,
      status: 'ACTIVE',
    });
    await gtaPricing.save();
  } else {
    gtaPricing.name = 'GTA 6 Exclusive Hourly Rate';
    gtaPricing.deviceType = 'PS5';
    gtaPricing.billingType = 'PER_DEVICE_HOURLY';
    gtaPricing.amount = 15000;
    gtaPricing.status = 'ACTIVE';
    await gtaPricing.save();
  }

  // 5. Ensure GTA 6 is in Game collection, marked as isExclusive, assigned to BOTH physical PS5 consoles
  let gta6Game = await Game.findOne({ name: 'GTA 6' });
  if (gta6Game) {
    gta6Game.isExclusive = true;
    gta6Game.compatibleDevices = [ps51._id, ps52._id];
    gta6Game.pricing = gtaPricing._id;
    gta6Game.advancePaymentRequired = true;
    gta6Game.minimumAdvancePayment = 7500; // 50% = ₹75
    await gta6Game.save();

    gtaPricing.game = gta6Game._id;
    await gtaPricing.save();
  }

  // 6. Ensure all regular PS5 games are compatible with both physical PS5s
  await Game.updateMany(
    { name: { $in: ['EA Sports FC 25', 'Tekken 8', 'Gran Turismo 7', 'Spider-Man 2'] } },
    { $set: { compatibleDevices: [ps51._id, ps52._id] } }
  );

  // Verification log
  const activeDevices = await Device.find({});
  console.log(`\nVerified Lounge Physical Devices Count: ${activeDevices.length}`);
  activeDevices.forEach((d) => console.log(`  - [${d.deviceCode}] ${d.name} (${d.deviceType}) Capacity: ${d.capacity}`));

  const allGames = await Game.find({}).populate('compatibleDevices');
  console.log(`\nVerified Games Count: ${allGames.length}`);
  allGames.forEach((g) => {
    console.log(
      `  - ${g.name} | Exclusive: ${g.isExclusive} | Compatible with: [${g.compatibleDevices.map((d) => d.deviceCode).join(', ')}]`
    );
  });

  console.log('\n✓ Architectural Equipment Sanity Check Complete!');
  process.exit(0);
}

sanitizeEquipment().catch((err) => {
  console.error('Sanitization failed:', err);
  process.exit(1);
});
