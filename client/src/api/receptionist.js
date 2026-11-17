import { apiRequest } from './client.js';

export const receptionistApi = {
  // 1. Dashboard Live Metrics
  getDashboardStats: () => apiRequest('/receptionist/dashboard'),

  // 2. Customer Lookup & Verification
  searchCustomers: (query) =>
    apiRequest(`/receptionist/customers/search?q=${encodeURIComponent(query || '')}`),
  registerCustomer: (data) =>
    apiRequest('/receptionist/customers', {
      method: 'POST',
      body: data,
    }),
  getCustomerDetails: (customerId, filter = 'all', startDate = '', endDate = '') =>
    apiRequest(
      `/receptionist/customers/${customerId}?filter=${filter}${
        startDate ? `&startDate=${startDate}` : ''
      }${endDate ? `&endDate=${endDate}` : ''}`
    ),

  // 3. Bookings & Walk-ins
  createWalkInBooking: (data) =>
    apiRequest('/receptionist/bookings', {
      method: 'POST',
      body: data,
    }),
  getTodayBookings: ({ search = '', status = '', checkInStatus = '' } = {}) =>
    apiRequest(
      `/receptionist/bookings/today?search=${encodeURIComponent(search)}&status=${status}&checkInStatus=${checkInStatus}`
    ),
  getUpcomingBookings: (limit = 50) =>
    apiRequest(`/receptionist/bookings/upcoming?limit=${limit}`),
  getBookingDetails: (id) => apiRequest(`/receptionist/bookings/${id}`),
  checkInBooking: (id, paymentCollection = null) =>
    apiRequest(`/receptionist/bookings/${id}/check-in`, {
      method: 'POST',
      body: { paymentCollection },
    }),
  markNoShow: (id, reason = '') =>
    apiRequest(`/receptionist/bookings/${id}/no-show`, {
      method: 'POST',
      body: { reason },
    }),

  // 4. Live Sessions
  getActiveSessions: () => apiRequest('/receptionist/sessions/active'),
  startSession: (id) =>
    apiRequest(`/receptionist/sessions/${id}/start`, {
      method: 'POST',
    }),
  previewExtension: (id, durationHours = 1) =>
    apiRequest(`/receptionist/sessions/${id}/preview-extension?durationHours=${durationHours}`),
  extendSession: (id, data) =>
    apiRequest(`/receptionist/sessions/${id}/extend`, {
      method: 'POST',
      body: data,
    }),
  completeSession: (id, data = {}) =>
    apiRequest(`/receptionist/sessions/${id}/complete`, {
      method: 'POST',
      body: data,
    }),

  // 5. Payments
  collectOfflinePayment: (data) =>
    apiRequest('/receptionist/payments/offline', {
      method: 'POST',
      body: data,
    }),
  getPendingPayments: () => apiRequest('/receptionist/payments/pending'),

  // 6. Audit Activity Logs (Admin)
  getActivityLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/receptionist/activity-logs?${q}`);
  },
};
