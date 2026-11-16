import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import PushSubscription from '../models/PushSubscription.js';
import { createNotification } from '../services/notification.service.js';
import { getVapidPublicKey, sendPushToUser, configureVapid } from '../services/pushNotification.service.js';

// Ensure VAPID is configured with the loaded environment variables
configureVapid();

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

// Helper to generate cryptographically valid P-256 client keys
function generateValidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('🔔 NOAH GAMING: Complete Web Push Notification Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Connect to Database using connectDB
  await connectDB();

  // 2. Start test HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Test Server] Live on http://localhost:${TEST_PORT}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: VAPID Public Key Retrieval Endpoint
    // ----------------------------------------------------
    console.log('--- TEST 1: VAPID Public Key Retrieval ---');
    const vapidRes = await fetch(`${BASE_URL}/push/vapid-public-key`);
    const vapidJson = await vapidRes.json();
    assert(vapidRes.status === 200, 'GET /api/push/vapid-public-key returns HTTP 200');
    assert(vapidJson.success === true, 'Response contains success: true');
    assert(typeof vapidJson.data?.publicKey === 'string' && vapidJson.data.publicKey.length > 30, 'Valid base64url VAPID public key returned');
    console.log(`[VAPID Key] ${vapidJson.data?.publicKey.slice(0, 25)}...`);

    // ----------------------------------------------------
    // TEST 2: Security & Authentication Guard
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Security & Authentication Guard ---');
    const unauthSub = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: { endpoint: 'https://push.example.com/test', keys: generateValidKeys() } }),
    });
    assert(unauthSub.status === 401, 'POST /api/push/subscribe rejects unauthenticated requests (HTTP 401)');

    const unauthStatus = await fetch(`${BASE_URL}/push/status`);
    assert(unauthStatus.status === 401, 'GET /api/push/status rejects unauthenticated requests (HTTP 401)');

    const unauthTest = await fetch(`${BASE_URL}/push/test`, { method: 'POST' });
    assert(unauthTest.status === 401, 'POST /api/push/test rejects unauthenticated requests (HTTP 401)');

    // ----------------------------------------------------
    // TEST 3: User Authentication & Profile
    // ----------------------------------------------------
    console.log('\n--- TEST 3: User Authentication ---');
    let customerUser = await User.findOne({ role: 'customer' });
    if (!customerUser) {
      customerUser = await User.create({
        name: 'Nexus Verified Gamer',
        email: `push_tester_${Date.now()}@example.com`,
        phone: '9876543210',
        role: 'customer',
      });
    }
    const customerToken = customerUser.generateAuthToken();
    assert(!!customerToken, `Authenticated test customer: ${customerUser.name} (${customerUser.email})`);

    // ----------------------------------------------------
    // TEST 4: Initial Push Status Check
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Initial Push Status Check ---');
    await PushSubscription.deleteMany({ user: customerUser._id });

    const initStatusRes = await fetch(`${BASE_URL}/push/status`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const initStatus = await initStatusRes.json();
    assert(initStatus.success === true, 'GET /api/push/status returns HTTP 200');
    assert(initStatus.data.isSubscribed === false, 'Initially isSubscribed is false');
    assert(initStatus.data.totalDevices === 0, 'Initially totalDevices is 0');

    // ----------------------------------------------------
    // TEST 5: Register First Device (Desktop Chrome)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Register First Device (Desktop Chrome) ---');
    const desktopEndpoint = `https://fcm.googleapis.com/fcm/send/test-desktop-${Date.now()}`;
    const desktopSubData = {
      subscription: {
        endpoint: desktopEndpoint,
        keys: generateValidKeys(),
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    };

    const subRes1 = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(desktopSubData),
    });
    const subJson1 = await subRes1.json();
    assert(subRes1.status === 200, 'POST /api/push/subscribe registers desktop subscription');
    assert(subJson1.success === true, 'Desktop registration returns success: true');
    assert(subJson1.data.deviceType === 'desktop', 'Auto-detected deviceType: desktop');
    assert(subJson1.data.os === 'Windows', 'Auto-detected OS: Windows');

    // ----------------------------------------------------
    // TEST 6: Register Second Device (Android Mobile)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Multi-Device Support (Android Mobile) ---');
    const mobileEndpoint = `https://fcm.googleapis.com/fcm/send/test-android-${Date.now()}`;
    const mobileSubData = {
      subscription: {
        endpoint: mobileEndpoint,
        keys: generateValidKeys(),
      },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.102 Mobile Safari/537.36',
    };

    const subRes2 = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(mobileSubData),
    });
    const subJson2 = await subRes2.json();
    assert(subRes2.status === 200, 'POST /api/push/subscribe registers mobile subscription');
    assert(subJson2.data.deviceType === 'mobile', 'Auto-detected deviceType: mobile');
    assert(subJson2.data.os === 'Android', 'Auto-detected OS: Android');

    // Verify status now shows 2 devices
    const statusRes2 = await fetch(`${BASE_URL}/push/status?endpoint=${encodeURIComponent(desktopEndpoint)}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusJson2 = await statusRes2.json();
    assert(statusJson2.data.isSubscribed === true, 'User is now marked as subscribed');
    assert(statusJson2.data.totalDevices === 2, 'User has exactly 2 active devices (multi-device support)');
    assert(statusJson2.data.currentDeviceSubscribed === true, 'Correctly identifies current device via endpoint query');

    // ----------------------------------------------------
    // TEST 7: Deduplication & Upsert
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Subscription Deduplication & Upsert ---');
    const duplicateSubRes = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(desktopSubData),
    });
    assert(duplicateSubRes.status === 200, 'Re-subscribing existing device returns HTTP 200');

    const totalCount = await PushSubscription.countDocuments({ user: customerUser._id });
    assert(totalCount === 2, 'No duplicate records created in MongoDB (unique endpoint index works)');

    // ----------------------------------------------------
    // TEST 8: Unsubscribe Single Device
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Unsubscribe Single Device ---');
    const unsubSingleRes = await fetch(`${BASE_URL}/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ endpoint: mobileEndpoint }),
    });
    const unsubSingleJson = await unsubSingleRes.json();
    assert(unsubSingleRes.status === 200, 'POST /api/push/unsubscribe returns HTTP 200');
    assert(unsubSingleJson.data?.unsubscribed === true, 'Device successfully unsubscribed');

    const remainingStatusRes = await fetch(`${BASE_URL}/push/status`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const remainingStatus = await remainingStatusRes.json();
    assert(remainingStatus.data.totalDevices === 1, 'Exactly 1 device remains subscribed after single unsubscribe');

    // ----------------------------------------------------
    // TEST 9: Unsubscribe All Devices
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Unsubscribe All Devices ---');
    const unsubAllRes = await fetch(`${BASE_URL}/push/unsubscribe-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(unsubAllRes.status === 200, 'POST /api/push/unsubscribe-all returns HTTP 200');

    const finalStatusRes = await fetch(`${BASE_URL}/push/status`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const finalStatus = await finalStatusRes.json();
    assert(finalStatus.data.totalDevices === 0, 'All devices removed (totalDevices === 0)');
    assert(finalStatus.data.isSubscribed === false, 'isSubscribed reset to false');

    // ----------------------------------------------------
    // TEST 10: Invalid & Expired Subscription Pruning (404/410 Handling)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Expired & Invalid Subscription Auto-Pruning ---');
    const userForPruning = await User.create({
      name: 'Prune Tester',
      email: `prune_tester_${Date.now()}@example.com`,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      role: 'customer',
    });

    const expiredFcmEndpoint = `https://fcm.googleapis.com/fcm/send/dead-token-prune-test-${Date.now()}`;
    const expiredSubDoc = await PushSubscription.create({
      user: userForPruning._id,
      endpoint: expiredFcmEndpoint,
      keys: generateValidKeys(),
      deviceType: 'mobile',
      browser: 'Google Chrome',
      os: 'Android',
      isActive: true,
    });
    assert(!!expiredSubDoc, 'Created mock expired subscription in database');

    console.log('[WebPush] Sending push to user with expired device...');
    await sendPushToUser({
      userId: userForPruning._id,
      payload: { title: 'Test Cleanup', message: 'Testing 410 pruning' },
    });

    const prunedDoc = await PushSubscription.findOne({ endpoint: expiredFcmEndpoint });
    assert(prunedDoc === null, 'Expired subscription (HTTP 410 Gone from FCM) was automatically pruned from MongoDB');
    await User.deleteOne({ _id: userForPruning._id });

    // ----------------------------------------------------
    // TEST 11: In-App Notification + Web Push Integration
    // ----------------------------------------------------
    console.log('\n--- TEST 11: In-App + Web Push Unified Dispatch ---');
    // Register a subscription for customerUser to receive the event
    await PushSubscription.create({
      user: customerUser._id,
      endpoint: `https://fcm.googleapis.com/fcm/send/event-delivery-test-${Date.now()}`,
      keys: generateValidKeys(),
      deviceType: 'desktop',
      browser: 'Google Chrome',
      os: 'Windows',
      isActive: true,
    });

    const { notification: createdNotif } = await createNotification({
      recipient: customerUser._id,
      recipientRole: 'customer',
      title: 'Booking Confirmed: PS5 Station 1',
      message: 'Your gaming slot has been confirmed for 5:00 PM today.',
      category: 'BOOKING_CONFIRMED',
      deliveryChannels: ['IN_APP', 'PUSH'],
    });

    assert(!!createdNotif, 'createNotification() created Notification record');

    const inAppDelivery = await NotificationDelivery.findOne({
      notification: createdNotif._id,
      channel: 'IN_APP',
    });
    assert(!!inAppDelivery, 'NotificationDelivery record created for IN_APP');

    const pushDeliveries = await NotificationDelivery.find({
      notification: createdNotif._id,
      channel: 'PUSH',
    });
    assert(pushDeliveries.length > 0, `NotificationDelivery records logged for PUSH channel (${pushDeliveries.length} attempts)`);

    // Clean up subscriptions for customerUser
    await PushSubscription.deleteMany({ user: customerUser._id });

    // ----------------------------------------------------
    // TEST 12: Test Push When No Devices Subscribed
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Test Push Guard When Unsubscribed ---');
    const testFailRes = await fetch(`${BASE_URL}/push/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(testFailRes.status === 404, 'POST /api/push/test returns 404 when no active subscriptions exist');

    // Clean up test customer
    await Notification.deleteMany({ recipient: customerUser._id });
    await NotificationDelivery.deleteMany({ recipient: customerUser._id });

  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('\n====================================================');
    console.log(`📊 Test Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
