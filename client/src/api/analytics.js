import { apiRequest } from './client.js';

export const analyticsApi = {
  // 1. Dashboard KPIs
  getDashboardKPIs: () => apiRequest('/admin/analytics/dashboard'),

  // 2. Revenue Analytics
  getRevenueAnalytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/revenue?${q}`);
  },
  getRevenueByDevice: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/revenue/by-device?${q}`);
  },
  getRevenueByGame: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/revenue/by-game?${q}`);
  },
  getRevenueByPaymentMethod: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/revenue/by-payment-method?${q}`);
  },

  // 3. Booking Analytics
  getBookingAnalytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/bookings?${q}`);
  },
  getBookingTrends: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/bookings/trends?${q}`);
  },

  // 4. Device Utilization
  getDeviceUtilization: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/devices/utilization?${q}`);
  },

  // 5. Game Performance
  getGamePerformance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/games/performance?${q}`);
  },

  // 6. Customer Analytics
  getCustomerAnalytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/customers?${q}`);
  },

  // 7. Membership Analytics
  getMembershipAnalytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/memberships?${q}`);
  },

  // 8. Receptionist Monitoring
  getReceptionistPerformance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/receptionists?${q}`);
  },

  // 9. Maintenance Analytics
  getMaintenanceAnalytics: () => apiRequest('/admin/analytics/maintenance'),

  // 10. Financial & Payment Reports
  getFinancialPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/analytics/payments/financial?${q}`);
  },
};
