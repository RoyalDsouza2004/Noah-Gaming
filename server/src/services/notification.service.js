import Notification from '../models/Notification.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import User from '../models/User.js';
import { sendWhatsAppMessage } from './whatsapp.service.js';

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

  return { duplicate: false, notification };
}

/**
 * Fetches notifications for a user (Customer, Receptionist, or Admin)
 */
export async function getUserNotifications(user, { category, isRead, page = 1, limit = 20 }) {
  const query = {
    $or: [{ recipient: user._id }],
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
    query.category = category;
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

  return await Notification.countDocuments(query);
}

/**
 * Marks a notification as read
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

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return notification;
}

/**
 * Marks all notifications as read for current user
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

  const result = await Notification.updateMany(query, {
    $set: { isRead: true, readAt: new Date() },
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
