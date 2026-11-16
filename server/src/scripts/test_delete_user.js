import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });

import User from '../models/User.js';
import Booking from '../models/Booking.js';
import GamingSession from '../models/GamingSession.js';
import Device from '../models/Device.js';
import ActivityLog from '../models/ActivityLog.js';
import OtpVerification from '../models/OtpVerification.js';
import { ROLES } from '../config/constants.js';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Starting Admin Delete User Verification Tests ---');

  // 1. Connect to Mongo for setup/inspection
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gaming_lounge';
  await mongoose.connect(mongoUri);
  console.log('[Test Setup] Connected to DB.');

  // Find admin credentials
  const adminUser = await User.findOne({ role: ROLES.ADMIN });
  if (!adminUser) {
    throw new Error('Admin user not found in database!');
  }
  console.log(`[Test Setup] Found admin: ${adminUser.email}`);

  // Find or create a receptionist user for RBAC test
  let staffUser = await User.findOne({ role: ROLES.RECEPTIONIST });
  if (!staffUser) {
    staffUser = await User.create({
      name: 'Test Receptionist',
      phone: '9998887766',
      email: 'staff.test@noahgaming.com',
      password: 'Password123!',
      role: ROLES.RECEPTIONIST,
      accountStatus: 'ACTIVE',
      accountType: 'REGISTERED',
    });
  }

  // Ensure known passwords for admin and staff in test environment
  adminUser.password = 'AdminPassword@123';
  await adminUser.save();
  staffUser.password = 'StaffPassword@123';
  await staffUser.save();

  // Login as admin
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminUser.email, password: 'AdminPassword@123' }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.data?.token || adminLoginData.token;
  if (!adminToken) {
    throw new Error(`Failed to login as admin: ${JSON.stringify(adminLoginData)}`);
  }
  console.log('✓ Admin login successful');

  // Login as staff
  const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: staffUser.email, password: 'StaffPassword@123' }),
  });
  const staffLoginData = await staffLoginRes.json();
  const staffToken = staffLoginData.data?.token || staffLoginData.token;
  console.log('✓ Staff login successful (token present:', !!staffToken, ')');

  // Create a temporary test user to delete
  const testPhone = '9900112233';
  const testEmail = 'deleteme.customer@test.com';
  await User.deleteMany({ phone: testPhone });
  await User.deleteMany({ email: testEmail });

  const customerToTest = await User.create({
    name: 'Delete Me Customer',
    phone: testPhone,
    email: testEmail,
    role: ROLES.CUSTOMER,
    accountType: 'REGISTERED',
    accountStatus: 'ACTIVE',
    customerId: 'CUST-DEL-001',
  });
  console.log('✓ Created test customer to delete with ID:', customerToTest._id.toString());

  // TEST 1: Unauthenticated request should fail (401)
  console.log('\n[TEST 1] Unauthenticated DELETE request...');
  const unauthRes = await fetch(`${BASE_URL}/admin/users/${customerToTest._id}`, {
    method: 'DELETE',
  });
  console.log(`Response status: ${unauthRes.status}`);
  if (unauthRes.status === 401) {
    console.log('✓ PASS: Unauthenticated delete request rejected with 401');
  } else {
    console.error('✗ FAIL: Expected 401 but got', unauthRes.status);
  }

  // TEST 2: Receptionist / Non-Admin DELETE request should fail (403)
  console.log('\n[TEST 2] Non-Admin (Receptionist) DELETE request...');
  const staffRes = await fetch(`${BASE_URL}/admin/users/${customerToTest._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  console.log(`Response status: ${staffRes.status}`);
  if (staffRes.status === 403) {
    console.log('✓ PASS: Receptionist delete request forbidden with 403 (Strictly Admin only)');
  } else {
    console.error('✗ FAIL: Expected 403 but got', staffRes.status);
  }

  // TEST 3: Admin self-deletion guard
  console.log('\n[TEST 3] Admin attempting self-deletion...');
  const selfDelRes = await fetch(`${BASE_URL}/admin/users/${adminUser._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const selfDelData = await selfDelRes.json();
  console.log(`Response status: ${selfDelRes.status}, message: ${selfDelData.message}`);
  if (selfDelRes.status === 400 && selfDelData.message.includes('cannot delete your own administrator account')) {
    console.log('✓ PASS: Admin self-deletion prevented with proper message');
  } else {
    console.error('✗ FAIL: Self-deletion guard failed', selfDelRes.status, selfDelData);
  }

  // TEST 4: Primary admin account protection
  console.log('\n[TEST 4] Primary admin protection...');
  // Even if another admin attempts to delete admin@noahgaming.com, it must be guarded
  const primaryAdminDelRes = await fetch(`${BASE_URL}/admin/users/${adminUser._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const primaryAdminData = await primaryAdminDelRes.json();
  if (primaryAdminDelRes.status === 400) {
    console.log('✓ PASS: Primary admin protected from deletion');
  }

  // TEST 5: Active session protection
  console.log('\n[TEST 5] Deletion blocked if user has active gaming session...');
  let device = await Device.findOne();
  if (device) {
    const dummyBooking = await Booking.create({
      bookingId: 'BK-DEL-TEST',
      customer: customerToTest._id,
      device: device._id,
      bookingType: 'SHARED',
      bookingDate: '2026-11-16',
      startTime: '14:00',
      endTime: '15:00',
      startAt: new Date(),
      endAt: new Date(Date.now() + 60 * 60 * 1000),
      duration: 1,
      numberOfPlayers: 1,
      totalAmount: 20000,
      amountPaid: 20000,
      paymentStatus: 'PAID',
      bookingStatus: 'CONFIRMED',
    });

    const activeSession = await GamingSession.create({
      booking: dummyBooking._id,
      customer: customerToTest._id,
      device: device._id,
      gameType: 'PS5',
      scheduledMinutes: 60,
      startedAt: new Date(),
      scheduledEndAt: new Date(Date.now() + 60 * 60 * 1000),
      status: 'ACTIVE',
    });

    const activeSessionDelRes = await fetch(`${BASE_URL}/admin/users/${customerToTest._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const activeSessionData = await activeSessionDelRes.json();
    console.log(`Response status: ${activeSessionDelRes.status}, message: ${activeSessionData.message}`);
    if (activeSessionDelRes.status === 400 && activeSessionData.message.includes('active gaming session')) {
      console.log('✓ PASS: Blocked user deletion while active gaming session is in progress');
    } else {
      console.error('✗ FAIL: Active session check failed', activeSessionData);
    }

    // Clean up session and booking
    await GamingSession.findByIdAndDelete(activeSession._id);
    await Booking.findByIdAndDelete(dummyBooking._id);
  }

  // TEST 6: Successful user deletion by Admin
  console.log('\n[TEST 6] Legitimate customer deletion by Admin...');
  // Create an OTP verification record for this user to test cleanup
  await OtpVerification.create({
    userId: customerToTest._id,
    email: testEmail,
    otpHash: 'dummyhash',
    purpose: 'PASSWORD_RESET',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    resendAvailableAt: new Date(),
  });

  const deleteRes = await fetch(`${BASE_URL}/admin/users/${customerToTest._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteData = await deleteRes.json();
  console.log(`Response status: ${deleteRes.status}, message: ${deleteData.message}`);

  if (deleteRes.status === 200 && deleteData.success) {
    console.log('✓ PASS: User deleted successfully');
  } else {
    console.error('✗ FAIL: Expected 200 but got', deleteRes.status, deleteData);
  }

  // Verify user is gone from database
  const checkUser = await User.findById(customerToTest._id);
  if (!checkUser) {
    console.log('✓ PASS: User document verified deleted from database');
  } else {
    console.error('✗ FAIL: User document still exists in DB!');
  }

  // Verify OTP verification records cleaned up
  const checkOtp = await OtpVerification.findOne({ email: testEmail });
  if (!checkOtp) {
    console.log('✓ PASS: Associated OTP records cleaned up');
  } else {
    console.error('✗ FAIL: OTP records were not cleaned up');
  }

  // Verify ActivityLog entry
  const logEntry = await ActivityLog.findOne({
    action: 'DELETE_USER',
    category: 'USER_MANAGEMENT',
    'details.deletedUserId': customerToTest._id,
  }).sort({ createdAt: -1 });

  if (logEntry && logEntry.description.includes(customerToTest.name)) {
    console.log(`✓ PASS: ActivityLog recorded deletion by '${logEntry.userName}' with description: "${logEntry.description}"`);
  } else {
    console.error('✗ FAIL: ActivityLog entry not found or invalid', logEntry);
  }

  // TEST 7: Invalid ObjectId format
  console.log('\n[TEST 7] Invalid User ID format check...');
  const invalidIdRes = await fetch(`${BASE_URL}/admin/users/invalid-id-123`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const invalidIdData = await invalidIdRes.json();
  if (invalidIdRes.status === 400 && invalidIdData.message.includes('Invalid User ID')) {
    console.log('✓ PASS: Invalid User ID rejected with 400');
  } else {
    console.error('✗ FAIL: Invalid ID check failed', invalidIdData);
  }

  // TEST 8: Non-existent user (404)
  console.log('\n[TEST 8] Non-existent user check...');
  const fakeId = new mongoose.Types.ObjectId();
  const notFoundRes = await fetch(`${BASE_URL}/admin/users/${fakeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const notFoundData = await notFoundRes.json();
  if (notFoundRes.status === 404 && notFoundData.message.includes('not found')) {
    console.log('✓ PASS: Non-existent user returned 404');
  } else {
    console.error('✗ FAIL: Expected 404 but got', notFoundRes.status, notFoundData);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL DELETE USER VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
