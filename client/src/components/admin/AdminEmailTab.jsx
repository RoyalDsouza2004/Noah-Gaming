import React, { useState, useEffect } from 'react';
import { emailApi } from '../../api/email.js';
import { showToast } from '../../utils/toast.js';
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Paperclip,
  RotateCcw,
  Key,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const AdminEmailTab = () => {
  const [statusData, setStatusData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 15,
  });

  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await emailApi.getEmailStatus();
      if (res?.success) {
        setStatusData(res.data);
      }
    } catch (err) {
      console.error('Failed to load email status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const query = new URLSearchParams({
        page: String(page),
        limit: '15',
        status: statusFilter,
        emailType: typeFilter,
        search: search.trim(),
      }).toString();

      const res = await emailApi.getEmailLogs(query);
      if (res?.success) {
        setLogs(res.data.logs || []);
        setPagination(res.data.pagination || {});
      }
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail || !testEmail.trim()) {
      showToast.error('Please enter a recipient email address');
      return;
    }

    try {
      setSendingTest(true);
      const res = await emailApi.sendTestEmail(testEmail.trim());
      if (res?.success) {
        showToast.success(`Test email dispatched successfully to ${testEmail}!`);
        setTestModalOpen(false);
        setTestEmail('');
        fetchStatus();
        fetchLogs();
      } else {
        showToast.error(res?.message || 'Failed to dispatch test email');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to dispatch test email');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRetry = async (logId) => {
    try {
      setRetryingId(logId);
      const res = await emailApi.retryEmail(logId);
      if (res?.success) {
        showToast.success('Email retry successfully queued!');
        fetchStatus();
        fetchLogs();
      } else {
        showToast.error(res?.message || 'Failed to retry email');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to retry email');
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACCEPTED':
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            {status}
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            UNCONFIGURED
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            FAILED
          </span>
        );
      case 'QUEUED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
    }
  };

  const formatEmailType = (type) => {
    if (!type) return 'Transactional';
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isConfigured = statusData?.isConfigured;

  return (
    <div className="space-y-6">
      {/* Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#260D17] border border-[#49202C]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#851B2B] to-[#D7FF00]/20 flex items-center justify-center border border-[#851B2B]/40 text-[#D7FF00] shadow-lg shadow-[#851B2B]/30">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black font-heading text-[#FFF4E8] tracking-wide">
                Transactional Email Service
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#171014] text-[#D7FF00] border border-[#49202C]">
                Resend SDK v2
              </span>
            </div>
            <p className="text-xs text-[#C7A5A8] mt-0.5">
              Automated notifications, PDF receipts, booking confirmations, pass renewals & password recovery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchStatus();
              fetchLogs();
            }}
            disabled={loading || logsLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#171014] hover:bg-[#331521] text-xs font-semibold text-[#FFF4E8] border border-[#49202C] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || logsLoading ? 'animate-spin text-[#D7FF00]' : 'text-[#C7A5A8]'}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] text-xs font-bold uppercase tracking-wider font-heading transition-all shadow-md shadow-[#D7FF00]/20"
          >
            <Send className="w-3.5 h-3.5" />
            Send Test Email
          </button>
        </div>
      </div>

      {/* Integration Status Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isConfigured
            ? 'bg-emerald-950/20 border-emerald-500/30'
            : 'bg-amber-950/20 border-amber-500/30'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isConfigured
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {isConfigured ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#FFF4E8]">
                  {isConfigured ? 'Resend Service Configured & Operational' : 'Resend Service Unconfigured'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isConfigured
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {isConfigured ? 'Active' : 'Missing Credentials'}
                </span>
              </div>
              <p className="text-xs text-[#C7A5A8] leading-relaxed">
                {isConfigured
                  ? `Authenticated with Resend. Outgoing sender address: ${statusData?.senderEmail || 'Default'}. Secret keys are safely contained in backend environment variables.`
                  : 'Backend environment variables RESEND_API_KEY and EMAIL_FROM are currently empty in server/.env. All core booking, membership, and payment functions continue operating safely without interruption.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0 text-right sm:border-l sm:border-[#49202C] sm:pl-4">
            <span className="text-[11px] font-mono text-[#A38084]">Sender Identity</span>
            <span className="text-xs font-mono font-semibold text-[#FFF4E8] bg-[#171014] px-2.5 py-1 rounded border border-[#49202C]">
              {statusData?.senderEmail || 'Not configured'}
            </span>
            {statusData?.replyToEmail && (
              <span className="text-[10px] font-mono text-[#A38084]">
                Reply-To: {statusData.replyToEmail}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#260D17] border border-[#49202C]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#A38084]">Total Logs</span>
          <div className="text-2xl font-black font-heading text-[#FFF4E8] mt-1">
            {statusData?.stats?.totalEmails || 0}
          </div>
          <span className="text-[10px] text-[#C7A5A8] mt-0.5 block">Dispatched or queued</span>
        </div>

        <div className="p-4 rounded-xl bg-[#260D17] border border-[#49202C]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Accepted / Sent</span>
          <div className="text-2xl font-black font-heading text-emerald-400 mt-1">
            {statusData?.stats?.accepted || 0}
          </div>
          <span className="text-[10px] text-[#C7A5A8] mt-0.5 block">Delivered by Resend</span>
        </div>

        <div className="p-4 rounded-xl bg-[#260D17] border border-[#49202C]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Unconfigured Skips</span>
          <div className="text-2xl font-black font-heading text-amber-400 mt-1">
            {statusData?.stats?.unconfiguredSkipped || 0}
          </div>
          <span className="text-[10px] text-[#C7A5A8] mt-0.5 block">Saved while keys empty</span>
        </div>

        <div className="p-4 rounded-xl bg-[#260D17] border border-[#49202C]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Failed / Errors</span>
          <div className="text-2xl font-black font-heading text-rose-400 mt-1">
            {statusData?.stats?.failed || 0}
          </div>
          <span className="text-[10px] text-[#C7A5A8] mt-0.5 block">Requires retry or fix</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#260D17] border border-[#49202C] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A38084]" />
          <input
            type="text"
            placeholder="Search by recipient email or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#171014] border border-[#49202C] rounded-lg text-xs text-[#FFF4E8] placeholder-[#A38084] focus:outline-none focus:border-[#851B2B]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-[#171014] border border-[#49202C] rounded-lg text-xs text-[#FFF4E8] focus:outline-none focus:border-[#851B2B]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-[#171014] border border-[#49202C] rounded-lg text-xs text-[#FFF4E8] focus:outline-none focus:border-[#851B2B]"
          >
            <option value="ALL">All Email Types</option>
            <option value="REGISTRATION_WELCOME">Registration Welcome</option>
            <option value="BOOKING_CONFIRMATION">Booking Confirmation</option>
            <option value="BOOKING_CANCELLATION">Booking Cancellation</option>
            <option value="PAYMENT_CONFIRMATION">Payment & Receipt PDF</option>
            <option value="MEMBERSHIP_ACTIVATION">Membership Activation</option>
            <option value="MEMBERSHIP_EXPIRY_REMINDER">Membership Expiry Reminder</option>
            <option value="PASSWORD_RESET">Password Reset Request</option>
            <option value="PASSWORD_RESET_CONFIRMATION">Password Reset Confirmation</option>
            <option value="SYSTEM_NOTIFICATION">System / Test</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#49202C] bg-[#171014] shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#260D17] text-[#C7A5A8] uppercase text-[11px] font-semibold border-b border-[#49202C]">
            <tr>
              <th className="py-3 px-4">Timestamp (IST)</th>
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Email Type</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Attachment</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#331521]">
            {logsLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#A38084]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#D7FF00] mb-2" />
                  Loading email activity logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#A38084]">
                  No email logs found matching the selected filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} className="hover:bg-[#260D17]/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-[#A38084] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#FFF4E8] font-medium">
                    {log.recipient}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#260D17] text-[#D7FF00] border border-[#49202C]">
                      {formatEmailType(log.emailType)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#C7A5A8] max-w-xs truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="py-3 px-4 text-[#A38084]">
                    {log.hasAttachment ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-mono">
                        <Paperclip className="w-3 h-3" />
                        PDF Receipt
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#6B5054]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                  <td className="py-3 px-4 text-right">
                    {log.status === 'FAILED' || log.status === 'NOT_CONFIGURED' ? (
                      <button
                        type="button"
                        onClick={() => handleRetry(log._id)}
                        disabled={retryingId === log._id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#851B2B]/20 hover:bg-[#851B2B]/40 text-[#F06A76] hover:text-[#FFF4E8] border border-[#851B2B]/30 text-[11px] font-semibold transition-colors"
                      >
                        <RotateCcw className={`w-3 h-3 ${retryingId === log._id ? 'animate-spin' : ''}`} />
                        Retry
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#A38084] font-mono">
                        {log.resendEmailId ? log.resendEmailId.slice(0, 10) + '...' : 'OK'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#260D17] border border-[#49202C] text-xs text-[#C7A5A8]">
          <span>
            Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total entries)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-[#171014] border border-[#49202C] disabled:opacity-40 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold text-[#FFF4E8]">{pagination.currentPage}</span>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-[#171014] border border-[#49202C] disabled:opacity-40 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Send Test Email Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#260D17] border border-[#49202C] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#49202C]">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-[#D7FF00]" />
                <h3 className="text-base font-bold font-heading text-[#FFF4E8]">
                  Send Test Verification Email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-[#A38084] hover:text-[#FFF4E8]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#C7A5A8] leading-relaxed">
              Dispatch an instant branded verification email to any address to confirm that Resend credentials and NOAH GAMING email layouts are operating correctly.
            </p>

            <form onSubmit={handleSendTest} className="space-y-4 pt-1">
              <div>
                <label className="block text-[11px] font-mono text-[#A38084] uppercase tracking-wider mb-1.5">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#171014] border border-[#49202C] rounded-xl text-xs text-[#FFF4E8] placeholder-[#6B5054] focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#171014] hover:bg-[#331521] text-xs font-semibold text-[#C7A5A8] border border-[#49202C] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] text-xs font-bold uppercase tracking-wider font-heading transition-all shadow-md shadow-[#D7FF00]/20 disabled:opacity-50"
                >
                  {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingTest ? 'Sending...' : 'Dispatch Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
