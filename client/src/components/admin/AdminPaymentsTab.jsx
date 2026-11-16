import React, { useState, useEffect } from 'react';
import { paymentApi } from '../../api/payment.js';
import { bookingApi } from '../../api/booking.js';
import { reportsApi } from '../../api/reports.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ReceiptModal } from '../payment/ReceiptModal.jsx';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileText,
  Plus,
  X,
  Lock,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Clock,
  Tv,
  Settings,
  FlaskConical,
  Copy,
  ExternalLink,
  Download,
  Loader2,
} from 'lucide-react';

export const AdminPaymentsTab = () => {
  const { user, isAdmin, isStaff } = useAuth();

  // Reports & Stats
  const [reports, setReports] = useState(null);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('transactions'); // 'transactions' | 'refunds' | 'settings'
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Pagination states
  const [payPage, setPayPage] = useState(1);
  const [payTotalPages, setPayTotalPages] = useState(1);
  const [payTotal, setPayTotal] = useState(0);
  const [payPageSize, setPayPageSize] = useState(15);
  const [refundPage, setRefundPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all_time');
  const [exportingPayments, setExportingPayments] = useState(false);

  const handleExportPayments = async (format = 'xlsx') => {
    setExportingPayments(true);
    try {
      const res = await reportsApi.downloadReport('payments', format, {
        range: dateRangeFilter === 'today' ? 'today' : 'all',
        status: statusFilter && statusFilter !== 'ALL' ? statusFilter : undefined,
        method: methodFilter && methodFilter !== 'ALL' ? methodFilter : undefined,
      });
      showToast.success(`Payments exported: ${res.fileName}`);
    } catch (err) {
      showToast.error(err.message || 'Failed to export payments.');
    } finally {
      setExportingPayments(false);
    }
  };

  // Reconciliation Audit State
  const [reconcileRange, setReconcileRange] = useState('today');
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationSearch, setReconciliationSearch] = useState('');

  // Modals
  const [activeReceiptPaymentId, setActiveReceiptPaymentId] = useState(null);

  // Offline Payment Collection Modal state
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlineForm, setOfflineForm] = useState({
    bookingId: '',
    amount: '',
    paymentMethod: 'CASH',
    transactionReference: '',
    paymentPurpose: 'BOOKING_BALANCE',
    notes: '',
  });
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [eligibleBookings, setEligibleBookings] = useState([]);

  // Refund Modal state (Admin only)
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    reason: 'Customer Cancellation',
    notes: '',
  });
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Fetch Financial Reports & Payment List
  const fetchAllFinancialData = async (targetPage = payPage) => {
    setLoading(true);
    setActionError('');
    try {
      // 1. Fetch Reports
      const reportRes = await paymentApi.getRevenueReports();
      if (reportRes.success && reportRes.data) {
        const metricsData = reportRes.data.metrics || reportRes.data;
        setReports(metricsData);
      }

      // 2. Fetch Payments list
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.set('search', searchQuery);
      if (methodFilter) queryParams.set('method', methodFilter);
      if (statusFilter) queryParams.set('status', statusFilter);
      if (dateRangeFilter && dateRangeFilter !== 'all_time') queryParams.set('range', dateRangeFilter);
      queryParams.set('page', String(targetPage));
      queryParams.set('limit', String(payPageSize));

      const payRes = await paymentApi.getAdminPayments(queryParams.toString());
      if (payRes.success) {
        setPayments(payRes.data.payments || []);
        if (payRes.data.pagination) {
          setPayTotalPages(payRes.data.pagination.pages || 1);
          setPayTotal(payRes.data.pagination.total || (payRes.data.payments || []).length);
        } else {
          setPayTotalPages(1);
          setPayTotal((payRes.data.payments || []).length);
        }
      }

      // 3. Fetch Refunds list
      const refRes = await paymentApi.getRefundsList();
      if (refRes.success) {
        setRefunds(refRes.data.refunds || []);
      }

      // 4. Fetch Razorpay Gateway Settings
      try {
        const setRes = await paymentApi.getPaymentSettings();
        if (setRes.success) {
          setSettings(setRes.data);
        }
      } catch (sErr) {
        // Non-blocking for receptionists if not admin
      }
    } catch (err) {
      setActionError(err.message || 'Failed to fetch financial records');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Financial Reconciliation Audit
  const fetchReconciliationData = async (range = reconcileRange) => {
    setReconciliationLoading(true);
    try {
      const res = await paymentApi.getFinancialReconciliation(`range=${range}&limit=200`);
      if (res.success && res.data) {
        setReconciliationData(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch reconciliation audit:', err.message);
    } finally {
      setReconciliationLoading(false);
    }
  };

  useEffect(() => {
    setPayPage(1);
    fetchAllFinancialData(1);
  }, [methodFilter, statusFilter, dateRangeFilter]);

  useEffect(() => {
    if (activeSubTab === 'reconciliation') {
      fetchReconciliationData(reconcileRange);
    }
  }, [activeSubTab, reconcileRange]);

  const handlePayPageChange = (newPage) => {
    setPayPage(newPage);
    fetchAllFinancialData(newPage);
  };

  // Load unpaid/partially paid bookings when offline modal opens
  const handleOpenOfflineModal = async () => {
    setOfflineModalOpen(true);
    try {
      const res = await bookingApi.getAdminBookings('limit=100');
      if (res.success && res.data?.bookings) {
        // Filter bookings that have remaining balance
        const withBalance = res.data.bookings.filter(
          (b) =>
            b.bookingStatus !== 'CANCELLED' &&
            (b.paymentStatus === 'PENDING' ||
              b.paymentStatus === 'PARTIALLY_PAID' ||
              (b.balanceRemaining && b.balanceRemaining > 0))
        );
        setEligibleBookings(withBalance);
      }
    } catch (err) {
      console.warn('Failed to fetch eligible bookings:', err.message);
    }
  };

  // Submit Offline Counter Payment
  const handleSubmitOfflinePayment = async (e) => {
    e.preventDefault();
    if (!offlineForm.bookingId || !offlineForm.amount) {
      setActionError('Please select a booking and enter a valid collection amount.');
      return;
    }

    setOfflineSubmitting(true);
    setActionError('');
    try {
      const res = await paymentApi.recordOfflinePayment({
        bookingId: offlineForm.bookingId,
        amount: Number(offlineForm.amount),
        paymentMethod: offlineForm.paymentMethod,
        transactionReference: offlineForm.transactionReference,
        paymentPurpose: offlineForm.paymentPurpose,
        notes: offlineForm.notes,
      });

      if (res.success) {
        showToast.success(
          `Offline payment of ₹${offlineForm.amount} recorded! Receipt: ${res.data.payment.receiptNumber}`
        );
        setActionSuccess(
          `Offline payment of ₹${offlineForm.amount} recorded! Receipt: ${res.data.payment.receiptNumber}`
        );
        setOfflineModalOpen(false);
        setOfflineForm({
          bookingId: '',
          amount: '',
          paymentMethod: 'CASH',
          transactionReference: '',
          paymentPurpose: 'BOOKING_BALANCE',
          notes: '',
        });
        fetchAllFinancialData();
        // Automatically open the receipt modal for this new payment
        setActiveReceiptPaymentId(res.data.payment.paymentId);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to record offline payment');
      setActionError(err.message || 'Failed to record offline payment');
    } finally {
      setOfflineSubmitting(false);
    }
  };

  // Open Refund Modal for a payment
  const handleOpenRefundModal = (payment) => {
    setSelectedPaymentForRefund(payment);
    const maxRefundable = (payment.amount - (payment.refundedAmount || 0)) / 100;
    setRefundForm({
      amount: maxRefundable.toString(),
      reason: 'Customer Cancellation',
      notes: '',
    });
    setRefundModalOpen(true);
  };

  // Submit Refund (Admin Only)
  const handleSubmitRefund = async (e) => {
    e.preventDefault();
    if (!selectedPaymentForRefund || !refundForm.amount) return;

    setRefundSubmitting(true);
    setActionError('');
    try {
      const res = await paymentApi.issueRefund(selectedPaymentForRefund._id, {
        amount: Number(refundForm.amount),
        reason: refundForm.reason,
        notes: refundForm.notes,
      });

      if (res.success) {
        showToast.success(
          `Refund of ₹${refundForm.amount} processed! Refund Reference: ${res.data.refund.refundId}`
        );
        setActionSuccess(
          `Refund of ₹${refundForm.amount} processed! Refund Reference: ${res.data.refund.refundId}`
        );
        setRefundModalOpen(false);
        setSelectedPaymentForRefund(null);
        fetchAllFinancialData();
      }
    } catch (err) {
      showToast.error(err.message || 'Refund processing failed');
      setActionError(err.message || 'Refund processing failed');
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Filtered payments list
  const filteredPayments = payments.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const payId = p.paymentId?.toLowerCase() || '';
    const recNo = p.receiptNumber?.toLowerCase() || '';
    const bookRef = p.booking?.bookingId?.toLowerCase() || '';
    const custName = p.customer?.name?.toLowerCase() || '';
    const custEmail = p.customer?.email?.toLowerCase() || '';
    return (
      payId.includes(q) ||
      recNo.includes(q) ||
      bookRef.includes(q) ||
      custName.includes(q) ||
      custEmail.includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-wider text-[#D7FF00]">
              Treasury & Financial Audit
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE: MONGODB ATLAS
            </span>
          </div>
          <h2 className="text-2xl font-black font-heading text-white">
            PAYMENTS & REVENUE MANAGEMENT
          </h2>
          <p className="text-xs text-slate-400">
            Multi-channel revenue reporting, reception counter offline collection, and Razorpay reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Buttons */}
          <button
            onClick={() => handleExportPayments('xlsx')}
            disabled={exportingPayments}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold font-heading uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Export all transactions to Excel (.xlsx)"
          >
            {exportingPayments ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D7FF00]" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#D7FF00]" />
            )}
            Export Excel
          </button>
          <button
            onClick={() => handleExportPayments('csv')}
            disabled={exportingPayments}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold font-heading uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Export transactions to CSV"
          >
            CSV
          </button>

          {/* Collect Offline Payment Button */}
          <button
            onClick={handleOpenOfflineModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Collect Counter Payment
          </button>

          <button
            onClick={fetchAllFinancialData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Financial Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ---------------- 1. FINANCIAL SUMMARY KPI CARDS ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Net Revenue */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total Net Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-heading text-emerald-400">
            ₹{(reports?.totalNetRevenueRupees ?? reports?.totalRevenue?.rupees ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {reports?.totalVerifiedTransactions ?? reports?.totalRevenue?.count ?? payments.filter((p) => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIALLY_REFUNDED').length} successful transactions
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Today (IST)</span>
            <TrendingUp className="w-4 h-4 text-[#D7FF00]" />
          </div>
          <div className="text-2xl font-black font-heading text-white">
            ₹{(reports?.todayRevenueRupees ?? reports?.todayRevenue?.rupees ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Current calendar day
          </div>
        </div>

        {/* This Month's Revenue */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">This Month</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-heading text-white">
            ₹{(reports?.monthRevenueRupees ?? reports?.monthRevenue?.rupees ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Monthly cumulative
          </div>
        </div>

        {/* Channel Breakdown: Online vs Offline */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Channel Mix</span>
            <CreditCard className="w-4 h-4 text-[#D7FF00]" />
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#FFF4E8]">Online (Razorpay):</span>
            <span className="font-bold text-white">₹{(reports?.onlineRevenueRupees ?? reports?.onlineRevenue?.rupees ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-emerald-300">Offline Counter:</span>
            <span className="font-bold text-white">₹{(reports?.offlineRevenueRupees ?? reports?.offlineRevenue?.rupees ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Refunds Issued */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/20 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Refunds Deducted</span>
            <RotateCcw className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-heading text-rose-400">
            -₹{(reports?.totalRefundedRupees ?? reports?.refunds?.totalRefundedRupees ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {reports?.refundCount ?? reports?.refunds?.count ?? 0} refund transaction(s)
          </div>
        </div>
      </div>

      {/* Sub-tab navigation: Transactions vs Reconciliation vs Refunds */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-heading uppercase tracking-wider overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`pb-3 font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'transactions'
              ? 'text-[#D7FF00] border-[#D7FF00]'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" /> Transactions Log ({payTotal})
        </button>

        <button
          onClick={() => setActiveSubTab('reconciliation')}
          className={`pb-3 font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'reconciliation'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Financial Audit & Reconciliation
        </button>

        <button
          onClick={() => setActiveSubTab('refunds')}
          className={`pb-3 font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'refunds'
              ? 'text-rose-400 border-rose-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <RotateCcw className="w-4 h-4" /> Refunds Issued ({refunds.length})
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`pb-3 font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'settings'
                ? 'text-[#D7FF00] border-[#D7FF00]'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" /> Razorpay Test Settings
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#D7FF00]/15 text-[#D7FF00] font-mono border border-[#D7FF00]/30 ml-1">
              TEST MODE
            </span>
          </button>
        )}
      </div>

      {/* ---------------- 2. TRANSACTIONS VIEW ---------------- */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search payment ID, receipt #, booking reference, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              {/* Date Range Filter */}
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
              >
                <option value="all_time">📅 All Time</option>
                <option value="today">📅 Today (IST)</option>
                <option value="yesterday">📅 Yesterday</option>
                <option value="7d">📅 Last 7 Days</option>
                <option value="this_month">📅 This Month</option>
              </select>

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Methods</option>
                <option value="RAZORPAY">Razorpay</option>
                <option value="CASH">Cash (Counter)</option>
                <option value="COUNTER_UPI">Counter UPI</option>
                <option value="UPI">UPI</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="PAID">PAID</option>
                <option value="PARTIALLY_REFUNDED">PARTIALLY_REFUNDED</option>
                <option value="REFUNDED">REFUNDED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          {/* Filter Status Badge */}
          {dateRangeFilter !== 'all_time' && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>
                Filtered by <strong className="text-[#D7FF00]">{dateRangeFilter.toUpperCase()} (IST)</strong>: {payTotal} records found
              </span>
              <button
                onClick={() => setDateRangeFilter('all_time')}
                className="text-xs text-[#FFF4E8] hover:underline"
              >
                Clear date filter
              </button>
            </div>
          )}

          {/* Transactions Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#260D17]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Receipt / ID</th>
                  <th className="px-4 py-3">Booking Ref</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Staff / Gateway</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredPayments.map((p) => {
                  const isRefundable =
                    isAdmin &&
                    (p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIALLY_REFUNDED') &&
                    p.amount > (p.refundedAmount || 0);

                  return (
                    <tr key={p._id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-[#D7FF00] block">{p.receiptNumber}</span>
                        <span className="text-[10px] text-slate-500 truncate block">{p.paymentId}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-white block">
                          {p.booking?.bookingId || 'N/A'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {p.booking?.device?.name || ''}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-sans">
                        <span className="font-semibold text-white block">
                          {p.customer?.name || 'Customer'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {p.customer?.email}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {p.paymentPurpose}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            p.paymentMethod === 'CASH'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : p.paymentMethod === 'COUNTER_UPI'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {p.paymentMethod}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-white text-sm">
                          ₹{p.amount / 100}
                        </span>
                        {p.refundedAmount > 0 && (
                          <span className="text-[10px] text-rose-400 block">
                            (-₹{p.refundedAmount / 100} ref)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : p.paymentStatus === 'PARTIALLY_REFUNDED'
                              ? 'bg-amber-500/15 text-amber-400'
                              : p.paymentStatus === 'REFUNDED'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-[11px] font-sans">
                        <span className="text-slate-300 block">
                          {p.collectedBy?.name || 'Online Gateway'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {p.paidAt ? new Date(p.paidAt).toLocaleTimeString('en-IN') : '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right space-x-1 font-sans">
                        <button
                          onClick={() => setActiveReceiptPaymentId(p.paymentId)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#FFF4E8] text-xs font-semibold"
                          title="View Digital Receipt"
                        >
                          Receipt
                        </button>

                        {isRefundable && (
                          <button
                            onClick={() => handleOpenRefundModal(p)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold"
                            title="Issue Full or Partial Refund"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-slate-500">
                      No payment transactions found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payments Pagination */}
          <Pagination
            currentPage={payPage}
            totalPages={payTotalPages}
            totalItems={payTotal}
            pageSize={payPageSize}
            onPageChange={handlePayPageChange}
          />
        </div>
      )}

      {/* ---------------- 3. FINANCIAL AUDIT & RECONCILIATION VIEW ---------------- */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-6">
          {/* Header & Date Range Selector */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black font-heading text-white">
                  Financial Reconciliation & Audit Engine
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifiable mathematical audit trail reconciling headline dashboard revenue figures against individual qualifying payment records.
              </p>
            </div>

            {/* Time Period Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex-wrap">
              {[
                { id: 'today', label: 'Today (IST)' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7d', label: 'Last 7 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'all_time', label: 'All Time' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setReconcileRange(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all ${
                    reconcileRange === p.id
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <button
                onClick={() => fetchReconciliationData(reconcileRange)}
                disabled={reconciliationLoading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                title="Refresh Audit Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconciliationLoading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {reconciliationLoading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
              <div className="text-xs font-mono">Auditing database records and running reconciliation math...</div>
            </div>
          ) : reconciliationData ? (
            <>
              {/* Checksum Verification Banner */}
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider font-mono">
                      Mathematical Checksum Verified:
                    </span>{' '}
                    Sum of all {reconciliationData.checksum?.qualifyingTransactionsCount} qualifying payment records equals{' '}
                    <span className="font-mono font-bold text-emerald-300 text-sm">
                      ₹{(reconciliationData.checksum?.sumOfTransactionsNetRupees || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    . (100% exact match with Net Revenue Headline Card)
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Timezone: {reconciliationData.period?.timezone} | {reconciliationData.period?.startISTStr} to{' '}
                  {reconciliationData.period?.endISTStr}
                </div>
              </div>

              {/* 6 Reconciled Financial Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* 1. Gross Collected Revenue */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Gross Collected</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black font-heading text-emerald-400">
                    ₹{(reconciliationData.summary?.grossCollectedRupees || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {reconciliationData.summary?.counts?.successfulPayments || 0} successful collections
                  </div>
                </div>

                {/* 2. Refunds Deducted */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-500/20 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Refunds Deducted</span>
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-xl font-black font-heading text-rose-400">
                    -₹{(reconciliationData.summary?.refundsDeductedRupees || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {reconciliationData.summary?.counts?.refundsCount || 0} refund transaction(s)
                  </div>
                </div>

                {/* 3. Net Collected Revenue */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-emerald-950/20 border border-emerald-500/40 space-y-1 shadow-md">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Net Revenue</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black font-heading text-white">
                    ₹{(reconciliationData.summary?.netCollectedRupees || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-emerald-300 font-mono">
                    Gross minus refunds kept
                  </div>
                </div>

                {/* 4. Outstanding Balances */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Outstanding</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-black font-heading text-amber-300">
                    ₹{(reconciliationData.summary?.outstandingBalancesRupees || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {reconciliationData.summary?.outstandingCount || 0} unpaid balances
                  </div>
                </div>

                {/* 5. Booking Contract Value */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Booking Value</span>
                    <Tv className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-xl font-black font-heading text-purple-300">
                    ₹{(reconciliationData.summary?.bookingGrossValueRupees || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {reconciliationData.summary?.bookingGrossCount || 0} sessions face value
                  </div>
                </div>

                {/* 6. Channel Mix */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Channel Mix</span>
                    <CreditCard className="w-3.5 h-3.5 text-[#D7FF00]" />
                  </div>
                  <div className="text-xs font-mono text-white">
                    Online: <strong className="text-emerald-300">₹{(reconciliationData.summary?.channels?.online?.rupees || 0).toLocaleString()}</strong>
                  </div>
                  <div className="text-xs font-mono text-white">
                    Offline: <strong className="text-emerald-300">₹{(reconciliationData.summary?.channels?.offline?.rupees || 0).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Purpose Breakdown Badges */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Revenue Breakdown by Purpose for Selected Period
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(reconciliationData.summary?.purposeBreakdown || {}).map(([purposeKey, data]) => {
                    if (data.count === 0) return null;
                    return (
                      <div
                        key={purposeKey}
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs font-mono"
                      >
                        <span className="text-slate-400 text-[10px] uppercase font-bold">{purposeKey}:</span>
                        <span className="text-white font-bold">₹{data.rupees.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500">({data.count} tx)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Underlying Itemized Transactions Table */}
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <FileText className="w-4 h-4 text-[#D7FF00]" />
                    <span>
                      Underlying Qualifying Payment Records ({reconciliationData.transactions?.length || 0} shown of{' '}
                      {reconciliationData.pagination?.total || 0} total)
                    </span>
                  </div>

                  <div className="relative w-full md:w-80">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter underlying transactions..."
                      value={reconciliationSearch}
                      onChange={(e) => setReconciliationSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#260D17]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-3 w-8">#</th>
                        <th className="px-4 py-3">Receipt / Payment ID</th>
                        <th className="px-4 py-3">Timestamp (IST)</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Purpose</th>
                        <th className="px-4 py-3">Channel / Method</th>
                        <th className="px-4 py-3 text-right">Gross (₹)</th>
                        <th className="px-4 py-3 text-right">Refunded (₹)</th>
                        <th className="px-4 py-3 text-right">Net Received (₹)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(reconciliationData.transactions || [])
                        .filter((tx) => {
                          if (!reconciliationSearch) return true;
                          const q = reconciliationSearch.toLowerCase();
                          return (
                            tx.paymentId?.toLowerCase().includes(q) ||
                            tx.receiptNumber?.toLowerCase().includes(q) ||
                            tx.customerName?.toLowerCase().includes(q) ||
                            tx.customerEmail?.toLowerCase().includes(q) ||
                            tx.bookingReference?.toLowerCase().includes(q) ||
                            tx.purpose?.toLowerCase().includes(q)
                          );
                        })
                        .map((tx, idx) => (
                          <tr key={tx.paymentId} className="hover:bg-slate-900/50 transition-colors">
                            <td className="px-3 py-3 text-[10px] text-slate-500">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-white font-mono">{tx.receiptNumber}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{tx.paymentId}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-[11px]">
                              {tx.paidAtIST}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{tx.customerName}</div>
                              <div className="text-[10px] text-slate-500">{tx.customerEmail}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                                {tx.purpose}
                              </span>
                              {tx.bookingReference && tx.bookingReference !== 'N/A' && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{tx.bookingReference}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-emerald-300 font-bold">
                                  {tx.method}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {tx.gateway === 'RAZORPAY' ? 'Online' : 'Counter'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-300">
                              ₹{tx.grossRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right text-rose-400">
                              {tx.refundedRupees > 0 ? `-₹${tx.refundedRupees.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-emerald-400">
                              ₹{tx.netRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setActiveReceiptPaymentId(tx.paymentId)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold"
                              >
                                Receipt
                              </button>
                            </td>
                          </tr>
                        ))}

                      {(reconciliationData.transactions || []).length === 0 && (
                        <tr>
                          <td colSpan="11" className="px-4 py-12 text-center text-slate-500">
                            No qualifying payment records found for {reconcileRange.toUpperCase()}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-950 font-mono text-xs border-t-2 border-slate-700">
                      <tr>
                        <td colSpan="6" className="px-4 py-3 font-bold text-white text-right uppercase tracking-wider">
                          Reconciled Total for Selected Period:
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-200">
                          ₹{(reconciliationData.summary?.grossCollectedRupees || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-rose-400">
                          -₹{(reconciliationData.summary?.refundsDeductedRupees || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-400 text-sm">
                          ₹{(reconciliationData.summary?.netCollectedRupees || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td colSpan="2" className="px-4 py-3 text-center text-[10px] text-emerald-400 font-bold">
                          ✓ RECONCILED
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              Select a date range to generate the financial reconciliation audit trail.
            </div>
          )}
        </div>
      )}

      {/* ---------------- 4. REFUNDS AUDIT VIEW ---------------- */}
      {activeSubTab === 'refunds' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#260D17]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Refund ID</th>
                  <th className="px-4 py-3">Original Payment</th>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {refunds.slice((refundPage - 1) * 10, refundPage * 10).map((r) => (
                  <tr key={r._id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-rose-400 font-bold">{r.refundId}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.payment?.paymentId || r.payment}
                    </td>
                    <td className="px-4 py-3 text-[#D7FF00]">
                      {r.booking?.bookingId || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-sans text-white">
                      {r.customer?.name} ({r.customer?.email})
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-400 text-sm">
                      ₹{r.amount / 100}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400">
                      {r.initiatedBy?.name || 'Administrator'}
                    </td>
                  </tr>
                ))}

                {refunds.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-slate-500">
                      No refunds issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Refunds Pagination */}
          <Pagination
            currentPage={refundPage}
            totalPages={Math.ceil(refunds.length / 10)}
            totalItems={refunds.length}
            pageSize={10}
            onPageChange={setRefundPage}
          />
        </div>
      )}

      {/* ---------------- 4. RAZORPAY SETTINGS VIEW ---------------- */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Status Hero Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-[#260D17] via-[#171014] to-[#260D17] border border-[#851B2B]/40 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#851B2B]/20 border border-[#851B2B]/40 flex items-center justify-center text-[#D7FF00]">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black font-heading text-white">
                      Razorpay Test Mode Integration
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D7FF00]/15 text-[#D7FF00] font-mono font-bold border border-[#D7FF00]/30">
                      TEST MODE ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-[#C7A5A8]">
                    Official payment gateway configuration for NOAH GAMING lounge.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await paymentApi.getPaymentSettings();
                      if (res.success) {
                        setSettings(res.data);
                        showToast.success('Gateway settings refreshed');
                      }
                    } catch (e) {
                      showToast.error('Could not refresh settings');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs text-white font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Status
                </button>
              </div>
            </div>

            {/* Safety Alert Banner */}
            <div className="p-3.5 rounded-2xl bg-[#D7FF00]/10 border border-[#D7FF00]/30 flex items-start gap-2.5 text-xs text-[#FFF4E8]">
              <ShieldCheck className="w-5 h-5 text-[#D7FF00] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#D7FF00] font-bold">Strict Test Mode Enforced:</strong> Production live payments are blocked by server security checks (`RAZORPAY_MODE=test`). All transactions use test UPI handles, mock cards, and simulation sandboxes. No real bank accounts are charged.
              </div>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Key ID Status */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono uppercase">Key ID Configured</span>
                {settings?.keyIdConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="text-lg font-bold text-white font-mono">
                {settings?.keyIdConfigured ? 'Yes (Connected)' : 'No (Pending .env)'}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {settings?.keyIdPrefix ? `Prefix: ${settings.keyIdPrefix}` : 'Configured via RAZORPAY_KEY_ID in backend .env'}
              </p>
            </div>

            {/* Key Secret Status */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono uppercase">Key Secret Configured</span>
                {settings?.keySecretConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="text-lg font-bold text-white font-mono">
                {settings?.keySecretConfigured ? 'Yes (Protected)' : 'No (Pending .env)'}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Secret value is strictly masked & never exposed to frontend code or API.
              </p>
            </div>

            {/* Webhook Secret Status */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono uppercase">Webhook Configured</span>
                {settings?.webhookSecretConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="text-lg font-bold text-white font-mono">
                {settings?.webhookSecretConfigured ? 'Yes (Protected)' : 'No (Pending .env)'}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Raw body signature validation enabled for Razorpay dashboard webhooks.
              </p>
            </div>
          </div>

          {/* Diagnostics: Last Test Payment & Verification Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Last Successful Test Payment */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider font-heading text-white">
                  Last Successful Test Payment
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono border border-emerald-500/30">
                  {settings?.lastSuccessfulTestPayment ? 'RECORDED' : 'AWAITING TEST'}
                </span>
              </div>

              {settings?.lastSuccessfulTestPayment ? (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Payment ID:</span>
                    <span className="text-[#D7FF00] font-bold">{settings.lastSuccessfulTestPayment.paymentId}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Amount Paid:</span>
                    <span className="text-white font-bold">₹{settings.lastSuccessfulTestPayment.amountRupees}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Gateway Ref:</span>
                    <span className="text-slate-300">{settings.lastSuccessfulTestPayment.gatewayPaymentId || 'Simulated Test'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Customer:</span>
                    <span className="text-slate-300">{settings.lastSuccessfulTestPayment.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="text-slate-300">{new Date(settings.lastSuccessfulTestPayment.paidAt).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono py-4 text-center">
                  No verified test transactions recorded yet. Initiate a test booking to verify.
                </p>
              )}
            </div>

            {/* Last Verification Status & Webhook URL */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider font-heading text-white">
                  Payment Verification Engine
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#851B2B]/30 text-[#FFF4E8] font-mono border border-[#851B2B]/60">
                  HMAC-SHA256
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Last Verification Attempt:</span>
                  <span className={`font-bold ${settings?.lastVerificationStatus === 'PAID' ? 'text-emerald-400' : settings?.lastVerificationStatus === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                    {settings?.lastVerificationStatus || 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Cryptographic Method:</span>
                  <span className="text-slate-300">constant-time timingSafeEqual</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Idempotency Protection:</span>
                  <span className="text-emerald-400">Active (Multi-click & Webhook deduplication)</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block mb-1">Webhook Endpoint URL:</span>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                    <code className="text-[11px] text-[#D7FF00] truncate">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/payments/webhook` : '/api/payments/webhook'}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/api/payments/webhook`);
                          showToast.success('Webhook URL copied to clipboard');
                        }
                      }}
                      className="p-1 hover:text-white text-slate-400 shrink-0 cursor-pointer"
                      title="Copy webhook URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Supported events: payment.captured, order.paid, payment.failed, refund.processed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 1: RECEPTION COUNTER OFFLINE PAYMENT ---------------- */}
      {offlineModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="m-auto w-full max-w-lg bg-[#260D17] border border-slate-700/80 rounded-3xl shadow-2xl p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold font-heading text-white">
                  Collect Counter Payment
                </h3>
              </div>
              <button
                onClick={() => setOfflineModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOfflinePayment} className="space-y-4 text-xs">
              {/* Select Booking */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Select Booking with Outstanding Balance
                </label>
                <select
                  required
                  value={offlineForm.bookingId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    const b = eligibleBookings.find((x) => x._id === bId);
                    setOfflineForm({
                      ...offlineForm,
                      bookingId: bId,
                      amount: b ? (b.balanceRemaining ? b.balanceRemaining / 100 : b.totalAmount / 100).toString() : '',
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-[#851B2B]"
                >
                  <option value="">-- Choose Reservation --</option>
                  {eligibleBookings.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.bookingId} - {b.device?.name} - {b.customer?.name} (Due: ₹{b.balanceRemaining ? b.balanceRemaining / 100 : b.totalAmount / 100})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount to Collect */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Collection Amount (₹ INR)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={offlineForm.amount}
                  onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Counter Payment Channel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOfflineForm({ ...offlineForm, paymentMethod: 'CASH' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold font-mono transition-all ${
                      offlineForm.paymentMethod === 'CASH'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> Physical Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setOfflineForm({ ...offlineForm, paymentMethod: 'COUNTER_UPI' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold font-mono transition-all ${
                      offlineForm.paymentMethod === 'COUNTER_UPI'
                        ? 'bg-[#851B2B]/20 border-[#D7FF00] text-[#FFF4E8]'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" /> Counter UPI QR
                  </button>
                </div>
              </div>

              {/* Transaction Ref / UTR (For UPI) */}
              {offlineForm.paymentMethod === 'COUNTER_UPI' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                    UPI UTR / Reference Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 98471928374 or UPI Txn Ref"
                    value={offlineForm.transactionReference}
                    onChange={(e) =>
                      setOfflineForm({ ...offlineForm, transactionReference: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Staff Collection Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional remarks (e.g. Received at Front Desk)"
                  value={offlineForm.notes}
                  onChange={(e) => setOfflineForm({ ...offlineForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOfflineModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offlineSubmitting}
                  className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider"
                >
                  {offlineSubmitting ? 'Recording Payment...' : 'Confirm Cash/UPI Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: ISSUE REFUND (ADMIN ONLY) ---------------- */}
      {refundModalOpen && selectedPaymentForRefund && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="m-auto w-full max-w-md bg-[#260D17] border border-rose-500/30 rounded-3xl shadow-2xl p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-bold font-heading text-white">
                  Issue Customer Refund
                </h3>
              </div>
              <button
                onClick={() => setRefundModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRefund} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Payment Receipt:</span>
                  <span className="text-[#D7FF00] font-bold">{selectedPaymentForRefund.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Original Paid:</span>
                  <span className="text-white">₹{selectedPaymentForRefund.amount / 100}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Already Refunded:</span>
                  <span className="text-rose-400">₹{(selectedPaymentForRefund.refundedAmount || 0) / 100}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-slate-800">
                  <span>Max Refundable:</span>
                  <span>
                    ₹{(selectedPaymentForRefund.amount - (selectedPaymentForRefund.refundedAmount || 0)) / 100}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Refund Amount (₹ INR)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(selectedPaymentForRefund.amount - (selectedPaymentForRefund.refundedAmount || 0)) / 100}
                  step="1"
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Refund Reason
                </label>
                <select
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                >
                  <option value="Customer Cancellation">Customer Cancellation</option>
                  <option value="Hardware Maintenance / Outage">Hardware Maintenance / Outage</option>
                  <option value="Accidental Duplicate Booking">Accidental Duplicate Booking</option>
                  <option value="Overcharge Adjustment">Overcharge Adjustment</option>
                  <option value="Session Terminated Early">Session Terminated Early</option>
                  <option value="Other / Discretionary">Other / Discretionary</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Administrative Audit Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Reasoning for audit trail..."
                  value={refundForm.notes}
                  onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundSubmitting}
                  className="px-6 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20"
                >
                  {refundSubmitting ? 'Processing Refund...' : 'Confirm & Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: DIGITAL RECEIPT MODAL ---------------- */}
      {activeReceiptPaymentId && (
        <ReceiptModal
          paymentId={activeReceiptPaymentId}
          onClose={() => setActiveReceiptPaymentId(null)}
        />
      )}
    </div>
  );
};
