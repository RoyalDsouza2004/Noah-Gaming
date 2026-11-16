const mongoose = require('../../../server/node_modules/mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    const db = mongoose.connection.db;

    const subs = await db.collection('membershipsubscriptions').find().toArray();
    console.log(`Total membershipsubscriptions in DB: ${subs.length}`);

    const plans = await db.collection('membershipplans').find().toArray();
    const planMap = {};
    for (const p of plans) {
      planMap[String(p._id)] = p.name;
    }
    console.log('Plans map:', planMap);

    const users = await db.collection('users').find().toArray();
    const userMap = {};
    for (const u of users) {
      userMap[String(u._id)] = { name: u.name, email: u.email, membership: u.membership };
    }

    console.log('\n--- ALL SUBSCRIPTIONS ---');
    console.table(subs.map(s => {
      const u = userMap[String(s.customer)] || {};
      const planName = planMap[String(s.membershipPlan)] || 'Unknown';
      const isExpired = s.expirationDate ? new Date(s.expirationDate) < new Date() : false;
      return {
        subId: s.subscriptionId,
        customerName: u.name,
        planName,
        status: s.status,
        isExpiredByDate: isExpired,
        start: s.startDate ? new Date(s.startDate).toLocaleDateString() : 'N/A',
        exp: s.expirationDate ? new Date(s.expirationDate).toLocaleDateString() : 'N/A'
      };
    }));

    // Find users with subscription history
    const userSubs = {};
    for (const s of subs) {
      const cId = String(s.customer);
      userSubs[cId] = userSubs[cId] || [];
      userSubs[cId].push(s);
    }

    console.log(`\nUnique customers who purchased subscriptions: ${Object.keys(userSubs).length}`);

    // Check top spenders
    const payments = await db.collection('payments').find({
      paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] }
    }).toArray();

    const spendMap = {};
    for (const p of payments) {
      const cId = String(p.customer);
      spendMap[cId] = (spendMap[cId] || 0) + (p.amount || 0);
    }

    const topCustomerIds = Object.entries(spendMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('\n--- TOP 10 SPENDERS AND THEIR SUBSCRIPTIONS ---');
    console.table(topCustomerIds.map(([cId, spentPaise]) => {
      const u = userMap[cId] || {};
      const custSubs = userSubs[cId] || [];
      return {
        name: u.name,
        email: u.email,
        spentRupees: spentPaise / 100,
        subsCount: custSubs.length,
        userDocStatus: u.membership?.status,
        subStatuses: custSubs.map(s => `${planMap[String(s.membershipPlan)] || 'plan'}: ${s.status} (exp: ${s.expirationDate ? new Date(s.expirationDate).toISOString().slice(0, 10) : 'none'})`).join('; ')
      };
    }));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
