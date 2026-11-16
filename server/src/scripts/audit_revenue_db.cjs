const mongoose = require('../../../server/node_modules/mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    console.log('Connected to MongoDB gaming_lounge');

    const db = mongoose.connection.db;
    const paymentsColl = db.collection('payments');
    const bookingsColl = db.collection('bookings');
    const refundsColl = db.collection('refunds');

    const allPayments = await paymentsColl.find({}).toArray();
    console.log(`Total payments in DB: ${allPayments.length}`);

    const statusCounts = {};
    for (const p of allPayments) {
      statusCounts[p.paymentStatus] = (statusCounts[p.paymentStatus] || 0) + 1;
    }
    console.log('Payment status counts:', statusCounts);

    const paidPayments = allPayments.filter(p => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIALLY_REFUNDED');
    console.log(`Paid / Partially Refunded count: ${paidPayments.length}`);

    // Today in IST
    const now = new Date();
    // format to IST
    const istDateString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    console.log(`Current IST Date: ${istDateString}`);

    // Check dates of paid payments
    const todayPayments = [];
    const otherDayPayments = [];

    let totalGrossPaise = 0;
    let totalRefundedPaise = 0;
    let todayGrossPaise = 0;

    for (const p of paidPayments) {
      const pDate = p.paidAt || p.createdAt;
      const istPDate = pDate ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(pDate)) : 'unknown';
      const netPaid = (p.amount || 0) - (p.refundedAmount || 0);
      totalGrossPaise += (p.amount || 0);
      totalRefundedPaise += (p.refundedAmount || 0);

      if (istPDate === istDateString) {
        todayPayments.push({
          paymentId: p.paymentId,
          receiptNumber: p.receiptNumber,
          amountPaise: p.amount,
          amountRupees: p.amount / 100,
          netRupees: netPaid / 100,
          gateway: p.paymentGateway,
          method: p.paymentMethod,
          purpose: p.paymentPurpose,
          status: p.paymentStatus,
          dateUTC: pDate,
          istDate: istPDate,
          customer: p.customer,
          booking: p.booking
        });
        todayGrossPaise += p.amount;
      } else {
        otherDayPayments.push({
          paymentId: p.paymentId,
          amountRupees: p.amount / 100,
          istDate: istPDate,
          purpose: p.paymentPurpose
        });
      }
    }

    console.log(`\n--- TODAY'S PAID PAYMENTS (${todayPayments.length} records) ---`);
    console.log(`Today's Gross Total: ₹${todayGrossPaise / 100} (${todayGrossPaise} paise)`);
    console.table(todayPayments.map(p => ({
      paymentId: p.paymentId,
      receiptNumber: p.receiptNumber,
      amountRupees: p.amountRupees,
      netRupees: p.netRupees,
      method: p.method,
      gateway: p.gateway,
      purpose: p.purpose,
      status: p.status,
      dateUTC: p.dateUTC
    })));

    console.log('\n--- ALL REFUNDS ---');
    const refunds = await refundsColl.find({}).toArray();
    console.log(`Total refunds in DB: ${refunds.length}`);
    console.table(refunds.map(r => ({
      refundId: r.refundId,
      amountRupees: r.amount / 100,
      status: r.status,
      reason: r.reason,
      refundType: r.refundType,
      createdAt: r.createdAt
    })));

    // Check bookings revenue or pricing
    const allBookings = await bookingsColl.find({}).toArray();
    console.log(`\nTotal Bookings in DB: ${allBookings.length}`);
    const bookingStatusCounts = {};
    for (const b of allBookings) {
      bookingStatusCounts[b.bookingStatus] = (bookingStatusCounts[b.bookingStatus] || 0) + 1;
    }
    console.log('Booking status counts:', bookingStatusCounts);

    process.exit(0);
  } catch (err) {
    console.error('Audit DB error:', err);
    process.exit(1);
  }
})();
