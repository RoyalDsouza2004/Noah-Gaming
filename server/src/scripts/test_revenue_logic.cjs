const mongoose = require('../../../server/node_modules/mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    const db = mongoose.connection.db;

    // IST today: 2026-11-15
    const todayStartUTC = new Date('2026-11-15T00:00:00.000+05:30');
    const todayEndUTC = new Date('2026-11-15T23:59:59.999+05:30');

    console.log('IST Window:');
    console.log('  Start:', todayStartUTC.toISOString());
    console.log('  End:  ', todayEndUTC.toISOString());

    const paidMatch = {
      paymentStatus: { $in: ['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'] }
    };

    const allPayments = await db.collection('payments').find(paidMatch).toArray();
    console.log('\nTotal paid payments across all time:', allPayments.length);

    let allGross = 0;
    let allRefunded = 0;
    let todayGross = 0;
    let todayRefunded = 0;
    let todayCount = 0;

    const todayItems = [];

    for (const p of allPayments) {
      const pDate = p.paidAt ? new Date(p.paidAt) : new Date(p.createdAt);
      allGross += p.amount;
      allRefunded += (p.refundedAmount || 0);

      if (pDate >= todayStartUTC && pDate <= todayEndUTC) {
        todayGross += p.amount;
        todayRefunded += (p.refundedAmount || 0);
        todayCount++;
        todayItems.push({
          id: p.paymentId,
          receipt: p.receiptNumber,
          amountRupees: p.amount / 100,
          purpose: p.paymentPurpose,
          gateway: p.paymentGateway,
          method: p.paymentMethod,
          date: pDate.toISOString()
        });
      }
    }

    console.log('\n--- ALL TIME ---');
    console.log(`Gross: ₹${allGross / 100} | Refunded: ₹${allRefunded / 100} | Net: ₹${(allGross - allRefunded) / 100}`);

    console.log('\n--- TODAY (IST) ---');
    console.log(`Count: ${todayCount}`);
    console.log(`Gross: ₹${todayGross / 100} | Refunded: ₹${todayRefunded / 100} | Net: ₹${(todayGross - todayRefunded) / 100}`);

    // Print breakdown of today's payments by purpose
    const purposeSummary = {};
    for (const item of todayItems) {
      purposeSummary[item.purpose] = (purposeSummary[item.purpose] || { count: 0, sum: 0 });
      purposeSummary[item.purpose].count++;
      purposeSummary[item.purpose].sum += item.amountRupees;
    }
    console.log('\nToday by Purpose:');
    console.table(purposeSummary);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
