import Notification from '../models/Notification.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import User from '../models/User.js';
import { sendWhatsAppMessage } from './whatsapp.service.js';
import { sendPushToUser, sendPushToRoles } from './pushNotification.service.js';

/**
 * Maps notification category to relevant in-app client route
 */
function resolveNotificationUrl(category, relatedBooking, relatedSession, recipientRole) {
  if (recipientRole === 'admin') return '/#admin';
  if (recipientRole === 'receptionist') return '/#receptionist';

  if (category?.startsWith('BOOKING_') || category === 'UPCOMING_BOOKING') {
    return '/#bookings';
  }
  if (category?.startsWith('MEMBERSHIP_')) {
    return '/#membership';
  }
  if (category?.startsWith('SESSION_') || category?.startsWith('PAYMENT_')) {
    return '/#profile';
  }
  return '/#profile';
}

/**
 * Creates and delivers a notification idempotently across channels.
 */
export async function createNotification({
  recipient,
  recipientRole = 'customer',
  title,
  message,
  category,
  type,
  relatedBooking = null,
  relatedSession = null,
  deliveryChannels = ['IN_APP'],
  idempotencyKey = null,
  metadata = {},
}) {
  const resolvedCategory = category || type || 'SYSTEM_ALERT';

  // PART 3 SPECIFIC: Disallow creating "WhatsApp Verified" notifications
  if (
    title === 'WhatsApp Verified' ||
    resolvedCategory === 'WHATSAPP_VERIFIED' ||
    metadata?.type === 'WHATSAPP_VERIFIED'
  ) {
    return { duplicate: false, notification: null, disabled: true };
  }

  // If idempotencyKey provided, prevent sending duplicate notifications
  if (idempotencyKey) {
    const existing = await Notification.findOne({ idempotencyKey });
    if (existing) {
      return { duplicate: true, notification: existing };
    }
  }

  const notification = await Notification.create({
    recipient,
    recipientRole,
    title,
    message,
    category: resolvedCategory,
    relatedBooking,
    relatedSession,
    deliveryChannels,
    idempotencyKey,
    metadata,
  });

  // Create IN_APP delivery record
  await NotificationDelivery.create({
    notification: notification._id,
    recipient,
    channel: 'IN_APP',
    deliveryStatus: 'DELIVERED',
    providerReference: `INAPP-${notification._id}`,
  });

  // Handle optional WHATSAPP delivery
  if (deliveryChannels.includes('WHATSAPP')) {
    const recipientUser = await User.findById(recipient).select('name phone email');
    if (recipientUser && recipientUser.phone) {
      await sendWhatsAppMessage({
        recipientUser,
        notificationId: notification._id,
        templateKey: category,
        bodyText: `${title}\n\n${message}`,
        parameters: [],
      });
    }
  }

  // Handle standards-based Web Push delivery across subscribed user devices
  try {
    const targetUrl = resolveNotificationUrl(resolvedCategory, relatedBooking, relatedSession, recipientRole);
    const pushPayload = {
      title: title.startsWith('NOAH GAMING') ? title : `NOAH GAMING: ${title}`,
      message,
      category: resolvedCategory,
      url: targetUrl,
      tag: `noah-${notification._id}`,
      data: {
        bookingId: relatedBooking ? String(relatedBooking) : undefined,
        sessionId: relatedSession ? String(relatedSession) : undefined,
      },
    };

    if (recipientRole === 'all_staff' || recipientRole === 'receptionist' || recipientRole === 'admin') {
      const roles = recipientRole === 'all_staff' ? ['receptionist', 'admin'] : [recipientRole];
      await sendPushToRoles({ roles, notification, payload: pushPayload });
    } else if (recipient) {
      await sendPushToUser({ userId: recipient, notification, payload: pushPayload });
    }
  } catch (pushErr) {
    console.warn('[Notification Service] Web Push delivery error:', pushErr.message);
  }

  return { duplicate: false, notification };
}

/**
 * Automatically deletes read notifications 3 days (72 hours) after they are marked as read.
 * Unread notifications (isRead === false or readAt === null) are NEVER deleted.
 * The retention period begins strictly when the notification was marked as read (readAt), NOT createdAt.
 */
export async function cleanupExpiredReadNotifications(retentionHours = 72) {
  try {
    const retentionMs = retentionHours * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - retentionMs);

    // Find all read notifications whose readAt timestamp is older than or equal to cutoff
    const filter = {
      isRead: true,
      readAt: { $ne: null, $lte: cutoff },
    };

    const expired = await Notification.find(filter).select('_id').lean();
    if (!expired || expired.length === 0) {
      return { deletedCount: 0 };
    }

    const expiredIds = expired.map((doc) => doc._id);

    // Delete notifications and associated delivery logs atomically
    const [deleteResult] = await Promise.all([
      Notification.deleteMany({ _id: { $in: expiredIds } }),
      NotificationDelivery.deleteMany({ notification: { $in: expiredIds } }),
    ]);

    return { deletedCount: deleteResult.deletedCount || expiredIds.length };
  } catch (err) {
    console.error('[Notification Cleanup Error]', err.message);
    return { deletedCount: 0, error: err.message };
  }
}

