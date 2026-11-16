const path = require('path');
const dotenv = require(path.resolve(__dirname, '../../node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));
const jwt = require(path.resolve(__dirname, '../../node_modules/jsonwebtoken'));

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
  const db = mongoose.connection.db;

  const users = await db.collection('users').find().toArray();
  const JWT_SECRET = process.env.JWT_SECRET;
  console.log('Using JWT_SECRET:', JWT_SECRET ? 'Loaded' : 'Missing');

  for (const u of users) {
    const token = jwt.sign({ id: u._id, role: u.role }, JWT_SECRET, { expiresIn: '1d' });

    try {
      const dashRes = await fetch('http://localhost:5000/api/users/dashboard', {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(r => r.json());

      const histRes = await fetch('http://localhost:5000/api/users/gaming-history', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      const totalSess = dashRes.data?.metrics?.totalGamingSessions;
      const histStatus = histRes.status;
      const histData = await histRes.json();

      if (totalSess === 9 || histData.data?.counts?.completed === 9 || histData.data?.counts?.totalSessions === 9 || histData.data?.bookings?.length === 9 || !histRes.ok) {
        console.log(`\n*** MATCHING USER: ${u.name} (${u.email}) [Role: ${u.role}, ID: ${u._id}] ***`);
        console.log(`  Dashboard totalGamingSessions: ${totalSess}`);
        console.log(`  Gaming History HTTP Status: ${histStatus}`);
        console.log(`  Gaming History Counts:`, histData.data?.counts);
        console.log(`  Gaming History Bookings Length:`, histData.data?.bookings?.length);
        if (!histRes.ok) {
          console.log(`  ERROR RESPONSE:`, histData);
        }
      }
    } catch (e) {
      console.error(`Error for ${u.email}:`, e.message);
    }
  }

  process.exit(0);
})();
