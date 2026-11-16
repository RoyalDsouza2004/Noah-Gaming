import { apiRequest } from './client.js';

export const automationApi = {
  // Fetch automation settings
  getSettings: () => apiRequest('/admin/automation/settings'),

  // Update automation settings
  updateSettings: (data) =>
    apiRequest('/admin/automation/settings', {
      method: 'PUT',
      body: data,
    }),

  // Fetch scheduler execution logs
  getLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/automation/logs${q ? `?${q}` : ''}`);
  },

  // Trigger manual automation cycle
  triggerCycle: () =>
    apiRequest('/admin/automation/trigger', {
      method: 'POST',
    }),
};