/**
 * Fetches notifications for a user (Customer, Receptionist, or Admin)
 */
export async function getUserNotifications(user, { category, isRead, page = 1, limit = 20 }) {
  // Automatically trigger read notification cleanup before returning results
  await cleanupExpiredReadNotifications(72);

  const query = {
    $or: [{ recipient: user._id }],
    // Ensure "WhatsApp Verified" notification is not returned
    title: { $ne: 'WhatsApp Verified' },
  };

  // Receptionist/Admin can also see staff-wide notifications
  if (user.role === 'receptionist' || user.role === 'admin') {
    query.$or.push({ recipientRole: 'receptionist' });
    query.$or.push({ recipientRole: 'all_staff' });
  }

  if (user.role === 'admin') {
    query.$or.push({ recipientRole: 'admin' });
  }

  if (category && category !== 'ALL') {
    if (category === 'WHATSAPP_VERIFIED') {
      return {
        notifications: [],
        pagination: { total: 0, unread: 0, page: 1, pages: 0, limit: parseInt(limit, 10) },
      };
    }
    query.category = category;
  } else {
    query.category = { $ne: 'WHATSAPP_VERIFIED' };
  }

  if (isRead !== undefined && isRead !== '' && isRead !== 'all') {
    query.isRead = isRead === 'true' || isRead === true;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const pageSize = parseInt(limit, 10);

  const [notifications, total, unread] = await Promise.all([
    Notification.find(query)
      .populate('relatedBooking', 'bookingId bookingDate startTime endTime bookingStatus')
      .populate('relatedSession', 'status scheduledEndAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);

  return {
    notifications,
    pagination: {
      total,
      unread,
      page: parseInt(page, 10),
      pages: Math.ceil(total / pageSize),
      limit: pageSize,
    },
  };
}

/**
 * Returns unread count for current user
 */
export async function getUnreadCount(user) {
  // Automatically trigger read notification cleanup
  await cleanupExpiredReadNotifications(72);

  const query = {
    isRead: false,
    title: { $ne: 'WhatsApp Verified' },
    category: { $ne: 'WHATSAPP_VERIFIED' },
    $or: [{ recipient: user._id }],
  };

  if (user.role === 'receptionist' || user.role === 'admin') {
    query.$or.push({ recipientRole: 'receptionist' });
    query.$or.push({ recipientRole: 'all_staff' });
  }

  if (user.role === 'admin') {
    query.$or.push({ recipientRole: 'admin' });
  }

  return await Notification.countDocuments(query);
}

/**
 * Marks a notification as read
 * Prevents repeated read actions from incorrectly resetting the original read timestamp.
 */
export async function markAsRead(notificationId, user) {
  const query = { _id: notificationId };
  if (user && user.role !== 'admin') {
    query.$or = [{ recipient: user._id }];
    if (user.role === 'receptionist') {
      query.$or.push({ recipientRole: 'receptionist' });
      query.$or.push({ recipientRole: 'all_staff' });
    }
  }

  const notification = await Notification.findOne(query);
  if (!notification) {
    const err = new Error('Notification not found or access denied');
    err.status = 404;
    throw err;
  }

  // If already read, do NOT reset readAt (preserve original read timestamp)
  if (!notification.isRead || !notification.readAt) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
}

/**
 * Marks all notifications as read for current user
 * Only unread notifications are updated to preserve original read timestamps of already-read notifications.
 */
export async function markAllAsRead(user) {
  const query = {
    isRead: false,
    $or: [{ recipient: user._id }],
  };

  if (user.role === 'receptionist' || user.role === 'admin') {
    query.$or.push({ recipientRole: 'receptionist' });
    query.$or.push({ recipientRole: 'all_staff' });
  }

  if (user.role === 'admin') {
    query.$or.push({ recipientRole: 'admin' });
  }

  const now = new Date();
  const result = await Notification.updateMany(query, {
    $set: { isRead: true, readAt: now },
  });

  return { modifiedCount: result.modifiedCount };
}

/**
 * Administrative notification search and audit
 */
export async function getAdminNotifications({ category, role, page = 1, limit = 30 }) {
  const query = {};
  if (category) query.category = category;
  if (role) query.recipientRole = role;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const pageSize = parseInt(limit, 10);

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .populate('recipient', 'name email phone role')
      .populate('relatedBooking', 'bookingId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments(query),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / pageSize),
      limit: pageSize,
    },
  };
}
