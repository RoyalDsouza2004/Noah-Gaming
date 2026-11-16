import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../../../api/analytics.js';
import { showToast } from '../../../utils/toast.js';
import {
  AreaTrendChart,
  BarComparisonChart,
  DonutBreakdownChart,
} from './ChartComponents.jsx';
import { ReportExportModal } from './ReportExportModal.jsx';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  Tv,
  Gamepad2,
  Users,
  Crown,
  UserCheck,
  Wrench,
  Download,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  CreditCard,
  QrCode,
  Banknote,
  Search,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const AdminAnalyticsView = () => {
  // Navigation sub-tab inside Analytics
  const [analyticsSubTab, setAnalyticsSubTab] = useState('revenue'); // revenue, bookings, devices, games, customers, memberships, staff

  // Date range filter
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [kpiData, setKpiData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [deviceRevenue, setDeviceRevenue] = useState(null);
  const [gameRevenue, setGameRevenue] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [deviceUtilization, setDeviceUtilization] = useState(null);
  const [gamePerformance, setGamePerformance] = useState([]);
  const [customerData, setCustomerData] = useState(null);
  const [membershipData, setMembershipData] = useState(null);
  const [receptionistData, setReceptionistData] = useState(null);
  const [maintenanceData, setMaintenanceData] = useState(null);
  const [financialPayments, setFinancialPayments] = useState(null);

  // Export Modal
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Fetch all analytics for currently selected date range
  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const queryParams = { range };
    if (range === 'custom' && customStart && customEnd) {
      queryParams.startDate = customStart;
      queryParams.endDate = customEnd;
    }

    try {
      const [
        kpiRes,
        revRes,
        devRevRes,
        gmRevRes,
        pmRes,
        bkRes,
        duRes,
        gpRes,
        custRes,
        memRes,
        recRes,
        maintRes,
        finRes,
      ] = await Promise.all([
        analyticsApi.getDashboardKPIs(),
        analyticsApi.getRevenueAnalytics(queryParams),
        analyticsApi.getRevenueByDevice(queryParams),
        analyticsApi.getRevenueByGame(queryParams),
        analyticsApi.getRevenueByPaymentMethod(queryParams),
        analyticsApi.getBookingAnalytics(queryParams),
        analyticsApi.getDeviceUtilization(queryParams),
        analyticsApi.getGamePerformance(queryParams),
        analyticsApi.getCustomerAnalytics(queryParams),
        analyticsApi.getMembershipAnalytics(queryParams),
        analyticsApi.getReceptionistPerformance(queryParams),
        analyticsApi.getMaintenanceAnalytics(),
        analyticsApi.getFinancialPayments(queryParams),
      ]);

      if (kpiRes.success) setKpiData(kpiRes.data);
      if (revRes.success) setRevenueData(revRes.data);
      if (devRevRes.success) setDeviceRevenue(devRevRes.data);
      if (gmRevRes.success) setGameRevenue(gmRevRes.data);
      if (pmRes.success) setPaymentMethods(pmRes.data);
      if (bkRes.success) setBookingData(bkRes.data);
      if (duRes.success) setDeviceUtilization(duRes.data);
      if (gpRes.success) setGamePerformance(gpRes.data);
      if (custRes.success) setCustomerData(custRes.data);
      if (memRes.success) setMembershipData(memRes.data);
      if (recRes.success) setReceptionistData(recRes.data);
      if (maintRes.success) setMaintenanceData(maintRes.data);
      if (finRes.success) setFinancialPayments(finRes.data);
    } catch (err) {
      showToast.error(err.message || 'Failed to load business intelligence analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const handleApplyCustomDate = () => {
    if (!customStart || !customEnd) {
      showToast.error('Please select both start and end date.');
      return;
    }
    fetchAnalytics();
  };

  if (loading && !kpiData) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#D7FF00]">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="text-sm font-semibold tracking-wide">
          Aggregating Business Intelligence from MongoDB...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ---------------- TOP HEADER & CONTROLS ---------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#260D17] border border-[#49202C] shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-[#D7FF00] text-xs font-bold tracking-widest uppercase mb-1">
            <TrendingUp className="w-4 h-4" />
            Executive Business Intelligence & Reporting
          </div>
          <h2 className="text-2xl font-black text-white font-heading tracking-wide">
            Performance Command Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time financial audits, station utilization, member retention, and staff monitoring
          </p>
        </div>

        {/* Action Buttons: Refresh, Date Range, Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center bg-[#131a2c] border border-slate-700/80 rounded-xl p-1">
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '6m', label: '6M' },
              { id: '1y', label: '1Y' },
              { id: 'custom', label: 'Custom' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  range === r.id
                    ? 'bg-[#D7FF00] text-[#171014] shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>

          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#851B2B] to-[#A51F35] text-slate-950 font-bold text-xs shadow-lg shadow-[#851B2B]/20 hover:brightness-110 transition-all font-heading"
          >
            <Download className="w-4 h-4" />
            Export Reports (11)
          </button>
        </div>
      </div>

      {/* Custom Date Inputs if range is 'custom' */}
      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[#121724] border border-slate-800 text-xs">
          <span className="font-semibold text-slate-300">Custom IST Range:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-[#851B2B]"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-[#851B2B]"
          />
          <button
            onClick={handleApplyCustomDate}
            className="px-3.5 py-1.5 rounded-lg bg-[#D7FF00] text-[#171014] font-bold hover:bg-[#cbf200] transition-colors"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* ---------------- 12 KPI OVERVIEW CARDS (SECTION 1) ---------------- */}
      {kpiData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
          {/* 1. Total Revenue */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Total Net Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              ₹{kpiData.revenue.totalRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Gross: ₹{kpiData.revenue.grossCollectionsRupees.toLocaleString('en-IN')}
            </div>
          </div>

          {/* 2. Today's Revenue */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Today's Revenue</span>
              <Calendar className="w-4 h-4 text-[#D7FF00]" />
            </div>
            <div className="text-xl font-black font-mono text-[#FFF4E8]">
              ₹{kpiData.revenue.todayRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Refunds: ₹{kpiData.revenue.totalRefundsRupees}
            </div>
          </div>

          {/* 3. This Week's Revenue */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">This Week</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              ₹{kpiData.revenue.weekRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Last 7 operating days</div>
          </div>

          {/* 4. This Month's Revenue */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">This Month</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-black font-mono text-purple-300">
              ₹{kpiData.revenue.monthRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Current calendar month</div>
          </div>

          {/* 5. Total Bookings */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Total Bookings</span>
              <Gamepad2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black font-heading text-white">
              {kpiData.bookings.totalBookings}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Confirmed: {kpiData.bookings.confirmedBookings}
            </div>
          </div>

          {/* 6. Today's Bookings */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Today's Bookings</span>
              <Calendar className="w-4 h-4 text-[#D7FF00]" />
            </div>
            <div className="text-xl font-black font-heading text-[#D7FF00]">
              {kpiData.bookings.todayBookings}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Scheduled for today</div>
          </div>

          {/* 7. Active Gaming Sessions */}
          <div className="p-4 rounded-xl bg-[#111726] border border-emerald-500/30 hover:border-emerald-400 transition-all bg-emerald-950/10">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-bold uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Sessions
              </span>
              <Tv className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-heading text-emerald-300">
              {kpiData.bookings.activeSessions}
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-1">Currently on consoles</div>
          </div>

          {/* 8. Completed Sessions */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-xl font-black font-heading text-white">
              {kpiData.bookings.completedSessions}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Past gaming sessions</div>
          </div>

          {/* 9. Cancelled Bookings */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-rose-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Cancelled</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-black font-heading text-rose-300">
              {kpiData.bookings.cancelledBookings}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Customer / staff void</div>
          </div>

          {/* 10. Registered Customers */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-[#49202C] transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Customers</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-black font-heading text-white">
              {kpiData.customers.registeredCustomers}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Registered customer profiles</div>
          </div>

          {/* 11. Active Memberships */}
          <div className="p-4 rounded-xl bg-[#111726] border border-amber-500/30 hover:border-amber-400 transition-all bg-amber-950/10">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Active Passes</span>
              <Crown className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-heading text-amber-300">
              {kpiData.customers.activeMemberships}
            </div>
            <div className="text-[10px] text-amber-400/70 mt-1">Valid monthly passes</div>
          </div>

          {/* 12. Pending Payments */}
          <div className="p-4 rounded-xl bg-[#111726] border border-slate-800 hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase">Pending Dues</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono text-amber-300">
              ₹{kpiData.pendingPayments.amountRupees.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {kpiData.pendingPayments.count} pending transaction{kpiData.pendingPayments.count === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ANALYTICS SUB-NAVIGATION TABS (Wrap naturally, zero horizontal scrollbar) ---------------- */}
      <div className="flex flex-wrap items-center p-1.5 rounded-xl bg-[#0d121e] border border-slate-800 gap-1.5">
        {[
          { id: 'revenue', label: 'Revenue Analytics', icon: DollarSign },
          { id: 'bookings', label: 'Booking Analytics & Trends', icon: Calendar },
          { id: 'devices', label: 'Device Utilization', icon: Tv },
          { id: 'games', label: 'Game Performance & GTA 6', icon: Flame },
          { id: 'customers', label: 'Customer Retention & Spend', icon: Users },
          { id: 'memberships', label: 'Membership Analytics', icon: Crown },
          { id: 'staff', label: 'Receptionist Monitoring', icon: UserCheck },
          { id: 'maintenance', label: 'Maintenance & Downtime', icon: Wrench },
          { id: 'payments', label: 'Payment Ledger & Dues', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = analyticsSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAnalyticsSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all font-heading ${
                isActive
                  ? 'bg-[#D7FF00] text-[#171014] shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---------------- 1. REVENUE ANALYTICS TAB ---------------- */}
      {analyticsSubTab === 'revenue' && revenueData && (
        <div className="space-y-6 animate-fadeIn">
          {/* Financial Reconciliation Summary Card */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 font-heading">
              <ShieldCheck className="w-4 h-4 text-[#D7FF00]" />
              Financial Reconciliation Summary ({revenueData.dateRange.range.toUpperCase()}: {revenueData.dateRange.start} to {revenueData.dateRange.end})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Gross Collections</span>
                <span className="text-lg font-bold font-mono text-white">
                  ₹{revenueData.grossCollectionsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-400 block mt-1">Verified payments only</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Successful Refunds</span>
                <span className="text-lg font-bold font-mono text-rose-400">
                  -₹{revenueData.totalRefundsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-rose-400/80 block mt-1">Deducted from net</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#851B2B]/20 border border-[#49202C]">
                <span className="text-[11px] text-[#FFF4E8] block mb-0.5 font-semibold">Net Collections</span>
                <span className="text-lg font-bold font-mono text-[#D7FF00]">
                  ₹{revenueData.netCollectionsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-[#FFF4E8]/80 block mt-1">Actual revenue kept</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Outstanding Balances</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  ₹{revenueData.outstandingBalancesRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Remaining customer dues</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Advance Payments</span>
                <span className="text-lg font-bold font-mono text-purple-400">
                  ₹{revenueData.advancePaymentsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">GTA 6 mandatory advance</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Membership Revenue</span>
                <span className="text-lg font-bold font-mono text-amber-300">
                  ₹{revenueData.membershipRevenue.totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Pass sales & renewals</span>
              </div>
            </div>
          </div>

          {/* Daily Revenue Trend Chart */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
                  Daily Net Revenue Trend (IST)
                </h3>
                <p className="text-xs text-slate-400">
                  Hover over data points to inspect daily net collections and transaction counts
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#851B2B]/20 text-[#D7FF00] text-xs font-mono font-bold">
                {revenueData.trends.length} days plotted
              </span>
            </div>
            <AreaTrendChart
              data={revenueData.trends}
              dataKey="netRupees"
              labelKey="date"
              height={260}
            />
          </div>

          {/* Grid: Device Breakdown + Payment Method Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue By Physical Device & GTA 6 */}
            {deviceRevenue && (
              <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
                    Revenue By Hardware Station
                  </h3>
                  <span className="text-xs text-slate-400">Exactly 3 physical stations</span>
                </div>

                <div className="space-y-3">
                  {deviceRevenue.devices.map((dev) => (
                    <div
                      key={dev.code}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          {dev.name}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                            {dev.code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {dev.count} payment transactions
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold font-mono text-[#D7FF00]">
                          ₹{dev.totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* GTA 6 Dedicated Callout Card */}
                {deviceRevenue.gta6Breakdown && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                            GTA 6 Exclusive Booking Revenue
                          </span>
                          <span className="text-[11px] text-slate-300">
                            {deviceRevenue.gta6Breakdown.note}
                          </span>
                        </div>
                      </div>
                      <span className="text-base font-bold font-mono text-amber-400">
                        ₹{deviceRevenue.gta6Breakdown.totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                        ₹150 / hr (Exclusive Lock)
                      </span>
                      <span>&bull;</span>
                      <span>{deviceRevenue.gta6Breakdown.count} sessions</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Revenue By Payment Method & Online vs Offline */}
            {paymentMethods && (
              <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
                    Payment Methods & Channels
                  </h3>
                  <span className="text-xs text-slate-400">Online vs Counter Collections</span>
                </div>

                {/* Donut Chart: Online vs Offline */}
                <DonutBreakdownChart
                  segments={[
                    {
                      label: 'Online Gateway (Razorpay)',
                      value: paymentMethods.collectionChannels.onlineRupees,
                      color: '#00E5FF',
                    },
                    {
                      label: 'Offline Counter (Cash & UPI)',
                      value: paymentMethods.collectionChannels.offlineRupees,
                      color: '#10B981',
                    },
                  ]}
                  totalLabel="Total Collections"
                  centerValue={`₹${Math.round(paymentMethods.collectionChannels.totalNetRupees).toLocaleString('en-IN')}`}
                />

                {/* Detailed Method Bars */}
                <div className="pt-2 border-t border-slate-800/80">
                  <BarComparisonChart
                    data={paymentMethods.methods}
                    labelKey="method"
                    valueKey="amountRupees"
                    sublabelKey="type"
                    valuePrefix="₹"
                    color="#00E5FF"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 2. BOOKING ANALYTICS TAB ---------------- */}
      {analyticsSubTab === 'bookings' && bookingData && (
        <div className="space-y-6 animate-fadeIn">
          {/* Booking Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Total Bookings', value: bookingData.metrics.totalBookings, color: 'text-white' },
              { label: 'Confirmed', value: bookingData.metrics.confirmedBookings, color: 'text-[#D7FF00]' },
              { label: 'Completed', value: bookingData.metrics.completedBookings, color: 'text-teal-400' },
              { label: 'Cancelled', value: bookingData.metrics.cancelledBookings, color: 'text-rose-400' },
              { label: 'No-Shows', value: bookingData.metrics.noShowBookings, color: 'text-amber-400' },
              { label: 'Shared Sessions', value: bookingData.metrics.sharedBookings, color: 'text-blue-400' },
              { label: 'Private Sessions', value: bookingData.metrics.privateBookings, color: 'text-purple-400' },
              { label: 'Walk-ins (POS)', value: bookingData.metrics.walkInBookings, color: 'text-emerald-400' },
            ].map((b, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-[#260D17] border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  {b.label}
                </span>
                <span className={`text-xl font-black font-heading ${b.color}`}>{b.value}</span>
              </div>
            ))}
          </div>

          {/* Average Session Duration Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent border border-blue-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Average Gaming Session Duration
                </span>
                <span className="text-xs text-slate-400">
                  Calculated across all confirmed and completed lounge reservations
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-[#FFF4E8]">
                {bookingData.metrics.averageDurationHours} hrs
              </span>
              <span className="text-xs text-slate-400 block">
                ({bookingData.metrics.averageDurationMinutes} minutes)
              </span>
            </div>
          </div>

          {/* Grid: Peak Days & Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Booking Days */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D7FF00]" />
                Peak Booking Days of Week
              </h3>
              <BarComparisonChart
                data={bookingData.peakDays}
                labelKey="day"
                valueKey="bookings"
                valueSuffix=" bookings"
                color="#00E5FF"
              />
            </div>

            {/* Peak Booking Hours (10:00 to 23:00 IST) */}
            <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Peak Operating Hours (10:00 to 23:00 IST)
              </h3>
              <div className="max-h-[360px] overflow-y-auto pr-1">
                <BarComparisonChart
                  data={bookingData.peakHours}
                  labelKey="hour"
                  valueKey="bookings"
                  valueSuffix=" sessions"
                  color="#A855F7"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 3. DEVICE UTILIZATION TAB ---------------- */}
      {analyticsSubTab === 'devices' && deviceUtilization && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 rounded-xl bg-[#851B2B]/20 border border-[#49202C] text-xs text-slate-300 flex items-center justify-between">
            <div>
              <span className="font-bold text-[#D7FF00]">Operating Schedule Formula:</span> 10:00 to 23:00 IST (13 operating hours / day).
              Available Hours = Nominal Operating Hours - Maintenance Downtime.
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-900 font-mono text-[#FFF4E8] font-bold">
              {deviceUtilization.dateRange.days} Days Window
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {deviceUtilization.devices.map((dev) => {
              const isPS5 = dev.deviceType === 'PS5';
              const util = dev.utilizationPercentage;
              const barColor = util > 60 ? '#10B981' : util > 30 ? '#F59E0B' : '#00E5FF';

              return (
                <div
                  key={dev.deviceCode}
                  className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl space-y-4 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {dev.deviceCode}
                      </span>
                      <h4 className="text-base font-bold text-white mt-1 font-heading">{dev.deviceName}</h4>
                      <span className="text-xs text-slate-400">Capacity: {dev.capacity} players</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black font-mono" style={{ color: barColor }}>
                        {dev.utilizationPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                        Utilization
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, dev.utilizationPercentage)}%`, backgroundColor: barColor }}
                    />
                  </div>

                  {/* Operating breakdown stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div className="p-2 rounded-lg bg-slate-900/60">
                      <span className="text-slate-400 text-[11px] block">Booked Hours</span>
                      <span className="font-bold text-white font-mono">{dev.bookedHours} hrs</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60">
                      <span className="text-slate-400 text-[11px] block">Available Hours</span>
                      <span className="font-bold text-[#D7FF00] font-mono">{dev.availableHours} hrs</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60">
                      <span className="text-slate-400 text-[11px] block">Downtime</span>
                      <span className="font-bold text-rose-400 font-mono">{dev.maintenanceHours} hrs</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60">
                      <span className="text-slate-400 text-[11px] block">Revenue</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        ₹{dev.totalRevenueRupees.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                    <span>{dev.bookingsCount} total bookings</span>
                    <span className="text-emerald-400 font-semibold">{dev.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- 4. GAME PERFORMANCE & GTA 6 TAB ---------------- */}
      {analyticsSubTab === 'games' && (
        <div className="space-y-6 animate-fadeIn">
          {/* GTA 6 Dedicated Callout Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/40 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white font-heading">
                      GTA 6 (Grand Theft Auto VI) Exclusive Title
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 uppercase">
                      Exclusive Game
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Assigned to physical PS5 hardware (PS5 Station 1 & 2). Mandatory advance payment required.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] text-amber-400 uppercase font-semibold block">Rate</span>
                  <span className="text-lg font-bold font-mono text-white">₹150 / hr</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 uppercase font-semibold block">Advance Req.</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">₹75.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Game Titles Ranking Table */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl overflow-hidden">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Game Title Performance & Hourly Usage
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#121724] text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Game Title</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Total Hours Played</th>
                    <th className="py-3 px-4">Bookings</th>
                    <th className="py-3 px-4">Revenue Generated (₹)</th>
                    <th className="py-3 px-4">Hardware Consoles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {gamePerformance.map((game, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        {game.gameName}
                        {game.isGTA6 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                            Exclusive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {game.isExclusive ? 'Private Exclusive' : 'Standard Play'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#D7FF00]">
                        {game.totalHours} hrs
                      </td>
                      <td className="py-3 px-4 font-mono">{game.bookingsCount}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        ₹{game.totalRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {game.devicesPlayedOn?.join(', ') || 'PS5 Station'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 5. CUSTOMER RETENTION & SPEND TAB ---------------- */}
      {analyticsSubTab === 'customers' && customerData && (
        <div className="space-y-6 animate-fadeIn">
          {/* Customer Overview Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Total Customers</span>
              <span className="text-2xl font-black font-heading text-white">
                {customerData.overview.totalCustomers}
              </span>
              <span className="text-[10px] text-[#D7FF00] block mt-1">
                +{customerData.overview.newCustomers} in selected period
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Active vs Inactive</span>
              <span className="text-2xl font-black font-heading text-emerald-400">
                {customerData.overview.activeCustomers}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                {customerData.overview.inactiveCustomers} inactive
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Pass Holders</span>
              <span className="text-2xl font-black font-heading text-amber-300">
                {customerData.overview.customersWithActiveMembership}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                {customerData.overview.customersWithExpiredMembership} expired
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Average Spend</span>
              <span className="text-2xl font-black font-mono text-[#FFF4E8]">
                ₹{customerData.overview.averageSpendRupees.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                ~{customerData.overview.averageSessionsPerCustomer} sessions / user
              </span>
            </div>
          </div>

          {/* Top Spenders Table */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl overflow-hidden">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Top Customer Spenders Leaderboard
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#121724] text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Total Spend (₹)</th>
                    <th className="py-3 px-4">Payments</th>
                    <th className="py-3 px-4">Active Pass</th>
                    <th className="py-3 px-4">Last Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {customerData.topSpenders.map((cust, i) => (
                    <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#851B2B]/20 text-[#D7FF00] font-bold flex items-center justify-center text-xs">
                          {cust.name.charAt(0).toUpperCase()}
                        </div>
                        {cust.name}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <div>{cust.email}</div>
                        <div className="text-[11px] text-slate-500">{cust.phone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">
                        ₹{cust.totalSpentRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 font-mono">{cust.transactionsCount}</td>
                      <td className="py-3 px-4">
                        {cust.membershipStatus === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {cust.activePlan}
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">Active</span>
                          </span>
                        ) : cust.membershipStatus === 'EXPIRED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold whitespace-nowrap">
                            {cust.activePlan}
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">Expired</span>
                          </span>
                        ) : cust.membershipStatus === 'SUSPENDED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-semibold whitespace-nowrap">
                            {cust.activePlan}
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200">Suspended</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-800/80 text-slate-400 text-xs font-medium">
                            Non-Member
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {cust.lastPaymentAt ? new Date(cust.lastPaymentAt).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 6. MEMBERSHIP ANALYTICS TAB ---------------- */}
      {analyticsSubTab === 'memberships' && membershipData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Active Subscriptions', value: membershipData.metrics.activeSubscriptions, color: 'text-amber-400' },
              { label: 'Total Pass Sales', value: membershipData.metrics.totalSubscriptions, color: 'text-white' },
              { label: 'Pass Renewals', value: membershipData.metrics.membershipRenewals, color: 'text-[#D7FF00]' },
              { label: 'Pass Upgrades', value: membershipData.metrics.membershipUpgrades, color: 'text-purple-400' },
              { label: 'Renewal Rate', value: `${membershipData.metrics.renewalRatePercentage}%`, color: 'text-emerald-400' },
              { label: 'Pass Revenue', value: `₹${membershipData.metrics.totalRevenueRupees.toLocaleString('en-IN')}`, color: 'text-amber-300 font-mono' },
            ].map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#260D17] border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{m.label}</span>
                <span className={`text-xl font-black font-heading ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Plan Popularity & Generated Revenue
            </h3>
            <div className="space-y-3">
              {membershipData.planPerformance.map((plan, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white text-sm block">{plan.planName}</span>
                    <span className="text-xs text-slate-400">{plan.salesCount} subscriptions sold</span>
                  </div>
                  <span className="text-base font-bold font-mono text-amber-300">
                    ₹{plan.revenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 7. RECEPTIONIST MONITORING TAB ---------------- */}
      {analyticsSubTab === 'staff' && receptionistData && (
        <div className="space-y-6 animate-fadeIn">
          {/* Staff Leaderboard */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl overflow-hidden">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Receptionist & Front-Desk Staff Activity
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#121724] text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Bookings Created</th>
                    <th className="py-3 px-4">Walk-ins Handled</th>
                    <th className="py-3 px-4">Check-ins</th>
                    <th className="py-3 px-4">Completed</th>
                    <th className="py-3 px-4">Counter Cash</th>
                    <th className="py-3 px-4">Counter UPI</th>
                    <th className="py-3 px-4">Total Offline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {receptionistData.receptionists.map((rec, i) => (
                    <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{rec.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                          {rec.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#D7FF00]">{rec.bookingsCreated}</td>
                      <td className="py-3 px-4 font-mono text-emerald-400">{rec.walkInsHandled}</td>
                      <td className="py-3 px-4 font-mono">{rec.checkInsPerformed}</td>
                      <td className="py-3 px-4 font-mono">{rec.sessionsCompleted}</td>
                      <td className="py-3 px-4 font-mono">₹{rec.cashCollectedRupees.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-mono">₹{rec.counterUpiCollectedRupees.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#FFF4E8]">
                        ₹{rec.totalOfflineCollectedRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Audit Log */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Recent Receptionist & POS Action Logs
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {receptionistData.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#851B2B]/20 text-[#D7FF00] border border-[#49202C]">
                      {log.action}
                    </span>
                    <span className="text-slate-300">{log.description || 'Action performed'}</span>
                    {log.bookingId && (
                      <span className="text-[11px] text-slate-500 font-mono">[{log.bookingId}]</span>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{log.userName}</div>
                    <div>{new Date(log.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 8. MAINTENANCE & DOWNTIME TAB ---------------- */}
      {analyticsSubTab === 'maintenance' && maintenanceData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Total Incidents</span>
              <span className="text-2xl font-black font-heading text-white">{maintenanceData.totalIncidents}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Total Downtime Hours</span>
              <span className="text-2xl font-black font-mono text-rose-400">
                {maintenanceData.totalDowntimeHours} hrs
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Most Maintained</span>
              <span className="text-2xl font-black font-heading text-amber-400">
                {maintenanceData.mostMaintainedDevice}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#260D17] border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Active Incidents</span>
              <span className="text-2xl font-black font-heading text-[#D7FF00]">
                {maintenanceData.activeIncidentsCount}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Hardware Maintenance History Records
            </h3>
            <div className="space-y-2.5">
              {maintenanceData.history.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{m.device ? `${m.device.name} (${m.device.code})` : 'Console'}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                        {m.status}
                      </span>
                    </div>
                    <div className="text-slate-400 mt-0.5">{m.reason}</div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>Logged by {m.createdBy}</div>
                    <div>{new Date(m.startDate).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 9. PAYMENT LEDGER & DUES TAB ---------------- */}
      {analyticsSubTab === 'payments' && financialPayments && (
        <div className="space-y-6 animate-fadeIn">
          {/* Outstanding Balances List */}
          {financialPayments.outstandingBookings && financialPayments.outstandingBookings.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-950/15 border border-amber-500/30 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider font-heading flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Outstanding Customer Session Balances
                </h3>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  {financialPayments.outstandingBookings.length} bookings with pending dues
                </span>
              </div>
              <div className="space-y-2">
                {financialPayments.outstandingBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{b.customerName}</span>
                        <span className="font-mono text-[10px] text-slate-500">[{b.bookingId}]</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {b.device} &bull; {b.bookingDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-amber-400">
                        Due: ₹{b.balanceRemainingRupees.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Paid: ₹{b.amountPaidRupees.toFixed(2)} / ₹{b.totalAmountRupees.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Transactions Table */}
          <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl overflow-hidden">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-heading">
              Payment Transactions Audit Ledger
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#121724] text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Receipt / ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Gateway & Method</th>
                    <th className="py-3 px-4">Amount (₹)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Staff / Channel</th>
                    <th className="py-3 px-4">Timestamp (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {financialPayments.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <div>{p.receiptNumber}</div>
                        <div className="text-[10px] text-slate-500">{p.paymentId}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">{p.customerName}</td>
                      <td className="py-3 px-4 text-slate-400">{p.purpose}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[#D7FF00]">{p.method}</span>
                        <span className="text-[10px] text-slate-500 block">{p.gateway}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        ₹{p.amountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : p.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{p.collectedBy}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(p.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 11 REPORT EXPORT MODAL ---------------- */}
      <ReportExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
};
