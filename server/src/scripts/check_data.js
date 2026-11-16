import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const bookings = await Booking.find({}).lean();
  console.log(`Total bookings in Atlas: ${bookings.length}`);
  for (const b of bookings) {
    console.log(`- Booking ${b.bookingId} | customer: ${b.customer} | amount: ${b.totalAmount} | paid: ${b.amountPaid} | isWalkIn: ${b.isWalkIn}`);
  }
  const payments = await Payment.find({}).lean();
  console.log(`Total payments in Atlas: ${payments.length}`);
  for (const p of payments) {
    console.log(`- Payment ${p.receiptNumber} | customer: ${p.customer} | amount: ${p.amountPaise} | status: ${p.paymentStatus}`);
  }
  await mongoose.disconnect();
}
main().catch(console.error);
