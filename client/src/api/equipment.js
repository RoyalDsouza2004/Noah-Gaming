import { apiRequest } from './client.js';

export const equipmentApi = {
  // Devices
  getDevices: (query = '') => apiRequest(`/devices${query ? `?${query}` : ''}`),
  getDeviceById: (id) => apiRequest(`/devices/${id}`),
  createDevice: (data) =>
    apiRequest('/devices', {
      method: 'POST',
      body: data,
    }),
  updateDevice: (id, data) =>
    apiRequest(`/devices/${id}`, {
      method: 'PUT',
      body: data,
    }),
  deleteDevice: (id) =>
    apiRequest(`/devices/${id}`, {
      method: 'DELETE',
    }),

  // Games
  getGames: (query = '') => apiRequest(`/games${query ? `?${query}` : ''}`),
  getGameById: (id) => apiRequest(`/games/${id}`),
  createGame: (data) =>
    apiRequest('/games', {
      method: 'POST',
      body: data,
    }),
  updateGame: (id, data) =>
    apiRequest(`/games/${id}`, {
      method: 'PUT',
      body: data,
    }),
  deleteGame: (id) =>
    apiRequest(`/games/${id}`, {
      method: 'DELETE',
    }),
  searchExternalGames: (q, provider = '') =>
    apiRequest(`/games/search-external?q=${encodeURIComponent(q)}${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`),
  getProvidersStatus: () => apiRequest('/games/providers-status'),
  importGame: (data) =>
    apiRequest('/games/import', {
      method: 'POST',
      body: data,
    }),
  refreshGameMetadata: (id) =>
    apiRequest(`/games/${id}/refresh`, {
      method: 'POST',
    }),

  // Categories
  getCategories: (query = '') => apiRequest(`/categories${query ? `?${query}` : ''}`),
  createCategory: (data) =>
    apiRequest('/categories', {
      method: 'POST',
      body: data,
    }),
  updateCategory: (id, data) =>
    apiRequest(`/categories/${id}`, {
      method: 'PUT',
      body: data,
    }),
  deleteCategory: (id) =>
    apiRequest(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Pricing
  getPricing: (query = '') => apiRequest(`/pricing${query ? `?${query}` : ''}`),
  createPricing: (data) =>
    apiRequest('/pricing', {
      method: 'POST',
      body: data,
    }),
  updatePricing: (id, data) =>
    apiRequest(`/pricing/${id}`, {
      method: 'PUT',
      body: data,
    }),
  deletePricing: (id) =>
    apiRequest(`/pricing/${id}`, {
      method: 'DELETE',
    }),
  calculatePrice: (data) =>
    apiRequest('/pricing/calculate', {
      method: 'POST',
      body: data,
    }),

  // Maintenance
  getMaintenance: (query = '') => apiRequest(`/maintenance${query ? `?${query}` : ''}`),
  getMaintenanceByDevice: (deviceId) => apiRequest(`/maintenance/device/${deviceId}`),
  createMaintenance: (data) =>
    apiRequest('/maintenance', {
      method: 'POST',
      body: data,
    }),
  updateMaintenance: (id, data) =>
    apiRequest(`/maintenance/${id}`, {
      method: 'PUT',
      body: data,
    }),
};
