import * as notificationService from '../services/notification.service.js';

export const getNotifications = async (req, res, next) => {
  try {
    const data = await notificationService.getUserNotifications(req.user, req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unread = await notificationService.getUnreadCount(req.user);
    res.json({
      success: true,
      data: { unreadCount: unread },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Notification marked as read.',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user);
    res.json({
      success: true,
      message: 'All notifications marked as read.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
