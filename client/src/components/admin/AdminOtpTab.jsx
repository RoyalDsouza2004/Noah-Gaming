import React, { useState, useEffect, useCallback } from 'react';
import { adminOtpApi } from '../../api/adminOtp.js';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import {
  KeyRound,
  ShieldAlert,
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
} from 'lucide-react';

export const AdminOtpTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' | 'history'

  // Pending Requests State
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyResolutionFilter, setHistoryResolutionFilter] = useState('ALL');
  const [historyPurposeFilter, setHistoryPurposeFilter] = useState('ALL');

  // Modal States
  const [approvalModalItem, setApprovalModalItem] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const [rejectionModalItem, setRejectionModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  const [deliveryInspectItem, setDeliveryInspectItem] = useState(null);

  // Fetch Pending Requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      setLoadingPending(true);
      const params = {};
      if (purposeFilter !== 'ALL') params.purpose = purposeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (deliveryFilter !== 'ALL') params.deliveryStatus = deliveryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await adminOtpApi.getPendingRequests(params);
      if (res?.success) {
        setPendingRequests(res.data || []);
      }
    } catch (err) {
      console.error('Fetch pending OTP error:', err);
      showToast.error(err.message || 'Failed to fetch pending requests');
    } finally {
      setLoadingPending(false);
    }
  }, [purposeFilter, statusFilter, deliveryFilter, searchQuery]);

  // Fetch History Logs
  const fetchHistoryLogs = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const params = {
        page: historyPage,
        limit: 15,
      };
      if (historyResolutionFilter !== 'ALL') params.resolution = historyResolutionFilter;
      if (historyPurposeFilter !== 'ALL') params.purpose = historyPurposeFilter;
      if (historySearch.trim()) params.search = historySearch.trim();

      const res = await adminOtpApi.getHistory(params);
      if (res?.success) {
        setHistoryLogs(res.data || []);
        setHistoryTotalPages(res.pagination?.pages || 1);
        setHistoryTotalCount(res.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Fetch OTP history error:', err);
      showToast.error(err.message || 'Failed to fetch history logs');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage, historyResolutionFilter, historyPurposeFilter, historySearch]);

  // Initial fetch and auto-refresh interval for pending requests
  useEffect(() => {
    if (activeSubTab === 'pending') {
      fetchPendingRequests();
    } else {
      fetchHistoryLogs();
    }
  }, [activeSubTab, fetchPendingRequests, fetchHistoryLogs]);

  // 10s auto-refresh for pending requests
  useEffect(() => {
    if (!autoRefresh || activeSubTab !== 'pending') return;
    const interval = setInterval(() => {
      fetchPendingRequests();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeSubTab, fetchPendingRequests]);

  // Handle Approve Submit
  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approvalModalItem || !adminPassword.trim()) {
      showToast.error('Please enter your administrator password to confirm.');
      return;
    }

    try {
      setSubmittingApproval(true);
      const res = await adminOtpApi.approveRequest(
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
        showToast.error(res?.message || 'Approval failed');
      }
    } catch (err) {
      showToast.error(err.message || 'Approval failed');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Handle Reject Submit
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionModalItem) return;

    try {
      setSubmittingRejection(true);
      const res = await adminOtpApi.rejectRequest(
        rejectionModalItem.challengeId,
        rejectionReason.trim()
      );

      if (res?.success) {
        showToast.success(`Verification rejected for ${rejectionModalItem.userName}.`);
        setRejectionModalItem(null);
        setRejectionReason('');
        fetchPendingRequests();
      } else {
        showToast.error(res?.message || 'Rejection failed');
      }
    } catch (err) {
      showToast.error(err.message || 'Rejection failed');
    } finally {
      setSubmittingRejection(false);
    }
  };

  // Stats calculation
  const awaitingCount = pendingRequests.filter(
    (r) => r.status === 'AWAITING_ADMIN_ASSISTANCE' && !r.isExpired
  ).length;
  const deliveryFailedCount = pendingRequests.filter(
    (r) => r.emailDeliveryStatus === 'FAILED' || r.emailDeliveryStatus === 'NOT_CONFIGURED'
  ).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#171014] border border-[#49202C] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#851B2B] to-[#5A1828] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#851B2B]/40">
            <KeyRound className="w-6 h-6 text-[#D7FF00]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading text-white">
                OTP Management & Fallback
              </h2>
              {awaitingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black animate-pulse flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {awaitingCount} Awaiting Review
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure emergency identity approval for customer registration and login 2FA when email delivery is restricted.
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
            <span>Pending Requests</span>
            {awaitingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-mono font-bold">
                {awaitingCount}
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
            <span>Verification History</span>
          </button>
        </div>
      </div>

      {/* ---------------- SUBTAB 1: PENDING REQUESTS ---------------- */}
      {activeSubTab === 'pending' && (
        <div className="space-y-5">
          {/* Summary Metric Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Assistance Awaiting
                </p>
                <p className="text-2xl font-black font-heading text-amber-400 mt-0.5">
                  {awaitingCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Challenges
                </p>
                <p className="text-2xl font-black font-heading text-white mt-0.5">
                  {pendingRequests.filter((r) => !r.isExpired).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Email Delivery Issues
                </p>
                <p className="text-2xl font-black font-heading text-rose-400 mt-0.5">
                  {deliveryFailedCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Mail className="w-5 h-5" />
              </div>
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

              {/* Purpose Filter */}
              <select
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Challenge Types</option>
                <option value="REGISTRATION">Registration</option>
                <option value="LOGIN_2FA">Login 2FA</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="AWAITING_ADMIN_ASSISTANCE">Awaiting Assistance</option>
                <option value="PENDING">Pending (Customer Entry)</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>

              {/* Email Delivery Filter */}
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Deliveries</option>
                <option value="FAILED">Delivery Failed</option>
                <option value="NOT_CONFIGURED">Not Configured</option>
                <option value="ACCEPTED">Delivered / Accepted</option>
              </select>
            </div>

            {/* Refresh Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-[#49202C] text-[#851B2B] focus:ring-0"
                />
                <span>Auto-refresh</span>
              </label>

              <button
                type="button"
                onClick={fetchPendingRequests}
                disabled={loadingPending}
                className="p-2 rounded-xl bg-[#260D17] hover:bg-[#381322] border border-[#49202C] text-slate-300 hover:text-white transition-colors"
                title="Refresh Requests"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPending ? 'animate-spin text-[#D7FF00]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Pending Requests Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#49202C] bg-[#171014] shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#260D17] text-slate-400 uppercase text-[11px] font-semibold border-b border-[#49202C]">
                <tr>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Challenge Purpose</th>
                  <th className="py-3 px-4">Validity Timer</th>
                  <th className="py-3 px-4">Email Delivery</th>
                  <th className="py-3 px-4">Assistance Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#49202C]/50">
                {pendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      {loadingPending ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#D7FF00]" />
                          <span>Loading verification challenges...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-40" />
                          <p className="text-sm font-semibold text-slate-400">
                            No verification challenges found matching current filters.
                          </p>
                          <p className="text-xs text-slate-500">
                            Customer login or registration challenges will appear here in real-time.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  pendingRequests.map((record) => {
                    const isAwaiting =
                      record.status === 'AWAITING_ADMIN_ASSISTANCE' && !record.isExpired;
                    const hasDeliveryIssue =
                      record.emailDeliveryStatus === 'FAILED' ||
                      record.emailDeliveryStatus === 'NOT_CONFIGURED';

                    return (
                      <tr
                        key={record._id || record.challengeId}
                        className={`hover:bg-[#260D17]/50 transition-colors ${
                          isAwaiting ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Customer Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#260D17] border border-[#49202C] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{record.userName || 'Unnamed Gamer'}</span>
                                {record.user?.customerId && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    ({record.user.customerId})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {record.email}
                              </div>
                              {record.phone && (
                                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-500" /> {record.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Challenge Purpose */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono ${
                              record.purpose === 'REGISTRATION'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {record.purpose === 'REGISTRATION' ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            {record.purpose}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {new Date(record.createdAt).toLocaleTimeString()}
                          </div>
                        </td>

                        {/* Validity Timer */}
                        <td className="py-3.5 px-4">
                          {record.isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <Clock className="w-3 h-3 text-slate-500" /> Expired
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono font-bold text-xs ${
                                record.remainingSeconds <= 60
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {Math.floor(record.remainingSeconds / 60)}:
                              {(record.remainingSeconds % 60).toString().padStart(2, '0')}
                            </span>
                          )}
                          <div className="text-[10px] text-slate-500 mt-1">
                            Attempts: {record.attempts || 0} / {record.maxAttempts || 5}
                          </div>
                        </td>

                        {/* Email Delivery */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                record.emailDeliveryStatus === 'ACCEPTED' ||
                                record.emailDeliveryStatus === 'DELIVERED'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : record.emailDeliveryStatus === 'NOT_CONFIGURED'
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {record.emailDeliveryStatus}
                            </span>

                            {hasDeliveryIssue && (
                              <button
                                type="button"
                                onClick={() => setDeliveryInspectItem(record)}
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold inline-flex items-center gap-0.5"
                                title="Inspect delivery failure error"
                              >
                                Error &rarr;
                              </button>
                            )}
                          </div>
                          {record.emailDeliveryError && (
                            <p className="text-[10px] text-rose-400 line-clamp-1 max-w-[160px] mt-0.5">
                              {record.emailDeliveryError}
                            </p>
                          )}
                        </td>

                        {/* Assistance Status */}
                        <td className="py-3.5 px-4">
                          {isAwaiting ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              Awaiting Approval
                            </span>
                          ) : record.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                            </span>
                          ) : record.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30">
                              <XCircle className="w-3.5 h-3.5" /> Rejected
                            </span>
                          ) : record.status === 'CONSUMED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-slate-400 bg-slate-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">
                              Normal Code Entry
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {record.canApprove && (
                              <button
                                type="button"
                                onClick={() => {
                                  setApprovalModalItem(record);
                                  setAdminPassword('');
                                  setAdminNote('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold text-xs transition-all shadow-md flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                <span>Approve</span>
                              </button>
                            )}

                            {record.canReject && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectionModalItem(record);
                                  setRejectionReason('');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs transition-all flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            )}

                            {!record.canApprove && !record.canReject && (
                              <span className="text-[11px] text-slate-500 font-mono italic">
                                Resolved
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- SUBTAB 2: VERIFICATION HISTORY ---------------- */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="p-4 rounded-2xl bg-[#171014] border border-[#49202C] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by customer, phone, admin, note..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <select
                value={historyResolutionFilter}
                onChange={(e) => {
                  setHistoryResolutionFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Resolutions</option>
                <option value="ADMIN_APPROVED">Admin Approved</option>
                <option value="EMAIL_OTP_VERIFIED">Email OTP Verified</option>
                <option value="ADMIN_REJECTED">Admin Rejected</option>
                <option value="EXPIRED_UNUSED">Expired</option>
              </select>

              <select
                value={historyPurposeFilter}
                onChange={(e) => {
                  setHistoryPurposeFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white focus:outline-none focus:border-[#851B2B]"
              >
                <option value="ALL">All Purposes</option>
                <option value="REGISTRATION">Registration</option>
                <option value="LOGIN_2FA">Login 2FA</option>
              </select>
            </div>

            <button
              type="button"
              onClick={fetchHistoryLogs}
              disabled={loadingHistory}
              className="p-2 rounded-xl bg-[#260D17] hover:bg-[#381322] border border-[#49202C] text-slate-300 hover:text-white transition-colors shrink-0"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin text-[#D7FF00]' : ''}`} />
            </button>
          </div>

          {/* History Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#49202C] bg-[#171014] shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#260D17] text-slate-400 uppercase text-[11px] font-semibold border-b border-[#49202C]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Resolution</th>
                  <th className="py-3 px-4">Admin Decision</th>
                  <th className="py-3 px-4">Notes / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#49202C]/50">
                {historyLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      {loadingHistory ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#D7FF00]" />
                          <span>Loading verification history...</span>
                        </div>
                      ) : (
                        <p className="text-sm">No historical verification logs found.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  historyLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-[#260D17]/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{log.userName || 'Gamer'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{log.email}</div>
                        {log.phone && (
                          <div className="text-[10px] text-slate-500 font-mono">{log.phone}</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-[11px] text-slate-300">
                          {log.purpose}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            log.resolution === 'ADMIN_APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : log.resolution === 'EMAIL_OTP_VERIFIED'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : log.resolution === 'ADMIN_REJECTED'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {log.resolution === 'ADMIN_APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                          {log.resolution === 'ADMIN_REJECTED' && <XCircle className="w-3 h-3" />}
                          {log.resolution}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {log.adminName ? (
                          <div>
                            <span className="font-bold text-white text-[11px]">
                              {log.adminName}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {log.decisionTimestamp
                                ? new Date(log.decisionTimestamp).toLocaleTimeString()
                                : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Self-Verified</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-[11px] text-slate-300 max-w-xs leading-relaxed">
                          {log.note || '—'}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* History Pagination */}
          {historyTotalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                onPageChange={(p) => setHistoryPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* ---------------- MODAL 1: APPROVAL CONFIRMATION & ADMIN PASSWORD RE-AUTH ---------------- */}
      {approvalModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-[#171014] border border-[#49202C] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#49202C]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-white">
                    Approve Verification Request
                  </h3>
                  <p className="text-xs text-slate-400">
                    Administrator authorization required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalItem(null)}
                className="p-1 rounded-lg hover:bg-[#260D17] text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            {/* Explanation Warning */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Important:</strong> Approving this request allows the customer to complete verification immediately without entering an email OTP code. Verify their identity beforehand.
              </div>
            </div>

            {/* Customer Details Summary */}
            <div className="p-3.5 rounded-xl bg-[#260D17] border border-[#49202C] text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer Name:</span>
                <span className="text-white font-bold">{approvalModalItem.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email Address:</span>
                <span className="text-white">{approvalModalItem.email}</span>
              </div>
              {approvalModalItem.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile Number:</span>
                  <span className="text-white">{approvalModalItem.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Challenge Purpose:</span>
                <span className="text-[#D7FF00] font-bold">{approvalModalItem.purpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email Delivery:</span>
                <span
                  className={
                    approvalModalItem.emailDeliveryStatus === 'ACCEPTED'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  {approvalModalItem.emailDeliveryStatus}
                </span>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              {/* Admin Password (Required) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Confirm Administrator Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your admin password to authorize"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Admin Note / Reason */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Verification Note / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Identity verified via phone or in-person at counter"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full px-3 py-2 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalItem(null)}
                  disabled={submittingApproval}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApproval || !adminPassword.trim()}
                  className="px-5 py-2 rounded-xl bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold text-xs transition-all shadow-md font-heading flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingApproval ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Authorizing...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Approve Identity Verification
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: REJECTION DIALOG ---------------- */}
      {rejectionModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#171014] border border-[#49202C] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#49202C]">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold font-heading text-white">
                  Reject Verification Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectionModalItem(null)}
                className="p-1 rounded-lg hover:bg-[#260D17] text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Rejecting verification for <span className="font-bold text-white">{rejectionModalItem.userName}</span> ({rejectionModalItem.email}). The customer will be notified and will need to request a new verification challenge.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Rejection Reason
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Identity could not be confirmed, or request not recognized."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 bg-[#260D17] border border-[#49202C] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectionModalItem(null)}
                  disabled={submittingRejection}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRejection}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md font-heading flex items-center gap-1.5"
                >
                  {submittingRejection ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" /> Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: EMAIL DELIVERY INSPECTION ---------------- */}
      {deliveryInspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-[#171014] border border-[#49202C] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#49202C]">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold font-heading text-white">
                  Email Delivery Diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryInspectItem(null)}
                className="p-1 rounded-lg hover:bg-[#260D17] text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#260D17] border border-[#49202C] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Email:</span>
                  <span className="text-white font-bold">{deliveryInspectItem.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Challenge Purpose:</span>
                  <span className="text-[#D7FF00]">{deliveryInspectItem.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Delivery Status:</span>
                  <span className="text-rose-400 font-bold">
                    {deliveryInspectItem.emailDeliveryStatus}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Reported Error Reason
                </label>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 font-mono text-xs leading-relaxed">
                  {deliveryInspectItem.emailDeliveryError ||
                    'Email service credentials not configured or domain unverified on Resend provider.'}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Because email delivery failed, the customer is prompted on their screen to request Admin Assistance. You can approve their request directly using the <strong>Approve</strong> button.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeliveryInspectItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
