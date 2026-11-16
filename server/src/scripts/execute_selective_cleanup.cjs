const mongoose = require('mongoose');

async function execute() {
  console.log('====================================================');
  console.log('🧹 EXECUTING SELECTIVE LOCAL MONGODB TEST DATA CLEANUP');
  console.log('====================================================');
  console.log('Connecting to local MongoDB: mongodb://127.0.0.1:27017/gaming_lounge...');
  await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
  const db = mongoose.connection.db;

  const preservedUserIds = [
    new mongoose.Types.ObjectId('6af8109b11e34f99b5263277'), // admin@gaminglounge.com
    new mongoose.Types.ObjectId('6af8109b11e34f99b526327c'), // reception@gaminglounge.com
    new mongoose.Types.ObjectId('6af812464e950ff72824844e'), // customer@gaminglounge.com
  ];

  console.log('\n1. Removing test users (preserving the 3 original accounts)...');
  const userRes = await db.collection('users').deleteMany({ _id: { $nin: preservedUserIds } });
  console.log(`   ✓ Deleted ${userRes.deletedCount} test users.`);

  console.log('\n2. Resetting active membership state on preserved users...');
  const resetRes = await db.collection('users').updateMany(
    { _id: { $in: preservedUserIds } },
    {
      $set: {
        membership: {
          status: 'NONE',
          planId: null,
          subscriptionId: null,
          expiresAt: null,
          dailyUsageMinutesUsed: 0,
          lastUsageDate: '',
        },
        currentMembership: null,
        activeSubscription: null,
        membershipExpiresAt: null,
        membershipTier: null,
      },
    }
  );
  console.log(`   ✓ Reset membership status on ${resetRes.modifiedCount} accounts.`);

  console.log('\n3. Deleting all test bookings...');
  const bookRes = await db.collection('bookings').deleteMany({});
  console.log(`   ✓ Deleted ${bookRes.deletedCount} bookings.`);

  console.log('\n4. Deleting all historical gaming sessions...');
  const sessRes = await db.collection('gamingsessions').deleteMany({});
  console.log(`   ✓ Deleted ${sessRes.deletedCount} gaming sessions.`);

  console.log('\n5. Deleting all test payments & receipts...');
  const payRes = await db.collection('payments').deleteMany({});
  console.log(`   ✓ Deleted ${payRes.deletedCount} payments & associated receipts.`);

  console.log('\n6. Deleting test refunds...');
  const refRes = await db.collection('refunds').deleteMany({});
  console.log(`   ✓ Deleted ${refRes.deletedCount} refunds.`);

  console.log('\n7. Deleting purchased subscriptions, upgrades & usages...');
  const subRes = await db.collection('membershipsubscriptions').deleteMany({});
  const upgRes = await db.collection('membershipupgrades').deleteMany({});
  const useRes = await db.collection('membershipusages').deleteMany({});
  console.log(`   ✓ Deleted ${subRes.deletedCount} subscriptions, ${upgRes.deletedCount} upgrades, ${useRes.deletedCount} usages.`);

  console.log('\n8. Deleting notifications & deliveries...');
  const notRes = await db.collection('notifications').deleteMany({});
  const delRes = await db.collection('notificationdeliveries').deleteMany({});
  console.log(`   ✓ Deleted ${notRes.deletedCount} notifications, ${delRes.deletedCount} deliveries.`);

  console.log('\n9. Deleting activity & automation logs...');
  const actRes = await db.collection('activitylogs').deleteMany({});
  const autRes = await db.collection('automationlogs').deleteMany({});
  console.log(`   ✓ Deleted ${actRes.deletedCount} activity logs, ${autRes.deletedCount} automation logs.`);

  console.log('\n====================================================');
  console.log('📊 VERIFYING POST-CLEANUP DATABASE INTEGRITY');
  console.log('====================================================');

  const remUsers = await db.collection('users').find({}).toArray();
  const remGames = await db.collection('games').find({}).toArray();
  const remDevices = await db.collection('devices').find({}).toArray();
  const remPlans = await db.collection('membershipplans').find({}).toArray();

  const remBookings = await db.collection('bookings').countDocuments();
  const remSessions = await db.collection('gamingsessions').countDocuments();
  const remPayments = await db.collection('payments').countDocuments();
  const remSubscriptions = await db.collection('membershipsubscriptions').countDocuments();
  const remRefunds = await db.collection('refunds').countDocuments();

  console.log(`• Users (${remUsers.length}):`);
  remUsers.forEach(u => console.log(`    - [${u._id}] ${u.email} (${u.role}) | Membership: ${u.membership?.status}`));
  
  console.log(`• Devices (${remDevices.length}):`);
  remDevices.forEach(d => console.log(`    - [${d._id}] ${d.name} (${d.deviceCode})`));

  console.log(`• Games (${remGames.length}):`);
  remGames.forEach(g => console.log(`    - [${g._id}] ${g.name} ${g.isExclusive ? '(Exclusive)' : ''}`));

  console.log(`• Membership Plans (${remPlans.length}):`);
  remPlans.forEach(p => console.log(`    - [${p._id}] ${p.name} (₹${p.price / 100})`));

  console.log(`• Remaining Bookings: ${remBookings}`);
  console.log(`• Remaining Sessions: ${remSessions}`);
  console.log(`• Remaining Payments: ${remPayments}`);
  console.log(`• Remaining Subscriptions: ${remSubscriptions}`);
  console.log(`• Remaining Refunds: ${remRefunds}`);

  await mongoose.disconnect();
  console.log('\n✅ SELECTIVE CLEANUP FULLY COMPLETED.');
}

if (require.main === module) {
  execute().catch(console.error);
}

module.exports = { execute };
