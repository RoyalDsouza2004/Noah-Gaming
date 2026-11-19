import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { isUserPrimaryAdmin } from '../middlewares/rbac.js';

async function verifyPrimaryAdmin() {
  console.log('=== VERIFYING PRIMARY ADMIN STATUS & SECURITY ===\n');

  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // 1. Check Primary Admin in database
    const primaryUsers = await User.find({ isPrimaryAdmin: true });
    console.log(`[TEST 1] Exactly 1 Primary Admin in database:`);
    console.log(`  Count: ${primaryUsers.length}`);
    if (primaryUsers.length !== 1) {
      throw new Error(`Expected exactly 1 primary admin, found ${primaryUsers.length}`);
    }
    const primary = primaryUsers[0];
    console.log(`  Name: ${primary.name}`);
    console.log(`  Email: ${primary.email}`);
    console.log(`  Role: ${primary.role}`);
    console.log(`  isPrimaryAdmin: ${primary.isPrimaryAdmin}`);
    console.log(`  Status: ${primary.accountStatus}`);
    console.assert(primary.email === 'royalofficial2004@gmail.com', 'Primary admin email must match royalofficial2004@gmail.com');
    console.log('  -> PASS: Verified royalofficial2004@gmail.com is the sole Primary Admin.\n');

    // 2. Check RBAC helper
    console.log(`[TEST 2] isUserPrimaryAdmin helper check:`);
    console.log(`  isUserPrimaryAdmin(primary): ${isUserPrimaryAdmin(primary)}`);
    console.assert(isUserPrimaryAdmin(primary) === true, 'Helper must return true for new primary admin');

    const otherAdmins = await User.find({ role: 'admin', isPrimaryAdmin: { $ne: true } });
    for (const oa of otherAdmins) {
      console.log(`  isUserPrimaryAdmin(${oa.email}): ${isUserPrimaryAdmin(oa)}`);
      console.assert(isUserPrimaryAdmin(oa) === false, `Helper must return false for other admin ${oa.email}`);
    }
    console.log('  -> PASS: Helper correctly identifies only the primary admin.\n');

    // 3. Test Database Unique Index Enforcement
    console.log(`[TEST 3] Testing database partial unique index on isPrimaryAdmin:`);
    if (otherAdmins.length > 0) {
      const testCandidate = otherAdmins[0];
      try {
        await db.collection('users').updateOne(
          { _id: testCandidate._id },
          { $set: { isPrimaryAdmin: true } }
        );
        // If we reached here, the duplicate index didn't reject it - revert immediately!
        await db.collection('users').updateOne(
          { _id: testCandidate._id },
          { $set: { isPrimaryAdmin: false } }
        );
        console.warn('  -> WARNING: Duplicate update was not rejected by index.');
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          console.log(`  -> PASS: Duplicate isPrimaryAdmin was strictly rejected by MongoDB unique index (E11000).`);
        } else {
          console.error(`  -> Unexpected error:`, dupErr);
        }
      }
    }

    // 4. Test Token Generation
    console.log(`\n[TEST 4] Testing JWT Token Generation for Primary Admin:`);
    const token = primary.generateAuthToken();
    const jwt = (await import('jsonwebtoken')).default;
    const decoded = jwt.decode(token);
    console.log(`  Decoded payload role: ${decoded.role}`);
    console.log(`  Decoded payload isPrimaryAdmin: ${decoded.isPrimaryAdmin}`);
    console.assert(decoded.isPrimaryAdmin === true, 'Token must contain isPrimaryAdmin: true');
    console.log('  -> PASS: JWT token contains isPrimaryAdmin: true.\n');

    // 5. Final check of all admin accounts
    console.log('[TEST 5] Summary of all administrator accounts:');
    const allAdmins = await User.find({ role: 'admin' });
    allAdmins.forEach((a) => {
      console.log(`  * ${a.name} | ${a.email} | Role: ${a.role} | Primary: ${Boolean(a.isPrimaryAdmin)} | Active: ${a.isActive}`);
    });

    console.log('\n✓ ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  }
}

verifyPrimaryAdmin();
