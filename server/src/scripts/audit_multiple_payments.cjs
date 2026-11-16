const mongoose = require('../../../server/node_modules/mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    const db = mongoose.connection.db;
    const payments = await db.collection('payments').find({
      paymentStatus: { $in: ['PAID', 'PARTIALLY_REFUNDED'] }
    }).toArray();

    const bookingPayments = {};
    for (const p of payments) {
      if (p.booking) {
        const bId = String(p.booking);
        bookingPayments[bId] = bookingPayments[bId] || [];
        bookingPayments[bId].push(p);
      }
    }

    const multiple = Object.entries(bookingPayments).filter(([bId, list]) => list.length > 1);
    console.log('Bookings with multiple paid payments:', multiple.length);

    for (const [bId, list] of multiple) {
      const booking = await db.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(bId) });
      console.log(`\nBooking ${booking?.bookingReference || bId}:`);
      console.log(`  totalAmount: ₹${(booking?.totalAmount || 0) / 100}, advance: ₹${(booking?.advancePaymentAmount || 0) / 100}, balanceRemaining: ₹${(booking?.balanceRemaining || 0) / 100}, paymentStatus: ${booking?.paymentStatus}`);
      console.log(`  Payments (${list.length}):`, list.map(p => ({
        id: p.paymentId,
        amount: `₹${p.amount / 100}`,
        purpose: p.paymentPurpose,
        method: p.paymentMethod,
        date: p.paidAt || p.createdAt
      })));
      const sumPaid = list.reduce((acc, p) => acc + p.amount, 0);
      console.log(`  Sum of payments: ₹${sumPaid / 100} vs totalAmount: ₹${(booking?.totalAmount || 0) / 100}`);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
