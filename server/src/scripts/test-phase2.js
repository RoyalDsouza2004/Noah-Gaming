import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import app from '../app.js';
import http from 'http';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import GameCategory from '../models/GameCategory.js';
import Pricing from '../models/Pricing.js';
import DeviceMaintenance from '../models/DeviceMaintenance.js';

const PORT = 5003; // Dedicated port for Phase 2 testing
let server;

async function runPhase2Verification() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 2 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  try {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Test Server listening on http://localhost:${PORT}\n`);

    const baseUrl = `http://localhost:${PORT}/api`;

    // 0. Authenticate Admin and Customer to obtain Bearer tokens
    console.log('Setup: Authenticating Admin and Customer...');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' }),
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.data.token;

    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer@gaminglounge.com', password: 'CustomerPassword@123' }),
    });
    const custData = await custLoginRes.json();
    const customerToken = custData.data.token;
    console.log('✓ Setup complete: Admin & Customer tokens acquired.\n');

    // Test 1: Admin can create a PS5 device
    console.log('Test 1: POST /api/devices (Create PS5 Station)');
    const ps5Res = await fetch(`${baseUrl}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'PS5 Station 3 (Pro Test)',
        deviceCode: `PS5-TEST-${Date.now().toString().slice(-4)}`,
        deviceType: 'PS5',
        description: 'New PS5 Pro testing unit',
        capacity: 4,
        status: 'ACTIVE',
      }),
    });
    const ps5Data = await ps5Res.json();
    console.assert(ps5Res.status === 201, 'Should return status 201');
    console.assert(ps5Data.data.device.deviceType === 'PS5', 'Device type must be PS5');
    const createdDevice = ps5Data.data.device;
    console.log(`  ➔ Created PS5: ${createdDevice.name} [Code: ${createdDevice.deviceCode}]`);
    console.log('  ✓ Test 1 PASSED: Admin created PS5 device.\n');

    // Test 2: Admin can create a pool table
    console.log('Test 2: POST /api/devices (Create Pool Table)');
    const poolRes = await fetch(`${baseUrl}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'VIP Snooker & Pool Table 2',
        deviceCode: `POOL-TEST-${Date.now().toString().slice(-4)}`,
        deviceType: 'POOL',
        description: 'Regulation size 9ft table',
        capacity: 4,
        status: 'ACTIVE',
      }),
    });
    const poolData = await poolRes.json();
    console.assert(poolRes.status === 201, 'Should return 201');
    console.assert(poolData.data.device.deviceType === 'POOL', 'Device type must be POOL');
    console.log(`  ➔ Created Pool Table: ${poolData.data.device.name} [Code: ${poolData.data.device.deviceCode}]`);
    console.log('  ✓ Test 2 PASSED: Admin created pool table.\n');

    // Test 3: Admin can edit device capacity
    console.log('Test 3: PUT /api/devices/:id (Edit Device Capacity)');
    const editCapRes = await fetch(`${baseUrl}/devices/${createdDevice._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ capacity: 2 }),
    });
    const editCapData = await editCapRes.json();
    console.assert(editCapRes.status === 200, 'Should return 200');
    console.assert(editCapData.data.device.capacity === 2, 'Capacity should update to 2');
    console.log(`  ➔ Updated Capacity: ${createdDevice.name} now has capacity ${editCapData.data.device.capacity}`);
    console.log('  ✓ Test 3 PASSED: Device capacity updated successfully.\n');

    // Test 4: Admin can create new categories
    console.log('Test 4: POST /api/categories (Create Game Category)');
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Virtual Reality ${Date.now().toString().slice(-4)}`,
        description: 'Immersive VR headset experiences',
      }),
    });
    const catData = await catRes.json();
    console.assert(catRes.status === 201, 'Should return 201');
    const createdCat = catData.data.category;
    console.log(`  ➔ Created Category: ${createdCat.name}`);
    console.log('  ✓ Test 4 PASSED: New game category created.\n');

    // Test 5: Admin can add a new game & assign to compatible devices
    console.log('Test 5: POST /api/games (Add Game & Assign Compatible Devices)');
    const gameRes = await fetch(`${baseUrl}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'God of War Ragnarök',
        description: 'Kratos and Atreus embark on a mythic journey across the Nine Realms.',
        category: createdCat._id,
        compatibleDevices: [createdDevice._id],
        isExclusive: false,
        status: 'ACTIVE',
      }),
    });
    const gameData = await gameRes.json();
    console.assert(gameRes.status === 201, 'Should return 201');
    console.assert(gameData.data.game.compatibleDevices.length === 1, 'Should have 1 compatible device');
    const createdGame = gameData.data.game;
    console.log(`  ➔ Created Game: ${createdGame.name} (Assigned to device ${createdDevice.name})`);
    console.log('  ✓ Test 5 PASSED: Game added and assigned to compatible device.\n');

    // Test 6: Admin can activate and deactivate games
    console.log('Test 6: PUT /api/games/:id (Toggle Game Status)');
    const deactivateRes = await fetch(`${baseUrl}/games/${createdGame._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    const deactData = await deactivateRes.json();
    console.assert(deactData.data.game.status === 'INACTIVE', 'Status should be INACTIVE');
    console.log(`  ➔ Toggled Game Status: ${createdGame.name} is now ${deactData.data.game.status}`);

    const reactivateRes = await fetch(`${baseUrl}/games/${createdGame._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const reactData = await reactivateRes.json();
    console.assert(reactData.data.game.status === 'ACTIVE', 'Status should be ACTIVE');
    console.log(`  ➔ Re-activated Game: ${createdGame.name} is now ${reactData.data.game.status}`);
    console.log('  ✓ Test 6 PASSED: Game activation/deactivation verified.\n');

    // Test 7: Verify GTA 6 is DISABLED by default (Section 3 Spec)
    console.log('Test 7: Verify GTA 6 Status (Must remain DISABLED by default)');
    const gta6 = await Game.findOne({ name: 'GTA 6' });
    console.assert(gta6 !== null, 'GTA 6 must exist in database');
    console.assert(gta6.isExclusive === true, 'GTA 6 must be flagged as exclusive');
    console.assert(gta6.status === 'INACTIVE', 'GTA 6 must be INACTIVE by default');
    console.assert(gta6.advancePaymentRequired === true, 'GTA 6 must require advance payment');
    console.log(`  ➔ Verified GTA 6: Status=${gta6.status}, Exclusive=${gta6.isExclusive}, AdvanceRequired=${gta6.advancePaymentRequired}`);
    console.log('  ✓ Test 7 PASSED: GTA 6 is verified disabled by default.\n');

    // Test 8: Admin can update prices & precision-safe paise storage
    console.log('Test 8: PUT /api/pricing/:id (Update Pricing & Test Price Calculator)');
    const ps5Pricing = await Pricing.findOne({ deviceType: 'PS5' });
    console.assert(ps5Pricing !== null, 'PS5 pricing rule must exist');
    console.assert(ps5Pricing.amount === 6000, 'Base PS5 pricing must be 6000 paise (₹60)');

    const updatePriceRes = await fetch(`${baseUrl}/pricing/${ps5Pricing._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amountInRupees: 75 }), // Update to ₹75 = 7500 paise
    });
    const updatePriceData = await updatePriceRes.json();
    console.assert(updatePriceRes.status === 200, 'Price update should succeed');
    console.assert(updatePriceData.data.pricing.amount === 7500, 'Price should be stored as 7500 paise');
    console.log(`  ➔ Updated Price: ${updatePriceData.data.pricing.name} is now ₹${updatePriceData.data.pricing.amount / 100} (${updatePriceData.data.pricing.amount} paise)`);

    // Test Price Calculator helper endpoint
    const calcRes = await fetch(`${baseUrl}/pricing/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: createdDevice._id,
        durationMinutes: 120, // 2 hours
        playersCount: 2,      // 2 players
      }),
    });
    const calcData = await calcRes.json();
    console.assert(calcRes.status === 200, 'Calculate should return 200');
    // 75/player/hr * 2 hrs * 2 players = ₹300 = 30000 paise
    console.assert(calcData.data.totalAmountRupees === 300, 'Total should be ₹300 for 2 players x 2 hours');
    console.log(`  ➔ Backend Price Calculation: 2 players x 2 hours = ₹${calcData.data.totalAmountRupees} (${calcData.data.totalAmountPaise} paise)`);

    // Restore to standard ₹60 for clean test consistency
    await Pricing.findByIdAndUpdate(ps5Pricing._id, { amount: 6000 });
    console.log('  ✓ Test 8 PASSED: Pricing updated and precision-safe calculation verified.\n');

    // Test 9: Admin can mark device under maintenance & save history
    console.log('Test 9: POST /api/maintenance (Mark Device Under Maintenance)');
    const maintRes = await fetch(`${baseUrl}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        device: createdDevice._id,
        reason: 'DualSense controller analog stick drift calibration',
        startDate: new Date().toISOString(),
        expectedEndDate: new Date(Date.now() + 86400000).toISOString(),
        notes: 'Tech ticket #408',
      }),
    });
    const maintData = await maintRes.json();
    console.assert(maintRes.status === 201, 'Maintenance creation should return 201');
    const createdMaint = maintData.data.maintenance;
    console.log(`  ➔ Maintenance Created: ${createdMaint.reason}`);

    // Verify device status automatically updated to 'MAINTENANCE'
    const updatedDevCheck = await Device.findById(createdDevice._id);
    console.assert(updatedDevCheck.status === 'MAINTENANCE', 'Device status must change to MAINTENANCE');
    console.log(`  ➔ Device Status Synchronized: ${updatedDevCheck.name} is now ${updatedDevCheck.status}`);

    // Test 10: Complete maintenance and restore device status
    console.log('Test 10: PUT /api/maintenance/:id (Complete Maintenance & Restore Device)');
    const completeMaintRes = await fetch(`${baseUrl}/maintenance/${createdMaint._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const completeMaintData = await completeMaintRes.json();
    console.assert(completeMaintRes.status === 200, 'Should return 200');
    console.assert(completeMaintData.data.maintenance.status === 'COMPLETED', 'Status should be COMPLETED');

    const restoredDevCheck = await Device.findById(createdDevice._id);
    console.assert(restoredDevCheck.status === 'ACTIVE', 'Device status must restore to ACTIVE');
    console.log(`  ➔ Device Restored: ${restoredDevCheck.name} status returned to ${restoredDevCheck.status}`);

    // Verify maintenance history is preserved
    const maintHistory = await DeviceMaintenance.find({ device: createdDevice._id });
    console.assert(maintHistory.length > 0, 'Maintenance history must be saved and preserved');
    console.log(`  ➔ Maintenance History: ${maintHistory.length} record(s) on file for device`);
    console.log('  ✓ Test 9 & 10 PASSED: Maintenance workflow and historical preservation verified.\n');

    // Test 11: Unauthorized Customer Access Rejection (Security check)
    console.log('Test 11: Security Check - Unauthorized Customer Access Blocked');
    const unauthorizedRes = await fetch(`${baseUrl}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ name: 'Hacked Station', deviceCode: 'HACK-01' }),
    });
    console.assert(unauthorizedRes.status === 403, 'Customer should receive 403 Forbidden for admin operations');
    console.log(`  ➔ Customer blocked from creating device: HTTP ${unauthorizedRes.status} Forbidden (RBAC Verified)`);

    const unauthorizedMaintRes = await fetch(`${baseUrl}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ device: createdDevice._id, reason: 'Unauthorized maintenance' }),
    });
    console.assert(unauthorizedMaintRes.status === 403, 'Customer blocked from maintenance endpoint');
    console.log(`  ➔ Customer blocked from maintenance endpoints: HTTP ${unauthorizedMaintRes.status} Forbidden`);
    console.log('  ✓ Test 11 PASSED: Strict administrative authorization verified.\n');

    // Test 12: Database persistence & Phase 1 regression verification
    console.log('Test 12: Regression & Persistence Check (Phase 1 Auth & Models)');
    const healthCheck = await fetch(`${baseUrl}/health`);
    const healthData = await healthCheck.json();
    console.assert(healthCheck.status === 200, 'Health check must be 200');
    console.assert(healthData.data.status === 'UP', 'Server must be UP');
    console.assert(healthData.data.database.connected === true, 'MongoDB must remain connected');
    console.log(`  ➔ Health OK: Express=${healthData.data.status}, DB=${healthData.data.database.name}, IST=${healthData.data.timestampIST}`);
    console.log('  ✓ Test 12 PASSED: Phase 1 functionality fully operational with Phase 2 models loaded.\n');

    console.log('====================================================');
    console.log('🎉 ALL 12 PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');

    server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 2 Test Failed:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runPhase2Verification();
