import { apiRequest } from './client.js';

export const userProfileApi = {
  getProfile: () => apiRequest('/users/profile'),
  updateProfile: (data) =>
    apiRequest('/users/profile', {
      method: 'PUT',
      body: data,
    }),
  changePassword: (data) =>
    apiRequest('/users/change-password', {
      method: 'PUT',
      body: data,
    }),
  updateProfilePicture: (data) =>
    apiRequest('/users/profile/picture', {
      method: 'PUT',
      body: data,
    }),
  removeProfilePicture: () =>
    apiRequest('/users/profile/picture', {
      method: 'DELETE',
    }),
  getGamingHistory: (query = '') =>
    apiRequest(`/users/gaming-history${query ? `?${query}` : ''}`),
  getPaymentHistory: (query = '') =>
    apiRequest(`/users/payment-history${query ? `?${query}` : ''}`),
  getDashboard: () => apiRequest('/users/dashboard'),
  getNotifications: () => apiRequest('/users/notifications'),
  markNotificationRead: (id) =>
    apiRequest(`/users/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllNotificationsRead: () =>
    apiRequest('/users/notifications/read-all', {
      method: 'PATCH',
    }),
};
