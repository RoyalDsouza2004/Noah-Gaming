import { apiRequest } from './client.js';

export const bookingApi = {
  // Live Availability (cache-busted to always reflect latest reservations)
  getAvailability: (deviceId, date, duration = 1, gameId = null) =>
    apiRequest(
      `/bookings/availability?deviceId=${deviceId}&date=${date}&duration=${duration}${
        gameId ? `&gameId=${gameId}` : ''
      }&_t=${Date.now()}`
    ),

  // Customer Booking Operations
  createBooking: (data) =>
    apiRequest('/bookings', {
      method: 'POST',
      body: data,
    }),
  getMyBookings: (query = '') =>
    apiRequest(`/bookings/my-bookings${query ? `?${query}` : ''}`),
  getBookingById: (id) => apiRequest(`/bookings/${id}`),
  cancelBooking: (id, reason = '') =>
    apiRequest(`/bookings/${id}/cancel`, {
      method: 'PATCH',
      body: { reason },
    }),

  // Admin / Staff Operations
  getAdminBookings: (query = '') =>
    apiRequest(`/admin/bookings${query ? `?${query}` : ''}`),
  createAdminBooking: (data) =>
    apiRequest('/admin/bookings', {
      method: 'POST',
      body: data,
    }),
  updateAdminBooking: (id, data) =>
    apiRequest(`/admin/bookings/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  getCalendarTimeline: (query = '') =>
    apiRequest(`/admin/bookings/calendar${query ? `?${query}` : ''}`),
};
