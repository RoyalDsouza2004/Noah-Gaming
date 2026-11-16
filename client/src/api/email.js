import { apiRequest } from './client.js';

export const emailApi = {
  // Fetch Resend service status, sender email and activity stats
  getEmailStatus: () => apiRequest('/admin/email/status'),

  // Fetch paginated email logs with filters
  getEmailLogs: (params = '') => apiRequest(`/admin/email/logs?${params}`),

  // Send a test email to verify credentials
  sendTestEmail: (recipient) =>
    apiRequest('/admin/email/test', {
      method: 'POST',
      body: { recipient },
    }),

  // Retry sending an email log
  retryEmail: (id) =>
    apiRequest(`/admin/email/retry/${id}`, {
      method: 'POST',
    }),

  // Customer: Request password reset link via email
  requestPasswordResetEmail: (email) =>
    apiRequest('/auth/forgot-password-email', {
      method: 'POST',
      body: { email },
    }),

  // Customer: Set new password with email reset token
  resetPasswordWithToken: (token, newPassword) =>
    apiRequest('/auth/reset-password-email', {
      method: 'POST',
      body: { token, newPassword },
    }),
};
