const path = require('path');
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    const db = mongoose.connection.db;

    console.log('====================================================');
    console.log('🎮 AUDITING ALL GAMINGSESSION & BOOKING RECORDS');
    console.log('====================================================');

    const sessions = await db.collection('gamingsessions').find().toArray();
    console.log(`Total GamingSession records: ${sessions.length}`);

    const sessionAudit = [];
    for (const s of sessions) {
      const user = await db.collection('users').findOne({ _id: s.customer });
      const booking = await db.collection('bookings').findOne({ _id: s.booking });
      const device = await db.collection('devices').findOne({ _id: s.device });
      const game = s.game ? await db.collection('games').findOne({ _id: s.game }) : null;

      sessionAudit.push({
        sessionId: s._id.toString(),
        customerName: user ? user.name : 'MISSING USER',
        customerEmail: user ? user.email : 'N/A',
        customerRole: user ? user.role : 'N/A',
        bookingId: booking ? booking.bookingId : 'MISSING BOOKING',
        bookingStatus: booking ? booking.bookingStatus : 'N/A',
        bookingDate: booking ? booking.bookingDate : 'N/A',
        deviceName: device ? device.name : 'MISSING DEVICE',
        gameName: game ? game.name : (device && device.deviceType === 'POOL' ? '8-Ball Pool' : 'None'),
        status: s.status,
        startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : 'N/A',
        scheduledEndAt: s.scheduledEndAt ? new Date(s.scheduledEndAt).toISOString() : 'N/A',
        actualEndAt: s.actualEndAt ? new Date(s.actualEndAt).toISOString() : 'None',
      });
    }

    console.table(sessionAudit);

    // Group by customer
    const grouped = {};
    for (const s of sessionAudit) {
      const k = `${s.customerName} (${s.customerEmail}) [${s.customerRole}]`;
      grouped[k] = (grouped[k] || 0) + 1;
    }
    console.log('\nSessions by Customer/User:');
    console.table(Object.entries(grouped).map(([user, count]) => ({ user, sessionCount: count })));

    // Now inspect the 9 bookings of Lounge Admin
    const admin = await db.collection('users').findOne({ role: 'admin' });
    console.log(`\nLounge Admin ID: ${admin._id}`);
    const adminBookings = await db.collection('bookings').find({ customer: admin._id }).toArray();
    console.log(`Total Bookings for Lounge Admin: ${adminBookings.length}`);
    console.table(adminBookings.map(b => ({
      bookingId: b.bookingId,
      bookingDate: b.bookingDate,
      time: `${b.startTime} - ${b.endTime}`,
      bookingStatus: b.bookingStatus,
      sessionStatus: b.sessionStatus,
      totalAmountRupees: b.totalAmount / 100,
      amountPaidRupees: b.amountPaid / 100,
      paymentStatus: b.paymentStatus
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
