import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import mongoose from 'mongoose';
import User from '../models/User.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).lean();
  console.log(`Total users in Atlas: ${users.length}`);
  for (const u of users) {
    console.log(`- ${u.name} | ${u.email} | ${u.phone} | ${u.role} | ${u.accountType || 'N/A'} | ${u.customerId || 'No CUST-ID'} | ${u._id}`);
  }
  await mongoose.disconnect();
}
main().catch(console.error);
