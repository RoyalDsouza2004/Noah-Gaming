import { apiRequest } from './client.js';

export const sessionsApi = {
  // Get active and awaiting checkout sessions
  getActiveSessions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/sessions/active${q ? `?${q}` : ''}`);
  },

  // Get session by ID
  getSessionById: (id) => apiRequest(`/sessions/${id}`),

  // Start a session
  startSession: (bookingId) =>
    apiRequest(`/sessions/${bookingId}/start`, {
      method: 'POST',
      body: { bookingId },
    }),

  // Extend a session
  extendSession: (sessionId, data) =>
    apiRequest(`/sessions/${sessionId}/extend`, {
      method: 'POST',
      body: data,
    }),

  // Complete a session upon checkout confirmation
  completeSession: (sessionId, data = {}) =>
    apiRequest(`/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: data,
    }),
};
