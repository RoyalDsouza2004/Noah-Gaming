import { apiRequest } from './client.js';

export const adminOtpApi = {
  // Get pending & recent OTP challenges with optional filters
  getPendingRequests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/otp/requests${query ? `?${query}` : ''}`);
  },

  // Approve challenge with Admin Password re-authentication
  approveRequest: (challengeId, adminPassword, note = '') =>
    apiRequest(`/admin/otp/requests/${challengeId}/approve`, {
      method: 'POST',
      body: { adminPassword, note },
    }),

  // Reject challenge with explanation
  rejectRequest: (challengeId, reason = '') =>
    apiRequest(`/admin/otp/requests/${challengeId}/reject`, {
      method: 'POST',
      body: { reason },
    }),

  // Inspect email delivery logs for challenge
  getDeliveryDetails: (challengeId) =>
    apiRequest(`/admin/otp/requests/${challengeId}/delivery`),

  // Permanent verification history audit log
  getHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/otp/history${query ? `?${query}` : ''}`);
  },
};
