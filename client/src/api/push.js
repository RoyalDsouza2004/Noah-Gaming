import { apiRequest } from './client.js';

export const pushApi = {
  // Fetch VAPID Public Key for Web Push registration
  getVapidPublicKey: () => apiRequest('/push/vapid-public-key'),

  // Get current user's push subscription status and registered devices
  getStatus: (endpoint) => {
    const q = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
    return apiRequest(`/push/status${q}`);
  },

  // Register or refresh a browser push subscription
  subscribe: (subscription, userAgent) =>
    apiRequest('/push/subscribe', {
      method: 'POST',
      body: { subscription, userAgent },
    }),

  // Unsubscribe a specific device endpoint
  unsubscribe: (endpoint) =>
    apiRequest('/push/unsubscribe', {
      method: 'POST',
      body: { endpoint },
    }),

  // Unsubscribe all devices for current user
  unsubscribeAll: () =>
    apiRequest('/push/unsubscribe-all', {
      method: 'POST',
    }),

  // Send an immediate test push notification
  sendTestPush: (endpoint) =>
    apiRequest('/push/test', {
      method: 'POST',
      body: { endpoint },
    }),
};
