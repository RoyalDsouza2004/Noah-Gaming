import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Notification from '../models/Notification.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import GamingSession from '../models/GamingSession.js';
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  cleanupExpiredReadNotifications,
} from '../services/notification.service.js';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE NOTIFICATION SYSTEM TESTS');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB Atlas\n');

  // Find or create test customer user
  let testUser = await User.findOne({ email: 'test_notification_user@noahgaming.test' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Test Notification User',
      email: 'test_notification_user@noahgaming.test',
      phone: '9999900001',
      password: 'TestPassword123!',
      role: 'customer',
      accountStatus: 'ACTIVE',
    });
  }

  const userId = testUser._id;

  // Cleanup any leftover test notifications for this test user
  await Notification.deleteMany({ recipient: userId });
  await NotificationDelivery.deleteMany({ recipient: userId });

  const now = Date.now();
  const ONE_HOUR = 3600 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  console.log('--- TEST 1: Newly Received Unread Notification ---');
  const { notification: newNotif } = await createNotification({
    recipient: userId,
    title: 'Test New Booking Confirmation',
    message: 'Your station reservation has been created.',
    category: 'BOOKING_CONFIRMED',
  });
  if (!newNotif || newNotif.isRead !== false || newNotif.readAt !== null) {
    throw new Error('Test 1 Failed: New notification should be unread with readAt null');
  }
  console.log('✓ PASS: Newly received notification is unread (readAt is null)\n');

  console.log('--- TEST 2: Old Unread Notification (>3 days old) Must NOT Be Deleted ---');
  const oldUnread = await Notification.create({
    recipient: userId,
    title: 'Test Old Unread Session Alert',
    message: 'This session alert was created 5 days ago but unread.',
    category: 'SESSION_WARNING',
    isRead: false,
    readAt: null,
    createdAt: new Date(now - 5 * ONE_DAY),
  });

  const cleanup1 = await cleanupExpiredReadNotifications(72);
  const checkOldUnread = await Notification.findById(oldUnread._id);
  if (!checkOldUnread) {
    throw new Error('Test 2 Failed: Unread notification older than 3 days was deleted!');
  }
  console.log('✓ PASS: Unread notification created 5 days ago was NOT deleted by 72-hour cleanup\n');

  console.log('--- TEST 3: Read Notification Less Than 72 Hours Old Must NOT Be Deleted ---');
  const recentRead = await Notification.create({
    recipient: userId,
    title: 'Test Recent Read Notification',
    message: 'Marked read 24 hours ago.',
    category: 'PAYMENT_CONFIRMED',
    isRead: true,
    readAt: new Date(now - 24 * ONE_HOUR), // 24 hours ago
    createdAt: new Date(now - 48 * ONE_HOUR),
  });

  const cleanup2 = await cleanupExpiredReadNotifications(72);
  const checkRecentRead = await Notification.findById(recentRead._id);
  if (!checkRecentRead) {
    throw new Error('Test 3 Failed: Read notification from 24h ago was prematurely deleted!');
  }
  console.log('✓ PASS: Notification read 24 hours ago remains available\n');

  console.log('--- TEST 4: Boundary Check - 71.9 Hours Read vs 72.1 Hours Read ---');
  const borderSafe = await Notification.create({
    recipient: userId,
    title: 'Test 71.9h Read Notification',
    message: 'Marked read 71.9 hours ago (should stay).',
    category: 'SESSION_STARTED',
    isRead: true,
    readAt: new Date(now - (71.9 * ONE_HOUR)),
  });

  const borderExpired = await Notification.create({
    recipient: userId,
    title: 'Test 72.1h Read Notification',
    message: 'Marked read 72.1 hours ago (should be deleted).',
    category: 'SESSION_STARTED',
    isRead: true,
    readAt: new Date(now - (72.1 * ONE_HOUR)),
  });

  const cleanup3 = await cleanupExpiredReadNotifications(72);
  const checkBorderSafe = await Notification.findById(borderSafe._id);
  const checkBorderExpired = await Notification.findById(borderExpired._id);

  if (!checkBorderSafe) {
    throw new Error('Test 4 Failed: Notification read 71.9h ago was prematurely deleted!');
  }
  if (checkBorderExpired) {
    throw new Error('Test 4 Failed: Notification read 72.1h ago was NOT deleted!');
  }
  console.log('✓ PASS: 71.9h read notification retained; 72.1h read notification deleted cleanly\n');

  console.log('--- TEST 5: Reopening / Re-reading Does NOT Reset readAt ---');
  const readTimestamp = new Date(now - 10 * ONE_HOUR);
  const existingReadNotif = await Notification.create({
    recipient: userId,
    title: 'Test Already Read Notification',
    message: 'Read 10 hours ago.',
    category: 'MEMBERSHIP_ACTIVATED',
    isRead: true,
    readAt: readTimestamp,
  });

  // Re-read via markAsRead
  const reReadResult = await markAsRead(existingReadNotif._id, testUser);
  if (reReadResult.readAt.getTime() !== readTimestamp.getTime()) {
    throw new Error(`Test 5 Failed: readAt was overwritten from ${readTimestamp.toISOString()} to ${reReadResult.readAt.toISOString()}`);
  }
  console.log(`✓ PASS: Original read timestamp strictly preserved (${readTimestamp.toISOString()})\n`);

  console.log('--- TEST 6: Idempotent Cleanup and Repeated Executions ---');
  const cleanupRunA = await cleanupExpiredReadNotifications(72);
  const cleanupRunB = await cleanupExpiredReadNotifications(72);
  if (cleanupRunA.error || cleanupRunB.error) {
    throw new Error('Test 6 Failed: Cleanup execution produced error');
  }
  console.log('✓ PASS: Repeated cleanup executions are safe and idempotent\n');

  console.log('--- TEST 7: WhatsApp Verified Notification Disabled ---');
  const disabledAttempt = await createNotification({
    recipient: userId,
    title: 'WhatsApp Verified',
    message: 'Phone number verified via WhatsApp.',
    category: 'WHATSAPP_VERIFIED',
  });
  if (disabledAttempt.notification !== null || !disabledAttempt.disabled) {
    throw new Error('Test 7 Failed: WhatsApp Verified notification was created instead of being suppressed');
  }

  // Also verify getUserNotifications excludes any WhatsApp Verified notifications
  const userNotifs = await getUserNotifications(testUser, { page: 1, limit: 50 });
  const hasWhatsAppVerified = userNotifs.notifications.some(
    (n) => n.title === 'WhatsApp Verified' || n.category === 'WHATSAPP_VERIFIED'
  );
  if (hasWhatsAppVerified) {
    throw new Error('Test 7 Failed: getUserNotifications returned a WhatsApp Verified notification');
  }
  console.log('✓ PASS: "WhatsApp Verified" notification generation and retrieval successfully disabled\n');

  console.log('--- TEST 8: Unread Count Accuracy ---');
  const unreadCount = await getUnreadCount(testUser);
  const actualUnreadInDb = await Notification.countDocuments({ recipient: userId, isRead: false });
  if (unreadCount !== actualUnreadInDb) {
    throw new Error(`Test 8 Failed: Unread count mismatch: API=${unreadCount}, DB=${actualUnreadInDb}`);
  }
  console.log(`✓ PASS: Unread count accurately reflects active unread documents (${unreadCount})\n`);

  console.log('--- TEST 9: Mark All As Read Preserves Existing readAt Timestamps ---');
  const freshUnread = await Notification.create({
    recipient: userId,
    title: 'Test Fresh Unread',
    message: 'Needs to be marked read in bulk.',
    category: 'SYSTEM',
    isRead: false,
    readAt: null,
  });

  await markAllAsRead(testUser);

  const updatedFresh = await Notification.findById(freshUnread._id);
  const updatedExisting = await Notification.findById(existingReadNotif._id);

  if (!updatedFresh.isRead || !updatedFresh.readAt) {
    throw new Error('Test 9 Failed: Fresh unread was not marked read');
  }
  if (updatedExisting.readAt.getTime() !== readTimestamp.getTime()) {
    throw new Error('Test 9 Failed: markAllAsRead reset existing readAt timestamp');
  }
  console.log('✓ PASS: markAllAsRead updated unread notification while preserving existing readAt\n');

  // Clean up test data
  await Notification.deleteMany({ recipient: userId });
  await NotificationDelivery.deleteMany({ recipient: userId });
  await User.deleteOne({ _id: userId });

  console.log('====================================================');
  console.log('🎉 ALL 9 TEST SUITES PASSED FLAWLESSLY!');
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('\n❌ TEST FAILURE:', err);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  process.exit(1);
});
