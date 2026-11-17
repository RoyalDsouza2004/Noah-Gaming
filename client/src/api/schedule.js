import { apiRequest } from './client.js';

export const scheduleApi = {
  // Public / Shared
  getOperatingStatus: () => apiRequest('/schedule/operating-status'),
  getEffectiveDay: (date) => apiRequest(`/schedule/effective-day?date=${date}`),

  // Admin: Weekly Operating Hours
  getWeeklyHours: () => apiRequest('/schedule/admin/operating-hours'),
  updateWeeklyHours: (schedule) =>
    apiRequest('/schedule/admin/operating-hours', {
      method: 'PUT',
      body: { schedule },
    }),

  // Admin: Holidays & Closures
  getHolidays: (query = '') =>
    apiRequest(`/schedule/admin/holidays${query ? `?${query}` : ''}`),
  createHoliday: (data) =>
    apiRequest('/schedule/admin/holidays', {
      method: 'POST',
      body: data,
    }),
  updateHoliday: (id, data) =>
    apiRequest(`/schedule/admin/holidays/${id}`, {
      method: 'PUT',
      body: data,
    }),
  deleteHoliday: (id) =>
    apiRequest(`/schedule/admin/holidays/${id}`, {
      method: 'DELETE',
    }),

  // Admin: Check conflicts against confirmed bookings
  checkConflicts: (data) =>
    apiRequest('/schedule/admin/check-conflicts', {
      method: 'POST',
      body: data,
    }),
};
