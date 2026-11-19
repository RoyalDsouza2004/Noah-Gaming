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

  // Customer Registration OTP Verification
  verifyRegistrationOtp: (challengeId, otp) =>
    apiRequest('/auth/register/verify-otp', {
      method: 'POST',
      body: { challengeId, otp },
    }),

  // Customer Registration OTP Resend
  resendRegistrationOtp: (challengeId) =>
    apiRequest('/auth/register/resend-otp', {
      method: 'POST',
      body: { challengeId },
    }),

  // Admin-Assisted OTP Verification Fallback Endpoints
  requestOtpAssistance: (challengeId) =>
    apiRequest('/auth/otp-assistance/request', {
      method: 'POST',
      body: { challengeId },
    }),

  getOtpAssistanceStatus: (challengeId) =>
    apiRequest(`/auth/otp-assistance/status/${challengeId}`),

  completeOtpAssistance: (challengeId, approvalToken) =>
    apiRequest('/auth/otp-assistance/complete', {
      method: 'POST',
      body: { challengeId, approvalToken },
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
