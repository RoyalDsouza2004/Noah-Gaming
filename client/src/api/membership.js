import { apiRequest } from './client.js';

export const membershipApi = {
  // Public Plans
  getPlans: () => apiRequest('/memberships/plans'),
  getPlanById: (id) => apiRequest(`/memberships/plans/${id}`),

  // Customer Operations
  purchaseMembership: (data) =>
    apiRequest('/memberships/purchase', {
      method: 'POST',
      body: data,
    }),

  verifyMembership: (data) =>
    apiRequest('/memberships/verify', {
      method: 'POST',
      body: data,
    }),

  getMySubscriptions: () => apiRequest('/memberships/my-subscriptions'),
  getMyUsage: () => apiRequest('/memberships/my-usage'),

  renewSubscription: (subscriptionId) =>
    apiRequest(`/memberships/${subscriptionId}/renew`, {
      method: 'POST',
    }),

  // Staff Operations (Offline Purchase)
  recordOfflinePurchase: (data) =>
    apiRequest('/memberships/offline-purchase', {
      method: 'POST',
      body: data,
    }),

  // Upgrade Membership Operations (Phase 5.1)
  getEligibleUpgrades: (customerId) =>
    apiRequest(`/memberships/eligible-upgrades${customerId ? `?customerId=${customerId}` : ''}`),
  getUpgradeQuote: (targetPlanId, customerId) =>
    apiRequest(
      `/memberships/upgrade-quote?targetPlanId=${targetPlanId}${
        customerId ? `&customerId=${customerId}` : ''
      }`
    ),
  initiateUpgrade: (data) =>
    apiRequest('/memberships/upgrade/initiate', {
      method: 'POST',
      body: data,
    }),
  verifyUpgrade: (data) =>
    apiRequest('/memberships/upgrade/verify', {
      method: 'POST',
      body: data,
    }),
  offlineUpgrade: (data) =>
    apiRequest('/memberships/upgrade/offline', {
      method: 'POST',
      body: data,
    }),
  offlineRenewal: (data) =>
    apiRequest('/memberships/renew/offline', {
      method: 'POST',
      body: data,
    }),

  // Admin Plan Management
  getAdminPlans: () => apiRequest('/admin/memberships/plans'),
  createAdminPlan: (data) =>
    apiRequest('/admin/memberships/plans', {
      method: 'POST',
      body: data,
    }),
  updateAdminPlan: (id, data) =>
    apiRequest(`/admin/memberships/plans/${id}`, {
      method: 'PUT',
      body: data,
    }),
  deleteAdminPlan: (id) =>
    apiRequest(`/admin/memberships/plans/${id}`, {
      method: 'DELETE',
    }),

  // Admin Subscriptions & Usage Audit
  getAdminSubscriptions: (query = '') =>
    apiRequest(`/admin/memberships/subscriptions${query ? `?${query}` : ''}`),
  updateAdminSubscription: (id, data) =>
    apiRequest(`/admin/memberships/subscriptions/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  getAdminUsage: (query = '') =>
    apiRequest(`/admin/memberships/usage${query ? `?${query}` : ''}`),
};
