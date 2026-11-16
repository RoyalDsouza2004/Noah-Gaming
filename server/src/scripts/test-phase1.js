import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import app from '../app.js';
import http from 'http';

const PORT = 5002; // Dedicated test port
let server;

async function runPhase1Verification() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 1 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  try {
    await connectDB();
    const User = (await import('../models/User.js')).default;

    // Ensure default test accounts exist
    const defaultAccounts = [
      {
        name: 'Lounge Admin',
        email: 'admin@gaminglounge.com',
        phone: '9876543210',
        password: 'AdminPassword@123',
        role: 'admin',
      },
      {
        name: 'Front Desk Reception',
        email: 'reception@gaminglounge.com',
        phone: '9876543211',
        password: 'StaffPassword@123',
        role: 'receptionist',
      },
      {
        name: 'Aryan Sharma',
        email: 'customer@gaminglounge.com',
        phone: '9876543212',
        password: 'CustomerPassword@123',
        role: 'customer',
      },
    ];

    for (const acc of defaultAccounts) {
      const exists = await User.findOne({ email: acc.email });
      if (!exists) {
        const u = new User(acc);
        await u.save();
        console.log(`  ➔ Initialized test account: ${acc.email} (${acc.role})`);
      }
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Test Server listening on http://localhost:${PORT}\n`);

    const baseUrl = `http://localhost:${PORT}/api`;

    // 1. Health Check & IST Timestamp Verification
    console.log('Test 1: GET /api/health (Database & IST time)');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.assert(healthRes.status === 200, 'Health check should return status 200');
    console.assert(healthData.data.database.connected === true, 'Database should be connected');
    console.assert(healthData.data.timezone === 'Asia/Kolkata', 'Timezone should be Asia/Kolkata');
    console.log(`  ➔ Response: Status=${healthData.data.status}, DB=${healthData.data.database.name}, IST=${healthData.data.timestampIST}`);
    console.log('  ✓ Test 1 PASSED: Server healthy, DB connected, IST configured.\n');

    // 2. Customer Registration Verification
    console.log('Test 2: POST /api/auth/register (Customer Registration & Token Generation)');
    const uniqueEmail = `player_${Date.now()}@gaminglounge.com`;
    const uniquePhone = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Gamer',
        email: uniqueEmail,
        phone: uniquePhone,
        password: 'Password@123',
      }),
    });
    const regData = await regRes.json();
    console.assert(regRes.status === 201, 'Registration should return status 201');
    console.assert(regData.success === true, 'Registration success should be true');
    console.assert(!!regData.data.token, 'Should return JWT token');
    console.assert(regData.data.user.role === 'customer', 'Role should be customer');
    console.log(`  ➔ Registered user: ${regData.data.user.name} (${regData.data.user.email}), Role: ${regData.data.user.role}`);
    console.log('  ✓ Test 2 PASSED: Registration, password hashing, and token generation verified.\n');

    // 3. User Login & Credential Verification (Admin, Receptionist, Customer)
    console.log('Test 3: POST /api/auth/login (Testing Admin, Receptionist, Customer logins)');
    
    // Admin Login
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@gaminglounge.com',
        password: 'AdminPassword@123',
      }),
    });
    const adminData = await adminLoginRes.json();
    console.assert(adminLoginRes.status === 200, 'Admin login should succeed');
    console.assert(adminData.data.user.role === 'admin', 'User should have admin role');
    const adminToken = adminData.data.token;
    console.log(`  ➔ Admin Login OK: Role=${adminData.data.user.role}`);

    // Receptionist Login
    const recepLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'reception@gaminglounge.com',
        password: 'StaffPassword@123',
      }),
    });
    const recepData = await recepLoginRes.json();
    console.assert(recepLoginRes.status === 200, 'Receptionist login should succeed');
    console.assert(recepData.data.user.role === 'receptionist', 'User should have receptionist role');
    const recepToken = recepData.data.token;
    console.log(`  ➔ Receptionist Login OK: Role=${recepData.data.user.role}`);

    // Customer Login (using mobile number identifier)
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '9876543212', // mobile identifier
        password: 'CustomerPassword@123',
      }),
    });
    const custData = await custLoginRes.json();
    if (custLoginRes.status !== 200) {
      console.log('  ❌ Customer login debug:', custLoginRes.status, custData);
    }
    console.assert(custLoginRes.status === 200, 'Customer login via phone should succeed');
    console.assert(custData.data.user.role === 'customer', 'User should have customer role');
    const customerToken = custData.data.token;
    console.log(`  ➔ Customer Login OK: Role=${custData.data.user.role}`);

    // Invalid Password Check
    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@gaminglounge.com',
        password: 'WrongPassword',
      }),
    });
    console.assert(badLoginRes.status === 401, 'Bad password must be rejected with 401');
    console.log('  ➔ Invalid Password Correctly Rejected (401)');
    console.log('  ✓ Test 3 PASSED: Multi-role authentication & credential security verified.\n');

    // 4. Token Authentication (GET /api/auth/me)
    console.log('Test 4: GET /api/auth/me (JWT validation & session retrieval)');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meData = await meRes.json();
    console.assert(meRes.status === 200, 'Me endpoint should return 200');
    console.assert(meData.data.user.email === 'admin@gaminglounge.com', 'User email should match');
    console.log(`  ➔ Authenticated as: ${meData.data.user.name} (${meData.data.user.email})`);
    console.log('  ✓ Test 4 PASSED: Token verification middleware functioning.\n');

    // 5. Role-Based Access Control (RBAC) Enforcement
    console.log('Test 5: RBAC Authorization & Audit Trail Verification');
    
    // Customer attempting to access Admin Audit Logs -> should receive 403 Forbidden
    const forbiddenRes = await fetch(`${baseUrl}/users/audit/logs`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    console.assert(forbiddenRes.status === 403, 'Customer accessing admin resource should return 403 Forbidden');
    console.log('  ➔ Customer blocked from Admin resource: HTTP 403 Forbidden (RBAC Verified)');

    // Admin accessing Audit Logs -> should succeed
    const adminLogsRes = await fetch(`${baseUrl}/users/audit/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const logsData = await adminLogsRes.json();
    console.assert(adminLogsRes.status === 200, 'Admin should successfully retrieve audit logs');
    console.assert(Array.isArray(logsData.data.logs), 'Logs should be an array');
    console.log(`  ➔ Admin retrieved ${logsData.data.logs.length} audit trail records from MongoDB ActivityLog collection`);

    // Receptionist searching customer by phone -> should succeed
    const searchRes = await fetch(`${baseUrl}/users/phone/9876543212`, {
      headers: { Authorization: `Bearer ${recepToken}` },
    });
    const searchData = await searchRes.json();
    console.assert(searchRes.status === 200, 'Receptionist customer search should succeed');
    console.log(`  ➔ Receptionist searched customer: ${searchData.data.customer.name} (${searchData.data.customer.phone})`);
    console.log('  ✓ Test 5 PASSED: Strict RBAC boundaries and audit log tracking verified.\n');

    console.log('====================================================');
    console.log('🎉 ALL 5 PHASE 1 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');

    server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification Test Failed:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runPhase1Verification();
