import { apiRequest, API_BASE_URL, getAuthToken } from './client.js';

export const reportsApi = {
  /**
   * Fetches report data in JSON format
   */
  getReportJSON: async (reportType, params = {}) => {
    const query = new URLSearchParams({ ...params, format: 'json' }).toString();
    return apiRequest(`/admin/reports/${reportType}?${query}`);
  },

  /**
   * Downloads report in XLSX (ExcelJS), PDF (PDFKit), CSV, or HTML format
   */
  downloadReport: async (reportType, format = 'xlsx', params = {}) => {
    const token = getAuthToken();
    const queryParams = { ...params, format };
    if (token) queryParams.token = token;
    const query = new URLSearchParams(queryParams).toString();
    const url = `${API_BASE_URL}/admin/reports/${reportType}?${query}`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const contentType = res.headers.get('content-type') || '';
      let errMsg = 'Report download failed.';
      if (contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        errMsg = err.message || errMsg;
      } else {
        const text = await res.text().catch(() => '');
        const isHtml = /<html|<!doctype/i.test(text);
        errMsg = isHtml ? `Server returned HTTP ${res.status} error` : text || errMsg;
      }
      throw new Error(errMsg);
    }

    // Determine MIME type
    let mimeType = 'text/csv; charset=utf-8';
    let defaultExt = 'csv';
    if (format === 'xlsx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      defaultExt = 'xlsx';
    } else if (format === 'pdf') {
      mimeType = 'application/pdf';
      defaultExt = 'pdf';
    } else if (format === 'html') {
      mimeType = 'text/html; charset=utf-8';
      defaultExt = 'html';
    }

    const blob = await res.blob();
    const fileBlob = new Blob([blob], { type: mimeType });

    // Extract filename from Content-Disposition header if available
    let fileName = `NOAH_GAMING_${reportType}_${Date.now()}.${defaultExt}`;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    // Trigger browser download
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
};
