import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import User from '../models/User.js';

let isVapidConfigured = false;

/**
 * Configure web-push VAPID details dynamically
 */
export function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@noahgaming.in';

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      isVapidConfigured = true;
      console.log('[WebPush] VAPID details configured successfully.');
    } catch (err) {
      console.error('[WebPush] Failed to set VAPID details:', err.message);
      isVapidConfigured = false;
    }
  } else {
    console.warn('[WebPush] VAPID keys not configured in environment variables. Web push notifications disabled.');
    isVapidConfigured = false;
  }
  return isVapidConfigured;
}

// Initial configuration attempt on module import
configureVapid();

/**
 * Retrieve VAPID Public Key for client subscription
 */
export function getVapidPublicKey() {
  // Try configuring if not yet configured
  if (!isVapidConfigured) {
    configureVapid();
  }
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Detect client device type and browser info from user-agent string
 */
export function parseUserAgent(uaString = '') {
  const ua = uaString.toLowerCase();
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod/.test(ua)) {
    deviceType = 'mobile';
  } else if (/ipad|tablet/.test(ua)) {
    deviceType = 'tablet';
  }

  let browser = 'Unknown Browser';
  if (/edg\//.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome\//.test(ua)) browser = 'Google Chrome';
  else if (/safari\//.test(ua) && !/chrome\//.test(ua)) browser = 'Apple Safari';
  else if (/firefox\//.test(ua)) browser = 'Mozilla Firefox';
  else if (/opera|opr\//.test(ua)) browser = 'Opera';

  let os = 'Unknown OS';
  if (/windows nt/.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/.test(ua)) os = 'macOS';
  else if (/android/.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS';
  else if (/linux/.test(ua)) os = 'Linux';

  return { deviceType, browser, os };
}

/**
 * Register or update a browser push subscription for a user
 */
export async function saveSubscription({ user, subscription, userAgent }) {
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    const err = new Error('Invalid push subscription format: endpoint and encryption keys are required.');
    err.status = 400;
    throw err;
  }

  const { deviceType, browser, os } = parseUserAgent(userAgent);

  const updatedSubscription = await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      user: user._id,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: userAgent || '',
      deviceType,
      browser,
      os,
      isActive: true,
      failedAttempts: 0,
      lastError: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return updatedSubscription;
}

/**
 * Unsubscribe a single device subscription by endpoint
 */
export async function unsubscribeDevice({ user, endpoint }) {
  if (!endpoint) {
    const err = new Error('Endpoint is required to unsubscribe.');
    err.status = 400;
    throw err;
  }

  const query = { endpoint };
  // Non-admins can only unsubscribe their own devices
  if (user && user.role !== 'admin') {
    query.user = user._id;
  }

  const result = await PushSubscription.findOneAndDelete(query);
  return { unsubscribed: !!result };
}

/**
 * Unsubscribe all devices for a user
 */
export async function unsubscribeAllDevices({ user }) {
  if (!user || !user._id) {
    const err = new Error('User is required to unsubscribe all devices.');
    err.status = 400;
    throw err;
  }

  const result = await PushSubscription.deleteMany({ user: user._id });
  return { deletedCount: result.deletedCount };
}

/**
 * Get active subscription status and device count for a user
 */
export async function getSubscriptionStatus({ user, currentEndpoint }) {
  if (!user) return { isSubscribed: false, totalDevices: 0, currentDeviceSubscribed: false };

  const [subscriptions, count] = await Promise.all([
    PushSubscription.find({ user: user._id, isActive: true })
      .select('endpoint deviceType browser os updatedAt')
      .lean(),
    PushSubscription.countDocuments({ user: user._id, isActive: true }),
  ]);

  const currentDeviceSubscribed = currentEndpoint
    ? subscriptions.some((s) => s.endpoint === currentEndpoint)
    : false;

  return {
    isSubscribed: count > 0,
    totalDevices: count,
    currentDeviceSubscribed,
    devices: subscriptions.map((s) => ({
      id: s._id,
      deviceType: s.deviceType,
      browser: s.browser,
      os: s.os,
      updatedAt: s.updatedAt,
      isCurrent: currentEndpoint ? s.endpoint === currentEndpoint : false,
    })),
  };
}

/**
 * Deliver a Web Push notification to a specific subscription record
 */
async function sendToSubscription(sub, pushPayloadStr, notification = null) {
  if (!isVapidConfigured) {
    configureVapid();
    if (!isVapidConfigured) {
      return { success: false, reason: 'VAPID_NOT_CONFIGURED' };
    }
  }

  const pushSubscriptionData = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  };

  try {
    const pushResult = await webpush.sendNotification(pushSubscriptionData, pushPayloadStr, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: 'high',
    });

    // Update subscription health
    await PushSubscription.updateOne(
      { _id: sub._id },
      {
        $set: {
          lastSuccessAt: new Date(),
          failedAttempts: 0,
          lastError: null,
        },
      }
    );

    // Record delivery in audit log if notification exists
    if (notification) {
      await NotificationDelivery.create({
        notification: notification._id,
        recipient: sub.user,
        channel: 'PUSH',
        deliveryStatus: 'DELIVERED',
        providerReference: `WEBPUSH-${sub._id}-${pushResult.statusCode || 201}`,
        metadata: {
          endpoint: sub.endpoint.slice(0, 40) + '...',
          deviceType: sub.deviceType,
          statusCode: pushResult.statusCode || 201,
        },
      });
    }

    return { success: true, statusCode: pushResult.statusCode };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.warn(`[WebPush] Push dispatch failed (status ${statusCode}):`, err.message);

    // If subscription is expired or unregistered by user (404 Not Found or 410 Gone), automatically prune it
    if (statusCode === 404 || statusCode === 410) {
      console.log(`[WebPush] Pruning expired/invalid subscription: ${sub._id} (${statusCode})`);
      await PushSubscription.deleteOne({ _id: sub._id });
    } else {
      // Increment failure count
      await PushSubscription.updateOne(
        { _id: sub._id },
        {
          $inc: { failedAttempts: 1 },
          $set: {
            lastFailureAt: new Date(),
            lastError: err.message,
          },
        }
      );
    }

    if (notification) {
      await NotificationDelivery.create({
        notification: notification._id,
        recipient: sub.user,
        channel: 'PUSH',
        deliveryStatus: 'FAILED',
        providerReference: `WEBPUSH-${sub._id}-${statusCode}`,
        errorMessage: err.message,
        metadata: {
          statusCode,
          endpoint: sub.endpoint.slice(0, 40) + '...',
        },
      });
    }

    return { success: false, statusCode, error: err.message };
  }
}

/**
 * Dispatch push notifications to all active subscriptions of a user
 */
export async function sendPushToUser({ userId, notification = null, payload = {} }) {
  if (!userId) return { count: 0, results: [] };

  const subscriptions = await PushSubscription.find({ user: userId, isActive: true });
  if (!subscriptions || subscriptions.length === 0) {
    return { count: 0, results: [] };
  }

  const notificationPayload = {
    title: payload.title || 'NOAH GAMING',
    body: payload.message || payload.body || 'You have a new alert from NOAH GAMING.',
    icon: payload.icon || '/icons/Noah_gaming_logo.svg',
    badge: payload.badge || '/icons/icon-192.svg',
    tag: payload.tag || `noah-${notification?._id || Date.now()}`,
    data: {
      notificationId: notification?._id ? String(notification._id) : null,
      category: notification?.category || payload.category || 'SYSTEM',
      url: payload.url || '/#profile',
      timestamp: Date.now(),
      ...(payload.data || {}),
    },
    timestamp: Date.now(),
    vibrate: [200, 100, 200],
  };

  const payloadString = JSON.stringify(notificationPayload);
  const results = await Promise.all(
    subscriptions.map((sub) => sendToSubscription(sub, payloadString, notification))
  );

  return { count: subscriptions.length, results };
}

/**
 * Dispatch push notifications to all active users with specified roles (e.g. receptionist, admin)
 */
export async function sendPushToRoles({ roles, notification = null, payload = {} }) {
  if (!roles || roles.length === 0) return { count: 0 };

  const targetUsers = await User.find({ role: { $in: roles }, isActive: true }).select('_id');
  if (!targetUsers.length) return { count: 0 };

  const results = await Promise.all(
    targetUsers.map((u) => sendPushToUser({ userId: u._id, notification, payload }))
  );

  return { userCount: targetUsers.length, results };
}

/**
 * Send an immediate test push notification to a user's active devices
 */
export async function sendTestPush({ user, endpoint = null }) {
  if (!user) {
    const err = new Error('Authentication required for test push.');
    err.status = 401;
    throw err;
  }

  let query = { user: user._id, isActive: true };
  if (endpoint) {
    query.endpoint = endpoint;
  }

  const subscriptions = await PushSubscription.find(query);
  if (!subscriptions || subscriptions.length === 0) {
    const err = new Error(
      'No active push subscription found for this device or account. Please click "Enable Notifications" first.'
    );
    err.status = 404;
    throw err;
  }

  const testPayload = {
    title: 'NOAH GAMING: Notifications Active! 🎮',
    body: 'Push notifications are live on this device! You will receive real-time alerts for bookings, game sessions, and membership updates.',
    icon: '/icons/Noah_gaming_logo.svg',
    badge: '/icons/icon-192.svg',
    tag: `test-push-${Date.now()}`,
    data: {
      category: 'TEST_NOTIFICATION',
      url: user.role === 'admin' ? '/#admin' : user.role === 'receptionist' ? '/#receptionist' : '/#profile',
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
  };

  const payloadString = JSON.stringify(testPayload);
  const results = await Promise.all(
    subscriptions.map((sub) => sendToSubscription(sub, payloadString, null))
  );

  const successful = results.filter((r) => r.success).length;
  return {
    success: successful > 0,
    totalAttempted: subscriptions.length,
    successful,
    results,
  };
}
