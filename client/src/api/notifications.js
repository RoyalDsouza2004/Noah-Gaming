import { apiRequest } from './client.js';

export const notificationsApi = {
  // Fetch user notifications
  getNotifications: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/notifications${q ? `?${q}` : ''}`);
  },

  // Get unread notification count
  getUnreadCount: () => apiRequest('/notifications/unread-count'),

  // Mark single notification as read
  markAsRead: (id) =>
    apiRequest(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  // Mark all notifications as read
  markAllAsRead: () =>
    apiRequest('/notifications/read-all', {
      method: 'PATCH',
    }),

  // Admin global notification audit
  getAdminNotifications: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/notifications${q ? `?${q}` : ''}`);
  },
};

export const notificationApi = notificationsApi;
