import React, { useState, useEffect } from 'react';
import { membershipApi } from '../../api/membership.js';
import { equipmentApi } from '../../api/equipment.js';
import { userProfileApi } from '../../api/userProfile.js';
import { reportsApi } from '../../api/reports.js';
import { authApi } from '../../api/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Crown,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Users,
  Clock,
  Tv,
  Coins,
  ShieldCheck,
  Flame,
  Banknote,
  Smartphone,
  Calendar,
  Lock,
  RotateCcw,
  Download,
  Loader2,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal.jsx';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';

export const AdminMembershipsTab = () => {
  const { user, isAdmin, isStaff } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('plans'); // 'plans', 'subscriptions', 'offline', 'usage'

  // Pagination states
  const [subPage, setSubPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);
  const [planPage, setPlanPage] = useState(1);

  // Data states
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [usages, setUsages] = useState([]);
  const [devices, setDevices] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [exportingMemberships, setExportingMemberships] = useState(false);

  const handleExportMemberships = async (format = 'xlsx') => {
    setExportingMemberships(true);
    try {
      const res = await reportsApi.downloadReport('memberships', format, { range: 'all' });
      showToast.success(`Memberships exported: ${res.fileName}`);
    } catch (err) {
      showToast.error(err.message || 'Failed to export memberships.');
    } finally {
      setExportingMemberships(false);
    }
  };

  // Reusable confirmation modal state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    onConfirm: null,
  });

  // Front-Desk Offline Upgrade state (Phase 5.1)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedSubForUpgrade, setSelectedSubForUpgrade] = useState(null);
  const [eligibleUpgradePlans, setEligibleUpgradePlans] = useState([]);
  const [selectedTargetPlanId, setSelectedTargetPlanId] = useState('');
  const [upgradeQuote, setUpgradeQuote] = useState(null);
  const [upgradeQuoteLoading, setUpgradeQuoteLoading] = useState(false);
  const [upgradePaymentMethod, setUpgradePaymentMethod] = useState('CASH');
  const [upgradeTxnRef, setUpgradeTxnRef] = useState('');
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);

  // Create / Edit Plan Modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    priceInRupees: '',
    validityDuration: 30,
    validityUnit: 'DAYS',
    isUnlimited: false,
    dailyUsageLimit: 120, // 2h
    maximumSessionDuration: 120,
    maximumBookingsPerDay: 2,
    advanceBookingLimit: 7,
    includesExclusiveGames: false,
    discountPercentage: 100,
    status: 'ACTIVE',
  });
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // Manage Subscription Modal state
  const [manageSubModalOpen, setManageSubModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [subManageForm, setSubManageForm] = useState({
    status: '',
    extendDays: 0,
    notes: '',
  });
  const [subManaging, setSubManaging] = useState(false);

  // Offline Membership Desk state
  const [offlineForm, setOfflineForm] = useState({
    customerPhone: '',
    customerId: '',
    customerName: '',
    planId: '',
    amount: '',
    paymentMethod: 'CASH',
    transactionReference: '',
    notes: '',
  });
  const [offlineCustomerSearching, setOfflineCustomerSearching] = useState(false);
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [plansRes, subsRes, usageRes, devRes, gmRes] = await Promise.all([
        membershipApi.getAdminPlans(),
        membershipApi.getAdminSubscriptions(`status=${statusFilter}&planId=${planFilter}&search=${searchQuery}`),
        membershipApi.getAdminUsage(),
        equipmentApi.getDevices('status=ACTIVE'),
        equipmentApi.getGames('status=ACTIVE'),
      ]);

      if (plansRes.success) setPlans(plansRes.data.plans || []);
      if (subsRes.success) setSubscriptions(subsRes.data.subscriptions || []);
      if (usageRes.success) setUsages(usageRes.data.usages || []);
      if (devRes.success) setDevices(devRes.data.devices || []);
      if (gmRes.success) setGames(gmRes.data.games || []);
    } catch (err) {
      setActionError(err.message || 'Failed to fetch membership records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [statusFilter, planFilter]);

  // Handle Create / Edit Plan Submit
  const handleSavePlan = async (e) => {
    e.preventDefault();
    setPlanSubmitting(true);
    setActionError('');
    try {
      if (editingPlan) {
        const res = await membershipApi.updateAdminPlan(editingPlan._id, planForm);
        if (res.success) {
          showToast.success(`Plan '${res.data.plan.name}' updated successfully!`);
          setActionSuccess(`Plan '${res.data.plan.name}' updated successfully!`);
        }
      } else {
        const res = await membershipApi.createAdminPlan(planForm);
        if (res.success) {
          showToast.success(`Plan '${res.data.plan.name}' created successfully!`);
          setActionSuccess(`Plan '${res.data.plan.name}' created successfully!`);
        }
      }
      setPlanModalOpen(false);
      setEditingPlan(null);
      fetchAllData();
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      showToast.error(err.message || 'Failed to save membership plan');
      setActionError(err.message || 'Failed to save membership plan');
    } finally {
      setPlanSubmitting(false);
    }
  };

  // Open Edit Plan
  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description,
      priceInRupees: plan.price / 100,
      validityDuration: plan.validityDuration,
      validityUnit: plan.validityUnit,
      isUnlimited: plan.isUnlimited,
      dailyUsageLimit: plan.dailyUsageLimit,
      maximumSessionDuration: plan.maximumSessionDuration,
      maximumBookingsPerDay: plan.maximumBookingsPerDay,
      advanceBookingLimit: plan.advanceBookingLimit,
      includesExclusiveGames: plan.includesExclusiveGames,
      discountPercentage: plan.discountPercentage,
      status: plan.status,
    });
    setPlanModalOpen(true);
  };

  // Delete / Deactivate Plan
  const handleDeletePlan = (plan) => {
    setConfirmState({
      isOpen: true,
      title: 'Deactivate / Remove Plan',
      message: `Are you sure you want to deactivate or remove plan '${plan.name}'? Existing subscribers will retain their benefits until expiration.`,
      confirmText: 'Deactivate Plan',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await membershipApi.deleteAdminPlan(plan._id);
          if (res.success) {
            showToast.success(res.message || 'Plan deactivated/removed');
            setActionSuccess(res.message || 'Plan deleted or transitioned to INACTIVE');
            fetchAllData();
          }
        } catch (err) {
          showToast.error(err.message || 'Failed to delete plan');
          setActionError(err.message || 'Failed to delete plan');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Open Subscription Manage Modal
  const handleOpenManageSub = (sub) => {
    setSelectedSub(sub);
    setSubManageForm({
      status: sub.status,
      extendDays: 0,
      notes: '',
    });
    setManageSubModalOpen(true);
  };

  // Submit Manage Subscription
  const handleSaveManageSub = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;
    setSubManaging(true);
    setActionError('');
    try {
      const res = await membershipApi.updateAdminSubscription(selectedSub._id, subManageForm);
      if (res.success) {
        showToast.success(`Subscription ${selectedSub.subscriptionId} updated successfully!`);
        setActionSuccess(`Subscription ${selectedSub.subscriptionId} updated successfully!`);
        setManageSubModalOpen(false);
        setSelectedSub(null);
        fetchAllData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to update subscription');
      setActionError(err.message || 'Failed to update subscription');
    } finally {
      setSubManaging(false);
    }
  };

  // Front-Desk Offline Upgrade Handlers
  const handleOpenOfflineUpgrade = async (sub) => {
    setSelectedSubForUpgrade(sub);
    setSelectedTargetPlanId('');
    setUpgradeQuote(null);
    setUpgradePaymentMethod('CASH');
    setUpgradeTxnRef('');
    setUpgradeModalOpen(true);
    try {
      const customerId = sub.customer?._id || sub.customer;
      const res = await membershipApi.getEligibleUpgrades(customerId);
      if (res.success && res.data) {
        setEligibleUpgradePlans(res.data.eligiblePlans || []);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to fetch eligible upgrade plans');
    }
  };

  const handleSelectUpgradeTarget = async (planId) => {
    setSelectedTargetPlanId(planId);
    if (!planId) {
      setUpgradeQuote(null);
      return;
    }
    setUpgradeQuoteLoading(true);
    try {
      const customerId = selectedSubForUpgrade?.customer?._id || selectedSubForUpgrade?.customer;
      const res = await membershipApi.getUpgradeQuote(planId, customerId);
      if (res.success && res.data) {
        setUpgradeQuote(res.data);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to calculate upgrade quote');
    } finally {
      setUpgradeQuoteLoading(false);
    }
  };

  const handleSubmitOfflineUpgrade = async (e) => {
    e.preventDefault();
    if (!selectedSubForUpgrade || !selectedTargetPlanId) return;
    setUpgradeSubmitting(true);
    try {
      const customerId = selectedSubForUpgrade?.customer?._id || selectedSubForUpgrade?.customer;
      const res = await membershipApi.offlineUpgrade({
        customerId,
        targetPlanId: selectedTargetPlanId,
        paymentMethod: upgradePaymentMethod,
        transactionReference: upgradeTxnRef,
        notes: `Front-desk offline upgrade processed by ${user?.name || 'Staff'}`,
      });

      if (res.success) {
        showToast.success(`Membership upgraded to ${res.data.newSubscription?.membershipPlan?.name || 'new plan'}!`);
        setActionSuccess(`Membership upgraded successfully!`);
        setUpgradeModalOpen(false);
        setSelectedSubForUpgrade(null);
        fetchAllData();
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to process offline upgrade');
      setActionError(err.message || 'Failed to process offline upgrade');
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  // Search Customer for Offline Desk
  const handleSearchCustomerForOffline = async () => {
    if (!offlineForm.customerPhone) return;
    setOfflineCustomerSearching(true);
    try {
      const data = await authApi.searchCustomerByPhone(offlineForm.customerPhone.trim());
      if (data?.data?.user) {
        setOfflineForm({
          ...offlineForm,
          customerId: data.data.user._id,
          customerName: `${data.data.user.name} (${data.data.user.customerId || 'Customer'})`,
        });
      } else {
        setActionError('Customer not found with this mobile number');
      }
    } catch (err) {
      setActionError(err.message || 'Error searching customer');
    } finally {
      setOfflineCustomerSearching(false);
    }
  };

  // Submit Offline Membership Desk
  const handleSubmitOfflineMembership = async (e) => {
    e.preventDefault();
    if (!offlineForm.customerId || !offlineForm.planId || !offlineForm.amount) {
      setActionError('Please find customer, select a plan, and enter collection amount.');
      return;
    }
    setOfflineSubmitting(true);
    setActionError('');
    try {
      const res = await membershipApi.recordOfflinePurchase({
        customerId: offlineForm.customerId,
        planId: offlineForm.planId,
        amount: Number(offlineForm.amount),
        paymentMethod: offlineForm.paymentMethod,
        transactionReference: offlineForm.transactionReference,
        notes: offlineForm.notes,
      });

      if (res.success) {
        showToast.success(
          `Membership activated for ${offlineForm.customerName}! Subscription: ${res.data.subscription.subscriptionId}`
        );
        setActionSuccess(
          `Membership activated for ${offlineForm.customerName}! Subscription: ${res.data.subscription.subscriptionId}`
        );
        setOfflineForm({
          customerPhone: '',
          customerId: '',
          customerName: '',
          planId: '',
          amount: '',
          paymentMethod: 'CASH',
          transactionReference: '',
          notes: '',
        });
        fetchAllData();
        setActiveSubTab('subscriptions');
        setTimeout(() => setActionSuccess(''), 6000);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to register offline membership');
      setActionError(err.message || 'Failed to register offline membership');
    } finally {
      setOfflineSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
            Customer Loyalty & Club Subscriptions
          </span>
          <h2 className="text-2xl font-black font-heading text-white">
            MEMBERSHIP MANAGEMENT SYSTEM
          </h2>
          <p className="text-xs text-slate-400">
            Create monthly plans, unlimited passes with fair-use daily caps, track active subscriptions, and collect counter membership payments.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Memberships */}
          <button
            onClick={() => handleExportMemberships('xlsx')}
            disabled={exportingMemberships}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold font-heading uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Export all memberships to Excel (.xlsx)"
          >
            {exportingMemberships ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D7FF00]" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#D7FF00]" />
            )}
            Export Excel
          </button>
          <button
            onClick={() => handleExportMemberships('csv')}
            disabled={exportingMemberships}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold font-heading uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Export memberships to CSV"
          >
            CSV
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setEditingPlan(null);
                setPlanForm({
                  name: '',
                  description: '',
                  priceInRupees: '',
                  validityDuration: 30,
                  validityUnit: 'DAYS',
                  isUnlimited: false,
                  dailyUsageLimit: 120,
                  maximumSessionDuration: 120,
                  maximumBookingsPerDay: 2,
                  advanceBookingLimit: 7,
                  includesExclusiveGames: false,
                  discountPercentage: 100,
                  status: 'ACTIVE',
                });
                setPlanModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> Create Membership Plan
            </button>
          )}

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            title="Refresh memberships"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-heading font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveSubTab('plans')}
          className={`pb-3 transition-all border-b-2 flex items-center gap-1.5 ${
            activeSubTab === 'plans'
              ? 'text-amber-400 border-amber-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4" /> Membership Plans ({plans.length})
        </button>

        <button
          onClick={() => setActiveSubTab('subscriptions')}
          className={`pb-3 transition-all border-b-2 flex items-center gap-1.5 ${
            activeSubTab === 'subscriptions'
              ? 'text-[#D7FF00] border-[#D7FF00]'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Active Subscriptions ({subscriptions.length})
        </button>

        <button
          onClick={() => setActiveSubTab('offline')}
          className={`pb-3 transition-all border-b-2 flex items-center gap-1.5 ${
            activeSubTab === 'offline'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Banknote className="w-4 h-4" /> Front Desk Cash/UPI Registration
        </button>

        <button
          onClick={() => setActiveSubTab('usage')}
          className={`pb-3 transition-all border-b-2 flex items-center gap-1.5 ${
            activeSubTab === 'usage'
              ? 'text-purple-400 border-purple-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" /> Usage Audit Logs ({usages.length})
        </button>
      </div>

      {/* ---------------- 1. SUBTAB: MEMBERSHIP PLANS ---------------- */}
      {activeSubTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isVIP = p.includesExclusiveGames;
            const isUnlim = p.isUnlimited;

            return (
              <div
                key={p._id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isVIP
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : isUnlim
                          ? 'bg-[#851B2B]/20 text-[#FFF4E8] border border-[#49202C]'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isVIP ? 'GTA 6 VIP' : isUnlim ? 'UNLIMITED' : 'STANDARD'}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold font-heading text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>

                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-2xl font-black font-heading text-white">
                      ₹{p.price / 100}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      /{p.validityDuration} {p.validityUnit?.toLowerCase()}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs font-mono text-slate-300">
                    <div>Daily Cap: {p.dailyUsageLimit ? `${p.dailyUsageLimit / 60}h/day` : 'Unlimited'}</div>
                    <div>Max Session: {p.maximumSessionDuration ? `${p.maximumSessionDuration / 60}h continuous` : 'No limit'}</div>
                    <div>Max Daily Bookings: {p.maximumBookingsPerDay}/day</div>
                    {p.includesExclusiveGames && (
                      <div className="text-amber-300 font-bold flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> Covers GTA 6
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditPlan(p)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      title="Edit Plan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(p)}
                      className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold"
                      title="Deactivate / Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- 2. SUBTAB: SUBSCRIPTIONS ---------------- */}
      {activeSubTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search by customer name, phone, email, or customer ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>

              <button
                onClick={fetchAllData}
                className="px-3 py-2 bg-[#D7FF00] text-[#171014] font-bold rounded-xl text-xs font-heading"
              >
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Subscription ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Purchase Date</th>
                  <th className="px-4 py-3">Valid Until (IST)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscriptions.slice((subPage - 1) * 10, subPage * 10).map((s) => (
                  <tr key={s._id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-[#D7FF00] font-bold">{s.subscriptionId}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="font-bold text-white block">{s.customer?.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {s.customer?.customerId} • {s.customer?.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans font-semibold text-white">
                      {s.membershipPlan?.name}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(s.purchaseDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-amber-300 font-bold">
                      {new Date(s.expirationDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : s.status === 'EXPIRED'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleOpenOfflineUpgrade(s)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs border border-amber-500/30 transition-all"
                            title="Upgrade to higher-tier membership pass"
                          >
                            Upgrade Pass
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenManageSub(s)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#FFF4E8] font-semibold text-xs"
                          >
                            Manage / Extend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-500">
                      No customer subscriptions found matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={subPage}
            totalPages={Math.ceil(subscriptions.length / 10)}
            totalItems={subscriptions.length}
            pageSize={10}
            onPageChange={setSubPage}
          />
        </div>
      )}

      {/* ---------------- 3. SUBTAB: OFFLINE DESK ---------------- */}
      {activeSubTab === 'offline' && (
        <div className="max-w-xl mx-auto p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Banknote className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold font-heading text-white">
              Front Desk Offline Membership Registration
            </h3>
          </div>

          <form onSubmit={handleSubmitOfflineMembership} className="space-y-4 text-xs">
            {/* Step 1: Find Customer */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                Step 1: Find Registered Customer (Mobile Number)
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number..."
                  value={offlineForm.customerPhone}
                  onChange={(e) => setOfflineForm({ ...offlineForm, customerPhone: e.target.value })}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleSearchCustomerForOffline}
                  disabled={offlineCustomerSearching}
                  className="px-4 py-2 bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold rounded-xl font-heading text-xs uppercase"
                >
                  {offlineCustomerSearching ? 'Searching...' : 'Find Customer'}
                </button>
              </div>

              {offlineForm.customerName && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
                  ✓ Selected: {offlineForm.customerName}
                </div>
              )}
            </div>

            {/* Step 2: Select Plan */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                Step 2: Choose Membership Pass
              </label>
              <select
                required
                value={offlineForm.planId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const pl = plans.find((x) => x._id === pId);
                  setOfflineForm({
                    ...offlineForm,
                    planId: pId,
                    amount: pl ? (pl.price / 100).toString() : '',
                  });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
              >
                <option value="">-- Select Plan --</option>
                {plans
                  .filter((p) => p.status === 'ACTIVE')
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} - ₹{p.price / 100} ({p.validityDuration} {p.validityUnit})
                    </option>
                  ))}
              </select>
            </div>

            {/* Step 3: Collection Details */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                Step 3: Payment Channel & Amount Collected (₹)
              </label>
              <input
                type="number"
                required
                min="1"
                value={offlineForm.amount}
                onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm"
              />

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOfflineForm({ ...offlineForm, paymentMethod: 'CASH' })}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold font-mono transition-all ${
                    offlineForm.paymentMethod === 'CASH'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Banknote className="w-4 h-4" /> Cash Drawer
                </button>

                <button
                  type="button"
                  onClick={() => setOfflineForm({ ...offlineForm, paymentMethod: 'COUNTER_UPI' })}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold font-mono transition-all ${
                    offlineForm.paymentMethod === 'COUNTER_UPI'
                      ? 'bg-[#851B2B]/20 border-[#D7FF00] text-[#FFF4E8]'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" /> Front Desk UPI QR
                </button>
              </div>
            </div>

            {offlineForm.paymentMethod === 'COUNTER_UPI' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  UPI UTR / Reference ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 98471928374 or UPI Txn Ref"
                  value={offlineForm.transactionReference}
                  onChange={(e) =>
                    setOfflineForm({ ...offlineForm, transactionReference: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={offlineSubmitting || !offlineForm.customerId}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {offlineSubmitting ? 'Activating Membership...' : 'Confirm Payment & Activate Membership'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------- 4. SUBTAB: USAGE AUDIT ---------------- */}
      {activeSubTab === 'usage' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Game</th>
                  <th className="px-4 py-3">Slot Time</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usages.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-[#D7FF00]">{u.usageDate}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="font-bold text-white block">{u.customer?.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {u.customer?.customerId}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-white">{u.device?.name}</td>
                    <td className="px-4 py-3 font-sans text-slate-300">{u.game?.name || 'Open Play'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {u.startTime} - {u.endTime}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{u.duration} mins</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {usages.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-500">
                      No membership usage tracked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={subPage}
            totalPages={Math.ceil(subscriptions.length / 10)}
            totalItems={subscriptions.length}
            pageSize={10}
            onPageChange={setSubPage}
          />
        </div>
      )}

      {/* ---------------- MODAL 1: CREATE / EDIT PLAN (ADMIN ONLY) ---------------- */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="m-auto w-full max-w-lg bg-[#260D17] border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold font-heading text-white">
                {editingPlan ? 'Edit Membership Plan' : 'Create New Membership Plan'}
              </h3>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Plan Name</label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g. Weekend Warrior Pass, Pro Monthly"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                <textarea
                  rows="2"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Plan benefits description..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Price (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={planForm.priceInRupees}
                    onChange={(e) => setPlanForm({ ...planForm, priceInRupees: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Validity Duration</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min="1"
                      value={planForm.validityDuration}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, validityDuration: e.target.value })
                      }
                      className="w-20 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <select
                      value={planForm.validityUnit}
                      onChange={(e) => setPlanForm({ ...planForm, validityUnit: e.target.value })}
                      className="flex-1 px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="DAYS">Days</option>
                      <option value="MONTHS">Months</option>
                      <option value="YEARS">Years</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fair Use & Limits */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Fair-Use Rules & Limits
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Daily Cap (Minutes)</label>
                    <input
                      type="number"
                      value={planForm.dailyUsageLimit}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, dailyUsageLimit: e.target.value })
                      }
                      placeholder="120 = 2 hours"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Max Continuous (Mins)</label>
                    <input
                      type="number"
                      value={planForm.maximumSessionDuration}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, maximumSessionDuration: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Bookings / Day</label>
                    <input
                      type="number"
                      value={planForm.maximumBookingsPerDay}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, maximumBookingsPerDay: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Advance Days</label>
                    <input
                      type="number"
                      value={planForm.advanceBookingLimit}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, advanceBookingLimit: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                </div>

                {/* Unlimited & GTA 6 Checkboxes */}
                <div className="pt-2 space-y-1.5 border-t border-slate-800 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.isUnlimited}
                      onChange={(e) => setPlanForm({ ...planForm, isUnlimited: e.target.checked })}
                      className="rounded text-[#D7FF00] focus:ring-0"
                    />
                    <span className="text-white font-semibold">Unlimited Membership Tier</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-amber-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={planForm.includesExclusiveGames}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, includesExclusiveGames: e.target.checked })
                      }
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span>Explicitly Covers GTA 6 & Exclusive Titles</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-heading rounded-lg uppercase"
                >
                  {planSubmitting ? 'Saving...' : 'Save Membership Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: MANAGE SUBSCRIPTION (EXTEND / SUSPEND) ---------------- */}
      {manageSubModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="m-auto w-full max-w-md bg-[#260D17] border border-[#49202C] rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold font-heading text-white">
                Manage Subscription
              </h3>
              <button
                onClick={() => setManageSubModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManageSub} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-[11px]">
                <div>Customer: {selectedSub.customer?.name} ({selectedSub.customer?.phone})</div>
                <div>Plan: {selectedSub.membershipPlan?.name}</div>
                <div>Current Expiry: {new Date(selectedSub.expirationDate).toLocaleDateString('en-IN')}</div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Subscription Status</label>
                <select
                  value={subManageForm.status}
                  onChange={(e) => setSubManageForm({ ...subManageForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Extend Validity (Extra Days)</label>
                <input
                  type="number"
                  min="0"
                  value={subManageForm.extendDays}
                  onChange={(e) =>
                    setSubManageForm({ ...subManageForm, extendDays: e.target.value })
                  }
                  placeholder="e.g. 7, 30"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Administrative Reason / Notes</label>
                <textarea
                  rows="2"
                  value={subManageForm.notes}
                  onChange={(e) => setSubManageForm({ ...subManageForm, notes: e.target.value })}
                  placeholder="Reason for extension or suspension..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManageSubModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subManaging}
                  className="px-5 py-2 bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold font-heading rounded-lg uppercase"
                >
                  {subManaging ? 'Updating...' : 'Update Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: FRONT-DESK OFFLINE UPGRADE ---------------- */}
      {upgradeModalOpen && selectedSubForUpgrade && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="m-auto w-full max-w-lg bg-[#260D17] border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold font-heading text-white">
                  Front-Desk Membership Upgrade
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOfflineUpgrade} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-[11px]">
                <div className="text-white font-bold">{selectedSubForUpgrade.customer?.name} ({selectedSubForUpgrade.customer?.phone})</div>
                <div className="text-slate-400">Current Plan: <span className="text-amber-400 font-bold">{selectedSubForUpgrade.membershipPlan?.name}</span></div>
                <div className="text-slate-400">Valid Until: {new Date(selectedSubForUpgrade.expirationDate).toLocaleDateString('en-IN')}</div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Select Target Higher-Tier Plan *</label>
                <select
                  required
                  value={selectedTargetPlanId}
                  onChange={(e) => handleSelectUpgradeTarget(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                >
                  <option value="">-- Select Upgrade Plan --</option>
                  {eligibleUpgradePlans.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} - ₹{p.price / 100} ({p.validityDuration} {p.validityUnit})
                    </option>
                  ))}
                </select>
                {eligibleUpgradePlans.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-400">No higher-tier active plans available for upgrade.</p>
                )}
              </div>

              {upgradeQuoteLoading && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-400 font-mono text-xs">
                  Calculating prorated credit breakdown...
                </div>
              )}

              {upgradeQuote && !upgradeQuoteLoading && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs font-mono">
                  <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">Prorated Upgrade Breakdown</div>
                  <div className="flex justify-between text-slate-300">
                    <span>Unused Credit ({upgradeQuote.breakdown.remainingDays} days remaining):</span>
                    <span className="text-emerald-400 font-bold">-₹{upgradeQuote.breakdown.unusedCreditInRupees}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>New Plan Price:</span>
                    <span>₹{upgradeQuote.breakdown.targetPriceInRupees}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-amber-500/20">
                    <span>Amount to Collect at Counter:</span>
                    <span className="text-amber-400">₹{upgradeQuote.breakdown.finalPayableInRupees}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-400 block font-heading">
                  Payment Collection Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpgradePaymentMethod('CASH')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold font-mono transition-all ${
                      upgradePaymentMethod === 'CASH'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> Cash Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpgradePaymentMethod('COUNTER_UPI')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold font-mono transition-all ${
                      upgradePaymentMethod === 'COUNTER_UPI'
                        ? 'bg-[#851B2B]/20 border-[#D7FF00] text-[#FFF4E8]'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" /> Counter UPI QR
                  </button>
                </div>
              </div>

              {upgradePaymentMethod === 'COUNTER_UPI' && (
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">UPI Transaction Reference / UTR *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 98471928374 or UPI Txn Ref"
                    value={upgradeTxnRef}
                    onChange={(e) => setUpgradeTxnRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={upgradeSubmitting || !selectedTargetPlanId || (upgradePaymentMethod === 'COUNTER_UPI' && !upgradeTxnRef)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-heading rounded-lg uppercase disabled:opacity-50"
                >
                  {upgradeSubmitting ? 'Upgrading...' : 'Confirm Counter Upgrade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger !== false}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
