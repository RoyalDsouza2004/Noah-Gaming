const path = require('path');
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
  const db = mongoose.connection.db;

  const users = await db.collection('users').find().toArray();
  console.log(`Total users in DB: ${users.length}`);

  for (const u of users) {
    const bTotal = await db.collection('bookings').countDocuments({ customer: u._id });
    const bCompleted = await db.collection('bookings').countDocuments({ customer: u._id, bookingStatus: 'COMPLETED' });
    const bConfirmed = await db.collection('bookings').countDocuments({ customer: u._id, bookingStatus: 'CONFIRMED' });
    const sTotal = await db.collection('gamingsessions').countDocuments({ customer: u._id });

    if (bTotal === 9 || bCompleted === 9 || sTotal === 9 || bTotal > 0 || sTotal > 0) {
      console.log(`[${u.role}] ${u.name} (${u.email}) - _id: ${u._id}:`);
      console.log(`  Bookings: total=${bTotal}, completed=${bCompleted}, confirmed=${bConfirmed}`);
      console.log(`  GamingSessions: ${sTotal}`);
    }
  }

  process.exit(0);
})();
