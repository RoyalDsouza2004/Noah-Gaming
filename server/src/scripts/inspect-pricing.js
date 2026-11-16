import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import Pricing from '../models/Pricing.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function inspect() {
  try {
    await connectDB();
    const pricings = await Pricing.find().lean();
    console.log('Current Pricing Records in DB:');
    pricings.forEach(p => {
      console.log(`- ID: ${p._id}, Name: "${p.name}", DeviceType: ${p.deviceType}, BillingType: ${p.billingType}, Amount: ${p.amount} paise (₹${p.amount / 100}), Status: ${p.status}, Game: ${p.game}, Device: ${p.device}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
}

inspect();
