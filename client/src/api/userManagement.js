import { apiRequest } from './client.js';

export const userManagementApi = {
  // Get paginated users with search, role, type, and status filters
  getUsers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search) query.append('search', params.search);
    if (params.accountType && params.accountType !== 'ALL') query.append('accountType', params.accountType);
    if (params.role && params.role !== 'ALL') query.append('role', params.role);
    if (params.accountStatus && params.accountStatus !== 'ALL') query.append('accountStatus', params.accountStatus);
    if (params.membershipStatus && params.membershipStatus !== 'ALL') query.append('membershipStatus', params.membershipStatus);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    return apiRequest(`/admin/users?${query.toString()}`);
  },

  // Get full user details including bookings, sessions, payments, and memberships
  getUserDetails: async (userId) => {
    return apiRequest(`/admin/users/${userId}`);
  },

  // Update customer details (name, phone, email, notes, accountStatus)
  updateUserDetails: async (userId, data) => {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Change user role (Admin only)
  changeUserRole: async (userId, role) => {
    return apiRequest(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  // Delete user (Admin only)
  deleteUser: async (userId) => {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Initiate guest conversion OTP
  initiateGuestConversion: async (userId, data = {}) => {
    return apiRequest(`/admin/users/${userId}/convert/request-otp`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Complete guest conversion
  completeGuestConversion: async (userId, data) => {
    return apiRequest(`/admin/users/${userId}/convert/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Initiate password reset OTP
  initiatePasswordReset: async (userId) => {
    return apiRequest(`/admin/users/${userId}/reset-password/request-otp`, {
      method: 'POST',
    });
  },

  // Complete password reset
  completePasswordReset: async (userId, data) => {
    return apiRequest(`/admin/users/${userId}/reset-password/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Check duplicate user by phone or email
  checkDuplicate: async (phoneOrEmail, emailParam) => {
    let queryStr = '';
    if (typeof phoneOrEmail === 'object' && phoneOrEmail !== null) {
      const parts = [];
      if (phoneOrEmail.phone) parts.push(`phone=${encodeURIComponent(phoneOrEmail.phone)}`);
      if (phoneOrEmail.email) parts.push(`email=${encodeURIComponent(phoneOrEmail.email)}`);
      queryStr = parts.join('&');
    } else if (emailParam) {
      queryStr = `phone=${encodeURIComponent(phoneOrEmail)}&email=${encodeURIComponent(emailParam)}`;
    } else {
      const isEmail = String(phoneOrEmail).includes('@');
      queryStr = isEmail ? `email=${encodeURIComponent(phoneOrEmail)}` : `phone=${encodeURIComponent(phoneOrEmail)}`;
    }
    return apiRequest(`/admin/users/check-duplicate?${queryStr}`);
  },

  // Merge duplicate accounts (Admin only)
  mergeAccounts: async (primaryUserId, secondaryUserId, reason) => {
    return apiRequest('/admin/users/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryUserId, secondaryUserId, reason }),
    });
  },

  // Customer online conversion request OTP
  requestOnlineConversionOtp: async (identifier, email) => {
    return apiRequest('/auth/conversion/request-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, email }),
    });
  },

  // Customer online conversion verify & set password
  verifyOnlineConversionOtp: async (data) => {
    return apiRequest('/auth/conversion/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Customer online forgot password request OTP
  requestOnlineForgotPasswordOtp: async (identifier) => {
    return apiRequest('/auth/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  // Customer online forgot password verify & set new password
  verifyOnlineForgotPasswordOtp: async (data) => {
    return apiRequest('/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
