import { apiRequest } from './client.js';

export const authApi = {
  // Check backend and database health
  getHealth: () => apiRequest('/health'),

  // Register customer
  register: (payload) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: payload,
    }),

  // Login (with email or phone)
  login: (identifier, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    }),

  // Customer 2FA Verification for Login
  verifyLogin2FA: (challengeId, otp) =>
    apiRequest('/auth/login-2fa/verify', {
      method: 'POST',
      body: { challengeId, otp },
    }),

  // Customer 2FA Resend for Login
  resendLogin2FA: (challengeId) =>
    apiRequest('/auth/login-2fa/resend', {
      method: 'POST',
      body: { challengeId },
    }),

  // Fetch current user details
  getMe: () => apiRequest('/auth/me'),

  // Update profile
  updateProfile: (payload) =>
    apiRequest('/auth/profile', {
      method: 'PUT',
      body: payload,
    }),

  // Fetch all users (staff/admin)
  getUsers: (params = '') => apiRequest(`/users?${params}`),

  // Search customer by phone (receptionist)
  searchCustomerByPhone: (phone) => apiRequest(`/users/phone/${phone}`),

  // Fetch audit activity logs (admin)
  getActivityLogs: (params = '') => apiRequest(`/users/audit/logs?${params}`),
};
