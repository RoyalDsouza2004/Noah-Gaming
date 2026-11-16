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
  const users = await User.find({});
  for (const u of users) {
    if (!u.accountType) {
      if (u.email && u.email.startsWith('guest.')) {
        u.accountType = 'GUEST';
        u.isGuest = true;
      } else {
        u.accountType = 'REGISTERED';
        u.isGuest = false;
      }
      await u.save();
      console.log(`Updated user ${u.name} (${u.email}) -> ${u.accountType}`);
    }
  }
  console.log('✓ User accountTypes initialized.');
  await mongoose.disconnect();
}
main().catch(console.error);
