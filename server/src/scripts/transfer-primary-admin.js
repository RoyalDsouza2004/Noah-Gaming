import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';

const NEW_PRIMARY_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL || 'royalofficial2004@gmail.com').trim().toLowerCase();

async function transferPrimaryAdmin() {
  console.log('=== STARTING NOAH GAMING PRIMARY ADMIN TRANSFER ===');
  console.log(`Target Primary Admin Email: ${NEW_PRIMARY_EMAIL}`);

  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // 1. Verify target account exists
    const targetUser = await User.findOne({ email: NEW_PRIMARY_EMAIL });
    if (!targetUser) {
      throw new Error(`Target account for email '${NEW_PRIMARY_EMAIL}' does not exist in the database!`);
    }
    console.log(`✓ Target account verified: ${targetUser.name} (${targetUser.email}), ID: ${targetUser._id}`);

    // 2. Identify existing admin accounts
    const existingAdmins = await User.find({ role: 'admin' });
    console.log(`✓ Found ${existingAdmins.length} administrator account(s) currently in the database:`);
    existingAdmins.forEach((a) => {
      console.log(`  - ${a.name} (${a.email}), ID: ${a._id}, isPrimary: ${Boolean(a.isPrimaryAdmin)}`);
    });

    // 3. Start database session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step A: Remove Primary Admin designation from all accounts
      await User.updateMany(
        {},
        { $set: { isPrimaryAdmin: false } },
        { session }
      );
      console.log('✓ Cleared all existing isPrimaryAdmin flags in database.');

      // Step B: Assign Primary Admin designation to the target user
      targetUser.isPrimaryAdmin = true;
      targetUser.role = 'admin';
      targetUser.isActive = true;
      targetUser.accountStatus = 'ACTIVE';
      targetUser.isEmailVerified = true;
      await targetUser.save({ session });
      console.log(`✓ Assigned Primary Admin designation to ${targetUser.name} (${targetUser.email}).`);

      // Step C: Ensure all other admins are standard admins (role: 'admin', isPrimaryAdmin: false)
      for (const admin of existingAdmins) {
        if (admin._id.toString() !== targetUser._id.toString()) {
          admin.isPrimaryAdmin = false;
          // Keep role as admin (demoted from primary designation to normal admin)
          admin.role = 'admin';
          await admin.save({ session });
          console.log(`✓ Demoted previous admin ${admin.name} (${admin.email}) to standard Admin role.`);
        }
      }

      // Step D: Consistency verification: count exactly ONE primary admin in database
      const primaryAdminCount = await User.countDocuments({ isPrimaryAdmin: true }, { session });
      if (primaryAdminCount !== 1) {
        throw new Error(`Consistency Check Failed! Found ${primaryAdminCount} primary admins, expected exactly 1.`);
      }

      const activePrimary = await User.findOne({ isPrimaryAdmin: true }, null, { session });
      if (!activePrimary || activePrimary.email.toLowerCase() !== NEW_PRIMARY_EMAIL) {
        throw new Error(`Consistency Check Failed! Verified primary admin is ${activePrimary?.email}, expected ${NEW_PRIMARY_EMAIL}.`);
      }
      console.log(`✓ Consistency check passed: Exactly 1 Primary Admin exists (${activePrimary.email}).`);

      // Step E: Create audit log entry
      await ActivityLog.create(
        [
          {
            userId: targetUser._id,
            userName: targetUser.name,
            userRole: 'admin',
            action: 'PRIMARY_ADMIN_OWNERSHIP_TRANSFERRED',
            category: 'USER_MANAGEMENT',
            customerId: targetUser._id,
            description: `Primary Admin ownership successfully transferred to '${targetUser.name}' (${targetUser.email}). All previous admin accounts demoted to standard admin role.`,
            details: {
              newPrimaryAdmin: {
                id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                phone: targetUser.phone,
              },
              demotedAdmins: existingAdmins
                .filter((a) => a._id.toString() !== targetUser._id.toString())
                .map((a) => ({
                  id: a._id,
                  name: a.name,
                  email: a.email,
                  phone: a.phone,
                  role: a.role,
                })),
            },
            ipAddress: '127.0.0.1',
            status: 'SUCCESS',
          },
        ],
        { session }
      );
      console.log('✓ Audit log created for ownership transfer.');

      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      console.log('✓ Database transaction committed successfully!');
    } catch (txnError) {
      await session.abortTransaction();
      session.endSession();
      throw txnError;
    }

    // 4. Ensure partial unique index exists on MongoDB collection
    try {
      await db.collection('users').createIndex(
        { isPrimaryAdmin: 1 },
        { unique: true, partialFilterExpression: { isPrimaryAdmin: true } }
      );
      console.log('✓ Enforced database-level partial unique index on isPrimaryAdmin: true.');
    } catch (indexError) {
      console.warn('Note on index creation:', indexError.message);
    }

    // 5. Final state summary
    console.log('\n=== FINAL DATABASE ADMIN STATE ===');
    const finalAdmins = await User.find({ role: 'admin' }).select('name email phone role isPrimaryAdmin isActive accountStatus');
    finalAdmins.forEach((a) => {
      console.log({
        id: a._id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        role: a.role,
        isPrimaryAdmin: a.isPrimaryAdmin,
        isActive: a.isActive,
        accountStatus: a.accountStatus,
      });
    });

    console.log('\n✓ Ownership transfer complete.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Primary admin transfer error:', err);
    process.exit(1);
  }
}

transferPrimaryAdmin();
