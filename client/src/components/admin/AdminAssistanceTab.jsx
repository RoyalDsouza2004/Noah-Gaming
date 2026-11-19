import React, { useState, useEffect, useCallback } from 'react';
import { adminAssistanceApi } from '../../api/adminAssistance.js';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  User,
  Phone,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  FileText,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  UserCheck,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';

export const AdminAssistanceTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' | 'history'

  // Pending Requests State
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');

  // Modal States
  const [approvalModalItem, setApprovalModalItem] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const [rejectionModalItem, setRejectionModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  // Fetch Pending Requests
  const fetchPendingRequests = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingPending(true);
      const params = {};
      if (typeFilter !== 'ALL') params.requestType = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await adminAssistanceApi.getAssistanceRequests(params);
      if (res?.success) {
        setPendingRequests(res.data || []);
      }
    } catch (err) {
      if (!silent) {
        console.error('Fetch Admin Assistance error:', err);
        showToast.error(err.message || 'Failed to fetch assistance requests');
      }
    } finally {
      if (!silent) setLoadingPending(false);
    }
  }, [typeFilter, statusFilter, searchQuery]);

  // Fetch History Logs
  const fetchHistoryLogs = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const params = {
        page: historyPage,
        limit: 15,
      };
      if (historyTypeFilter !== 'ALL') params.requestType = historyTypeFilter;
      if (historySearch.trim()) params.search = historySearch.trim();

      const res = await adminAssistanceApi.getHistory(params);
      if (res?.success) {
        setHistoryLogs(res.data || []);
        if (res.pagination) {
          setHistoryTotalPages(res.pagination.totalPages || 1);
          setHistoryTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error('Fetch assistance history error:', err);
      showToast.error(err.message || 'Failed to fetch history logs');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage, historyTypeFilter, historySearch]);

  // Auto-refresh interval (every 3 seconds)
  useEffect(() => {
    fetchPendingRequests();
    if (!autoRefresh || activeSubTab !== 'pending') return;

    const interval = setInterval(() => {
      fetchPendingRequests(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchPendingRequests, autoRefresh, activeSubTab]);

  // Fetch History on tab switch
  useEffect(() => {
    if (activeSubTab === 'history') {
      fetchHistoryLogs();
    }
  }, [activeSubTab, fetchHistoryLogs]);

  // Handle Approve Request
  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approvalModalItem || !adminPassword.trim()) {
      showToast.error('Please enter your administrator password to confirm approval.');
      return;
    }

    try {
      setSubmittingApproval(true);
      const res = await adminAssistanceApi.approveRequest(
        approvalModalItem.challengeId,
        adminPassword.trim(),
        adminNote.trim()
      );

      if (res?.success) {
        showToast.success(`Verification approved for ${approvalModalItem.userName}!`);
        setApprovalModalItem(null);
        setAdminPassword('');
        setAdminNote('');
        fetchPendingRequests();
      } else {
        showToast.error(res?.message || 'Failed to approve request');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to approve request');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Handle Reject Request
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionModalItem) return;

    try {
      setSubmittingRejection(true);
      const res = await adminAssistanceApi.rejectRequest(
        rejectionModalItem.challengeId,
        rejectionReason.trim()
      );

      if (res?.success) {
        showToast.success(`Request for ${rejectionModalItem.userName} has been rejected.`);
        setRejectionModalItem(null);
        setRejectionReason('');
        fetchPendingRequests();
      } else {
        showToast.error(res?.message || 'Failed to reject request');
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to reject request');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const pendingActiveCount = pendingRequests.filter(
    (r) => r.status === 'PENDING' && !r.isExpired
  ).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#171014] border border-[#49202C] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#851B2B] to-[#5A1828] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#851B2B]/40">
            <ShieldCheck className="w-6 h-6 text-[#D7FF00]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading text-white">
                Verification Assistance
              </h2>
              {pendingActiveCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black animate-pulse flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {pendingActiveCount} Awaiting Review
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dedicated portal for reviewing and approving customer registration & login verification requests.
            </p>
          </div>
        </div>

        {/* Subtab Toggle Buttons */}
        <div className="flex items-center gap-2 p-1 bg-[#260D17] border border-[#49202C] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-heading transition-all flex items-center gap-2 ${
              activeSubTab === 'pending'
                ? 'bg-[#851B2B] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#D7FF00]" />
            <span>Assistance Requests</span>
            {pendingActiveCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-mono font-bold">
                {pendingActiveCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-heading transition-all flex items-center gap-2 ${
              activeSubTab === 'history'
                ? 'bg-[#851B2B] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#D7FF00]" />
            <span>Assistance Audit History</span>
          </button>
        </div>
      </div>

      {/* ---------------- SUBTAB 1: PENDING ASSISTANCE REQUESTS ---------------- */}
      {activeSubTab === 'pending' && (
        <div className="space-y-5">
          {/* Summary Metric Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Awaiting Admin Review
                </p>
                <p className="text-2xl font-black font-heading text-amber-400 mt-0.5">
                  {pendingActiveCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Active Today
                </p>
                <p className="text-2xl font-black font-heading text-white mt-0.5">
                  {pendingRequests.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Live Stream Polling
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-emerald-400">3s Realtime Active</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchPendingRequests()}
                disabled={loadingPending}
                className="w-10 h-10 rounded-lg bg-[#260D17] border border-[#49202C] flex items-center justify-center text-[#D7FF00] hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPending ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#171014] border border-[#49202C] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Request Types</option>
                <option value="REGISTRATION">Registration Assistance</option>
                <option value="LOGIN_2FA">Login 2FA Assistance</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => fetchPendingRequests()}
              disabled={loadingPending}
              className="px-4 py-2 rounded-xl bg-[#260D17] hover:bg-[#380C19] text-[#D7FF00] text-xs font-bold border border-[#49202C] flex items-center gap-1.5 self-end md:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPending ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Pending Assistance Requests Table */}
          <div className="rounded-2xl bg-[#171014] border border-[#49202C] overflow-hidden shadow-lg">
            {loadingPending && pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D7FF00] mb-2" />
                <p className="text-xs">Loading Admin Assistance requests...</p>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-50" />
                <p className="text-sm font-bold text-white">No Pending Assistance Requests</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  When new customers click "Request Admin Assistance" during registration or login, their requests will appear here for staff verification.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#260D17] text-[11px] uppercase tracking-wider text-[#C7A5A8] border-b border-[#49202C]">
                    <tr>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Request Type</th>
                      <th className="py-3 px-4">Delivery Status</th>
                      <th className="py-3 px-4">Requested At</th>
                      <th className="py-3 px-4">Validity</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#49202C]/50 font-mono">
                    {pendingRequests.map((item) => (
                      <tr
                        key={item._id}
                        className={`hover:bg-[#260D17]/40 transition-colors ${
                          item.status === 'PENDING' && !item.isExpired
                            ? 'bg-amber-500/5'
                            : ''
                        }`}
                      >
                        {/* Customer Details */}
                        <td className="py-3.5 px-4 font-sans">
                          <p className="font-bold text-white text-xs flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {item.userName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{item.email}</p>
                          {item.phone && (
                            <p className="text-[10px] text-slate-500 font-mono">{item.phone}</p>
                          )}
                        </td>

                        {/* Request Type */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-sans uppercase tracking-wider ${
                              item.requestType === 'REGISTRATION'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {item.requestType === 'REGISTRATION'
                              ? 'Customer Registration'
                              : 'Login 2FA'}
                          </span>
                        </td>

                        {/* Delivery Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-sans uppercase tracking-wider ${
                              item.emailDeliveryStatus === 'FAILED'
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : item.emailDeliveryStatus === 'ACCEPTED'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.emailDeliveryStatus}
                          </span>
                        </td>

                        {/* Requested At */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>

                        {/* Validity Countdown */}
                        <td className="py-3.5 px-4">
                          {item.isExpired ? (
                            <span className="text-rose-400 font-bold text-[11px]">Expired</span>
                          ) : (
                            <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.remainingSeconds}s
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'APPROVED'
                                ? 'bg-emerald-500 text-black'
                                : item.status === 'REJECTED'
                                ? 'bg-rose-500 text-white'
                                : item.status === 'CONSUMED'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : item.status === 'EXPIRED'
                                ? 'bg-slate-800 text-slate-500'
                                : 'bg-amber-400 text-black animate-pulse'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            {item.canApprove && (
                              <button
                                type="button"
                                onClick={() => setApprovalModalItem(item)}
                                className="px-3 py-1.5 bg-[#851B2B] hover:bg-[#701529] active:bg-[#5E121E] text-white rounded-lg text-xs font-bold font-heading shadow-md transition-all flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                              </button>
                            )}

                            {item.canReject && (
                              <button
                                type="button"
                                onClick={() => setRejectionModalItem(item)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SUBTAB 2: ASSISTANCE AUDIT HISTORY ---------------- */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="p-4 rounded-2xl bg-[#171014] border border-[#49202C] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer email or name..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Types</option>
                <option value="REGISTRATION">Registration</option>
                <option value="LOGIN_2FA">Login 2FA</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => fetchHistoryLogs()}
              disabled={loadingHistory}
              className="px-4 py-2 rounded-xl bg-[#260D17] hover:bg-[#380C19] text-[#D7FF00] text-xs font-bold border border-[#49202C] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* History Table */}
          <div className="rounded-2xl bg-[#171014] border border-[#49202C] overflow-hidden shadow-lg">
            {loadingHistory ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D7FF00] mb-2" />
                <p className="text-xs">Loading audit history...</p>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-bold text-white">No Historical Audit Logs</p>
                <p className="text-xs text-slate-500 mt-1">
                  Approved, rejected, and consumed requests will be archived here permanently.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#260D17] text-[11px] uppercase tracking-wider text-[#C7A5A8] border-b border-[#49202C]">
                    <tr>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Decision</th>
                      <th className="py-3 px-4">Decided By</th>
                      <th className="py-3 px-4">Note / Reason</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#49202C]/50 font-mono text-xs">
                    {historyLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-[#260D17]/40 transition-colors">
                        <td className="py-3 px-4 font-sans">
                          <p className="font-bold text-white">{log.userName || log.userId?.name || 'Customer'}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{log.email}</p>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            {log.requestType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.status === 'APPROVED' || log.status === 'CONSUMED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : log.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">
                          {log.adminDecision?.adminName || 'Admin'}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-400 max-w-xs truncate">
                          {log.adminDecision?.reason || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {historyTotalPages > 1 && (
              <div className="p-4 border-t border-[#49202C]">
                <Pagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={setHistoryPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- APPROVAL CONFIRMATION MODAL ---------------- */}
      {approvalModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#171014] border border-[#851B2B] shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-[#49202C]">
              <div className="flex items-center gap-2 text-white">
                <ShieldCheck className="w-5 h-5 text-[#D7FF00]" />
                <h3 className="font-bold font-heading text-base">Approve Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#260D17] border border-[#49202C] rounded-xl text-xs space-y-1">
              <p className="text-slate-300">
                Customer: <strong className="text-white">{approvalModalItem.userName}</strong>
              </p>
              <p className="text-slate-400 font-mono">{approvalModalItem.email}</p>
              <p className="text-slate-400">
                Type: <strong className="text-[#D7FF00]">{approvalModalItem.requestType}</strong>
              </p>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Administrator Password *
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter your password to authorize"
                    className="w-full pl-3 pr-10 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-white text-xs focus:outline-none focus:border-[#851B2B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Required for audit security and re-authentication.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Optional Staff Note / Reason
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Identity verified at front desk"
                  className="w-full px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-white text-xs focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApproval || !adminPassword.trim()}
                  className="px-5 py-2 bg-[#851B2B] hover:bg-[#701529] active:bg-[#5E121E] text-white rounded-xl text-xs font-bold font-heading shadow-lg shadow-[#851B2B]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingApproval ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> Authorizing...
                    </>
                  ) : (
                    'Authorize & Approve'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- REJECTION MODAL ---------------- */}
      {rejectionModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#171014] border border-[#49202C] shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-[#49202C]">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold font-heading text-base text-white">Reject Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectionModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to reject the assistance request for{' '}
              <strong className="text-white">{rejectionModalItem.userName}</strong>?
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Reason for Rejection
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Identity cannot be verified"
                  className="w-full px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-white text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectionModalItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRejection}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold font-heading shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingRejection ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> Rejecting...
                    </>
                  ) : (
                    'Confirm Rejection'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
