import { apiRequest, API_BASE_URL, getAuthToken } from './client.js';

export const paymentApi = {
  // 1. Online Razorpay Payments
  createOrder: ({ bookingId, paymentPurpose = 'BOOKING_FULL' }) =>
    apiRequest('/payments/create-order', {
      method: 'POST',
      body: { bookingId, paymentPurpose },
    }),

  verifyPayment: ({ orderId, paymentId, signature }) =>
    apiRequest('/payments/verify', {
      method: 'POST',
      body: { orderId, paymentId, signature },
    }),

  getTestSignature: (orderId) =>
    apiRequest('/payments/test-signature', {
      method: 'POST',
      body: { orderId },
    }),

  // 2. Offline Reception Desk Collection (CASH, COUNTER_UPI)
  recordOfflinePayment: ({
    bookingId,
    amount,
    paymentMethod,
    transactionReference,
    paymentPurpose,
    notes,
  }) =>
    apiRequest('/payments/offline', {
      method: 'POST',
      body: {
        bookingId,
        amount,
        paymentMethod,
        transactionReference,
        paymentPurpose,
        notes,
      },
    }),

  // 3. Customer History & Specific Booking Transactions
  getMyPayments: (query = '') =>
    apiRequest(`/payments/my-payments${query ? `?${query}` : ''}`),

  getBookingPayments: (bookingId) =>
    apiRequest(`/payments/booking/${bookingId}`),

  getPaymentDetails: (paymentId) =>
    apiRequest(`/payments/${paymentId}`),

  // 4. Receipt Access (JSON breakdown, Printable HTML, or PDF Download)
  getReceipt: (paymentId, format = 'json') =>
    apiRequest(`/payments/${paymentId}/receipt?format=${format}`),

  getReceiptHtmlUrl: (paymentId) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/payments/${paymentId}/receipt?format=html${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  },

  downloadReceiptPdf: async (paymentId) => {
    const token = getAuthToken();
    const url = `${API_BASE_URL}/payments/${paymentId}/receipt?format=pdf${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') || '';
      let errMsg = 'Failed to download receipt PDF.';
      if (contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        errMsg = err.message || errMsg;
      } else {
        const text = await res.text().catch(() => '');
        const isHtml = /<html|<!doctype/i.test(text);
        errMsg = isHtml ? `Server returned HTTP ${res.status}` : text || errMsg;
      }
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    let fileName = `NOAH_GAMING_Receipt_${paymentId}.pdf`;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) fileName = match[1];
    }
    const fileBlob = new Blob([blob], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
    return { success: true, fileName };
  },

  // 5. Razorpay Configuration & Admin Settings
  getPublicPaymentConfig: () =>
    apiRequest('/payments/config'),

  getPaymentSettings: () =>
    apiRequest('/admin/payments/settings'),

  // 6. Admin Financial Operations & Reports
  getAdminPayments: (query = '') =>
    apiRequest(`/admin/payments${query ? `?${query}` : ''}`),

  getRevenueReports: (query = '') =>
    apiRequest(`/admin/payments/reports${query ? `?${query}` : ''}`),

  getFinancialReconciliation: (query = '') =>
    apiRequest(`/admin/payments/reconciliation${query ? `?${query}` : ''}`),

  issueRefund: (paymentId, { amount, reason, notes }) =>
    apiRequest(`/admin/payments/${paymentId}/refund`, {
      method: 'POST',
      body: { amount, reason, notes },
    }),

  getRefundsList: (query = '') =>
    apiRequest(`/admin/payments/refunds/list${query ? `?${query}` : ''}`),
};
