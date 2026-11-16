const path = require('path');
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    const db = mongoose.connection.db;

    console.log('====================================================');
    console.log('🔍 INVESTIGATING GAMING SESSIONS & BOOKINGS');
    console.log('====================================================');

    const users = await db.collection('users').find({ role: 'customer' }).toArray();
    console.log(`Total customers found: ${users.length}`);

    // Check which customers have bookings / gaming sessions
    for (const u of users) {
      const bCount = await db.collection('bookings').countDocuments({ customer: u._id });
      const sCount = await db.collection('gamingsessions').countDocuments({ customer: u._id });
      if (bCount > 0 || sCount > 0) {
        console.log(`Customer: ${u.name} (${u.email}) - _id: ${u._id}`);
        console.log(`  Bookings count: ${bCount}`);
        console.log(`  GamingSessions count: ${sCount}`);
      }
    }

    // Inspect all 32 gamingsessions in DB
    const allSessions = await db.collection('gamingsessions').find().toArray();
    console.log(`\nTotal gamingsessions in DB: ${allSessions.length}`);

    // Check if there are sessions for any customer
    const sessionCustomerMap = {};
    for (const s of allSessions) {
      const cId = String(s.customer);
      sessionCustomerMap[cId] = (sessionCustomerMap[cId] || 0) + 1;
    }
    console.log('GamingSessions count by customer:', sessionCustomerMap);

    // Let's test calling the actual API endpoint /api/users/gaming-history
    console.log('\n--- TESTING API ENDPOINT WITH CUSTOMERS ---');
    // Try logging in with the customer accounts
    const testAccounts = [
      { email: 'customer@gaminglounge.com', pass: 'CustomerPassword@123' },
      { email: 'customer2@gaminglounge.com', pass: 'CustomerPassword@123' },
    ];

    for (const acc of testAccounts) {
      try {
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: acc.email, password: acc.pass })
        }).then(r => r.json());

        if (!loginRes.success) {
          console.log(`Login failed for ${acc.email}:`, loginRes.message);
          continue;
        }

        const token = loginRes.data.token;
        console.log(`\nTesting ${acc.email} (${loginRes.data.user.name}):`);

        // 1. Dashboard
        const dashRes = await fetch('http://localhost:5000/api/users/dashboard', {
          headers: { 'Authorization': 'Bearer ' + token }
        }).then(r => r.json());
        console.log('  Dashboard totalGamingSessions:', dashRes.data?.totalGamingSessions);

        // 2. Gaming History
        const histRes = await fetch('http://localhost:5000/api/users/gaming-history', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        console.log('  Gaming History HTTP Status:', histRes.status);
        const histData = await histRes.json();
        console.log('  Gaming History Response:', JSON.stringify(histData, null, 2));
      } catch (e) {
        console.error(`  Error testing ${acc.email}:`, e.message);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
