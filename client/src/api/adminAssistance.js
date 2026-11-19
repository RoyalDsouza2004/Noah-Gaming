import { apiRequest } from './client.js';

export const adminAssistanceApi = {
  // Get pending & recent Admin Assistance requests with optional filters
  getAssistanceRequests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/assistance/requests${query ? `?${query}` : ''}`);
  },

  // Approve assistance request with Admin Password re-authentication
  approveRequest: (challengeId, adminPassword, note = '') =>
    apiRequest(`/admin/assistance/requests/${challengeId}/approve`, {
      method: 'POST',
      body: { adminPassword, note },
    }),

  // Reject assistance request with reason
  rejectRequest: (challengeId, reason = '') =>
    apiRequest(`/admin/assistance/requests/${challengeId}/reject`, {
      method: 'POST',
      body: { reason },
    }),

  // Assistance audit log history
  getHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/assistance/history${query ? `?${query}` : ''}`);
  },
};
