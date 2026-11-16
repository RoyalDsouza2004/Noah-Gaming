import React, { useState, useEffect } from 'react';
import { userProfileApi } from '../../api/userProfile.js';
import { membershipApi } from '../../api/membership.js';
import { paymentApi } from '../../api/payment.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ReceiptModal } from '../payment/ReceiptModal.jsx';
import { MembershipPlansModal } from '../membership/MembershipPlansModal.jsx';
import { MembershipUpgradeModal } from '../membership/MembershipUpgradeModal.jsx';
import { MembershipRenewalModal } from '../membership/MembershipRenewalModal.jsx';
import { MembershipUpdateModal } from '../membership/MembershipUpdateModal.jsx';
import { ActiveSessionCountdown } from './ActiveSessionCountdown.jsx';
import { NotificationCenter } from '../notifications/NotificationCenter.jsx';
import { ConfirmModal } from '../common/ConfirmModal.jsx';
import { PushNotificationSettings } from '../notifications/PushNotificationSettings.jsx';
import ProfilePictureUpload from './ProfilePictureUpload.jsx';
import { showToast } from '../../utils/toast.js';
import {
  User,
  Users,
  Gamepad2,
  Calendar,
  Clock,
  Tv,
  Coins,
  CreditCard,
  Crown,
  Bell,
  Lock,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  Download,
  Loader2,
  Filter,
  Search,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  ShieldCheck,
  Zap,
  Sparkles,
  Flame,
  Check,
  LogOut,
  RotateCcw,
} from 'lucide-react';

export const CustomerDashboard = ({ onOpenBooking, onOpenMyBookings, onClose, initialTab = 'overview' }) => {
  const { user, refreshUser, updateUser, logout } = useAuth();

  // Tab navigation
  const [activeTab, setActiveTab] = useState(initialTab); // 'overview', 'history', 'membership', 'profile', 'payments', 'notifications'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [gamingHistory, setGamingHistory] = useState([]);
  const [historyCounts, setHistoryCounts] = useState({});
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [usages, setUsages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Filters & Loading
  const [loading, setLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'today', '7days', '1month', '6months', '1year', 'custom'
  const [statusFilter, setStatusFilter] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modals & Forms
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [selectedSubscriptionForRenewal, setSelectedSubscriptionForRenewal] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedSubscriptionForUpdate, setSelectedSubscriptionForUpdate] = useState(null);
  const [activeReceiptPaymentId, setActiveReceiptPaymentId] = useState(null);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const handleConfirmLogout = () => {
    setLogoutConfirmOpen(false);
    logout();
    if (onClose) onClose();
    window.location.hash = '#home';
    showToast.success('Logged out successfully. See you soon, Gamer!');
  };

  const handleDownloadReceiptPdf = async (paymentId) => {
    if (!paymentId) return;
    setDownloadingPaymentId(paymentId);
    try {
      const res = await paymentApi.downloadReceiptPdf(paymentId);
      showToast.success(`Receipt downloaded: ${res.fileName}`);
    } catch (err) {
      showToast.error(err.message || 'Failed to download PDF receipt.');
    } finally {
      setDownloadingPaymentId(null);
    }
  };

  // Edit Profile form
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', profilePicture: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password Form
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Fetch Dashboard & User Data
  const fetchDashboardData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [dashRes, histRes, payRes, subsRes, usageRes, notifRes] = await Promise.all([
        userProfileApi.getDashboard(),
        userProfileApi.getGamingHistory(`filter=${historyFilter}&status=${statusFilter}${customStartDate ? `&startDate=${customStartDate}` : ''}${customEndDate ? `&endDate=${customEndDate}` : ''}`),
        userProfileApi.getPaymentHistory(),
        membershipApi.getMySubscriptions(),
        membershipApi.getMyUsage(),
        userProfileApi.getNotifications(),
      ]);

      if (dashRes.success) {
        setDashboardData(dashRes.data);
        const pic = dashRes.data.customer?.profilePicture || '';
        setProfileForm({
          name: dashRes.data.customer?.name || '',
          phone: dashRes.data.customer?.phone || '',
          profilePicture: pic,
        });
        if (pic && !user?.profilePicture && updateUser) {
          updateUser({ profilePicture: pic });
        }
      }

      if (histRes.success) {
        setGamingHistory(histRes.data.bookings || []);
        setHistoryCounts(histRes.data.counts || {});
      }

      if (payRes.success) {
        setPaymentHistory(payRes.data.payments || []);
      }

      if (subsRes.success) {
        setSubscriptions(subsRes.data.subscriptions || []);
      }

      if (usageRes.success) {
        setUsages(usageRes.data.usages || []);
      }

      if (notifRes.success) {
        setNotifications(notifRes.data.notifications || []);
        setUnreadNotifCount(notifRes.data.unreadCount || 0);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [historyFilter, statusFilter]);

  // Handle Edit Profile submit
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setActionError('');
    try {
      const res = await userProfileApi.updateProfile(profileForm);
      if (res.success) {
        setActionSuccess('Profile details successfully updated!');
        showToast.success('Profile details successfully updated!');
        if (refreshUser) await refreshUser();
        fetchDashboardData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to update profile');
      showToast.error(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Change Password submit
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setActionError('New passwords do not match');
      showToast.error('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    setActionError('');
    try {
      const res = await userProfileApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (res.success) {
        setActionSuccess('Password successfully updated!');
        showToast.success('Password successfully updated!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to change password');
      showToast.error(err.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Mark all notifications read
  const handleMarkAllNotifications = async () => {
    try {
      await userProfileApi.markAllNotificationsRead();
      setUnreadNotifCount(0);
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      showToast.success('All notifications marked as read.');
    } catch (err) {
      console.warn('Failed to mark notifications:', err.message);
      showToast.error('Failed to mark notifications');
    }
  };

  const customer = dashboardData?.customer;
  const metrics = dashboardData?.metrics;
  const isMember = customer?.membership?.status === 'ACTIVE';

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 bg-[#0d121d] border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100 space-y-6 animate-fadeIn">
      {/* ---------------- TOP NAVIGATION BAR WITH BACK BUTTON (Phase 5.1 Fix) ---------------- */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <button
          type="button"
          onClick={activeTab !== 'overview' ? () => setActiveTab('overview') : onClose}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition-all text-xs font-semibold shadow-sm group"
          title={activeTab !== 'overview' ? 'Back to Overview' : 'Close Dashboard'}
        >
          <ArrowLeft className="w-4 h-4 text-[#D7FF00] group-hover:-translate-x-0.5 transition-transform" />
          <span>{activeTab !== 'overview' ? 'Back to Overview' : 'Back to Lounge'}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Top Banner & Customer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#851B2B] to-[#A51F35] flex items-center justify-center font-bold text-2xl text-slate-950 shadow-lg shadow-[#851B2B]/20 shrink-0 overflow-hidden border border-[#851B2B]/50 relative">
            <span className="font-heading font-black text-2xl text-slate-950">
              {customer?.name?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || 'P'}
            </span>
            {(profileForm.profilePicture || customer?.profilePicture || user?.profilePicture) && (
              <img
                src={profileForm.profilePicture || customer?.profilePicture || user?.profilePicture}
                alt={customer?.name || user?.name || 'Player Profile'}
                className="w-full h-full object-cover absolute inset-0 rounded-2xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black font-heading text-white">
                {customer?.name || 'Player Profile'}
              </h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#171014] text-[#D7FF00] border border-[#49202C]">
                {customer?.customerId || 'CUST-MEMBER'}
              </span>

              {isMember ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Crown className="w-3 h-3 text-amber-400" />
                  {customer.membership.planName}
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  STANDARD GAMER
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1">
              {customer?.email} • {customer?.phone} • Account Status:{' '}
              <span className="text-emerald-400 font-bold">ACTIVE</span>
            </p>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenBooking(null)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-[#851B2B]/20"
          >
            <Gamepad2 className="w-4 h-4" /> Book Session
          </button>

          {isMember ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const activeSub = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0];
                  setSelectedSubscriptionForUpdate(activeSub);
                  setUpdateModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold font-heading text-xs uppercase tracking-wider"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D7FF00]" /> Manage & Update
              </button>
              <button
                onClick={() => {
                  const activeSub = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0];
                  setSelectedSubscriptionForRenewal(activeSub);
                  setRenewalModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#851B2B] hover:bg-[#9e2033] text-[#FFF4E8] font-bold font-heading text-xs uppercase tracking-wider shadow-md shadow-[#851B2B]/20"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Renew
              </button>
              <button
                onClick={() => setUpgradeModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Upgrade
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPlansModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
            >
              <Crown className="w-4 h-4" /> Membership Passes
            </button>
          )}
        </div>
      </div>

      {/* Notifications Banner */}
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

      {/* ---------------- LIVE ACTIVE GAMING SESSION COUNTDOWN WIDGET (Phase 8) ---------------- */}
      <ActiveSessionCountdown customerUser={user} />

      {/* ---------------- METRICS OVERVIEW CARDS ---------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] uppercase font-mono tracking-wider">Total Gaming Sessions</span>
            <Gamepad2 className="w-4 h-4 text-[#D7FF00]" />
          </div>
          <div className="text-2xl font-black font-heading text-white">
            {metrics?.totalGamingSessions || 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Completed & upcoming</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] uppercase font-mono tracking-wider">Upcoming Bookings</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-heading text-white">
            {metrics?.upcomingBookingsCount || 0}
          </div>
          <div className="text-[10px] text-[#D7FF00] font-mono">Ready to play</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] uppercase font-mono tracking-wider">Daily Gaming Allowance</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-heading text-amber-400">
            {isMember ? `${customer.membership.dailyRemainingHours}h` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {isMember ? `${customer.membership.dailyRemainingMinutes} mins left today` : 'Standard rates apply'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] uppercase font-mono tracking-wider">Total Spent</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-heading text-emerald-400">
            ₹{metrics?.totalSpentRupees || 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Verified lifetime transactions</div>
        </div>
      </div>

      {/* ---------------- NAVIGATION TABS ---------------- */}
      <div className="flex overflow-x-auto p-1.5 rounded-xl bg-slate-950 border border-slate-800 gap-1 scrollbar-none text-xs font-heading font-bold uppercase tracking-wider">
        {[
          { id: 'overview', label: 'Overview', icon: Zap },
          { id: 'history', label: `Gaming History (${gamingHistory.length})`, icon: Gamepad2 },
          { id: 'membership', label: `Club Membership (${subscriptions.length})`, icon: Crown },
          { id: 'payments', label: `Payment History (${paymentHistory.length})`, icon: CreditCard },
          { id: 'profile', label: 'Profile & Security', icon: User },
          {
            id: 'notifications',
            label: `Notifications ${unreadNotifCount > 0 ? `(${unreadNotifCount})` : ''}`,
            icon: Bell,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---------------- 1. TAB: OVERVIEW ---------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Membership Status Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold font-heading text-white">Membership Details</h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isMember
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {customer?.membership?.status || 'NO ACTIVE PLAN'}
                </span>
              </div>

              {isMember ? (
                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Active Plan:</span>
                    <span className="text-white font-bold">{customer.membership.planName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Expires On (IST):</span>
                    <span className="text-[#D7FF00]">{customer.membership.expiresAtIST || 'Ongoing'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Remaining Daily Allowance:</span>
                    <span className="text-emerald-400 font-bold">{customer.membership.dailyRemainingHours} Hours</span>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const activeSub = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0];
                        setSelectedSubscriptionForUpdate(activeSub);
                        setUpdateModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-heading text-xs uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D7FF00]" /> Update & Details
                    </button>
                    <button
                      onClick={() => {
                        const activeSub = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0];
                        setSelectedSubscriptionForRenewal(activeSub);
                        setRenewalModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#851B2B] hover:bg-[#9e2033] text-[#FFF4E8] font-bold font-heading text-xs uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Renew
                    </button>
                    <button
                      onClick={() => setUpgradeModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> Upgrade
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    You currently have no active membership. Unlock daily free gaming hours on PS5 & Pool Table!
                  </p>
                  <button
                    onClick={() => setPlansModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
                  >
                    View Club Membership Plans
                  </button>
                </div>
              )}
            </div>

            {/* Next Upcoming Booking */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#D7FF00]" />
                  <h3 className="text-base font-bold font-heading text-white">Next Upcoming Session</h3>
                </div>
                {onOpenMyBookings && (
                  <button
                    onClick={onOpenMyBookings}
                    className="text-xs text-[#D7FF00] hover:text-[#FFF4E8] font-semibold"
                  >
                    View All
                  </button>
                )}
              </div>

              {dashboardData?.upcomingBookings?.length > 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-[#49202C] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-white font-bold text-sm font-heading">
                    <span>{dashboardData.upcomingBookings[0].device?.name}</span>
                    <span className="text-[#D7FF00]">{dashboardData.upcomingBookings[0].bookingId}</span>
                  </div>
                  <div className="text-slate-300 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#D7FF00]" />
                    <span>{dashboardData.upcomingBookings[0].bookingDate}</span>
                    <Clock className="w-3.5 h-3.5 text-[#D7FF00] ml-2" />
                    <span>
                      {dashboardData.upcomingBookings[0].startTime} – {dashboardData.upcomingBookings[0].endTime}
                    </span>
                  </div>
                  <div className="text-slate-400 flex justify-between pt-1 border-t border-slate-800">
                    <span>Title: {dashboardData.upcomingBookings[0].game?.name || 'Open Library'}</span>
                    <span className="text-emerald-400 font-bold">
                      {dashboardData.upcomingBookings[0].paymentStatus}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-xs text-slate-500">No upcoming gaming sessions reserved.</p>
                  <button
                    onClick={() => onOpenBooking(null)}
                    className="px-4 py-2 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider"
                  >
                    Book a Station Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recent Gameplay Activity */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold font-heading text-white uppercase tracking-wider">
              Recent Gaming Sessions
            </h3>

            <div className="divide-y divide-slate-800 text-xs">
              {dashboardData?.recentBookings?.slice(0, 4).map((b) => (
                <div key={b._id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{b.device?.name}</span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      {b.bookingDate} ({b.startTime} - {b.endTime}) • {b.bookingType}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 block">
                      ₹{b.totalAmount / 100}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        b.paymentStatus === 'PAID'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {b.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 2. TAB: GAMING HISTORY ---------------- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            {/* Date Range Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Date Range:
              </span>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '1month', label: '1 Month' },
                { id: '6months', label: '6 Months' },
                { id: '1year', label: '1 Year' },
                { id: 'custom', label: 'Custom Range' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setHistoryFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    historyFilter === f.id
                      ? 'bg-[#851B2B] text-[#FFF4E8] font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ACTIVE">Currently Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Custom Date Inputs if custom selected */}
          {historyFilter === 'custom' && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs">
              <label className="text-slate-400">Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white"
              />
              <label className="text-slate-400">End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white"
              />
              <button
                onClick={fetchDashboardData}
                className="px-3 py-1 bg-[#851B2B] text-[#FFF4E8] font-bold rounded"
              >
                Apply Range
              </button>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-3">
            {gamingHistory.map((b) => (
              <div
                key={b._id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-[#D7FF00]">{b.bookingId}</span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.bookingStatus === 'CONFIRMED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : b.bookingStatus === 'CANCELLED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {b.bookingStatus}
                    </span>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300">
                      {b.bookingType}
                    </span>

                    {b.membershipApplied && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-400" /> Club Member Benefit
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-white font-heading">
                    {b.game?.name ? `${b.game.name} • ${b.device?.name || 'Station'}` : (b.device?.name || 'Gaming Station')}
                  </h4>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#D7FF00]" /> {b.bookingDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#D7FF00]" /> {b.startTime} - {b.endTime} ({b.duration}h)
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#D7FF00]" /> {b.numberOfPlayers || 1} Player(s)
                    </span>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-500 block">Total Amount</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      ₹{((b.totalAmount || 0) / 100).toLocaleString()}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.paymentStatus === 'PAID'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : b.paymentStatus === 'PARTIALLY_PAID'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    PAYMENT: {b.paymentStatus}
                  </span>
                </div>
              </div>
            ))}

            {gamingHistory.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                No gaming sessions found matching selected filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 3. TAB: MEMBERSHIP & PASSES ---------------- */}
      {activeTab === 'membership' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold font-heading text-white">Your Club Subscriptions</h3>
              <p className="text-xs text-slate-400">View active membership status, renew, or upgrade to a higher tier with prorated credit.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isMember && (
                <button
                  onClick={() => setUpgradeModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-heading text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <TrendingUp className="w-4 h-4" /> Upgrade Membership
                </button>
              )}
              <button
                onClick={() => setPlansModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold font-heading text-xs uppercase tracking-wider"
              >
                Browse All Plans
              </button>
            </div>
          </div>

          {/* Subscriptions List */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono min-w-[650px]">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Subscription ID</th>
                  <th className="px-4 py-3">Plan Name</th>
                  <th className="px-4 py-3">Purchase Date</th>
                  <th className="px-4 py-3">Valid Until (IST)</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscriptions.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-[#D7FF00] font-bold">{s.subscriptionId}</td>
                    <td className="px-4 py-3 font-sans font-semibold text-white">
                      {s.membershipPlan?.name}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(s.purchaseDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-amber-300 font-bold">
                      {new Date(s.expirationDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">
                      ₹{(s.membershipPlan?.price || 0) / 100}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : s.status === 'UPGRADED'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
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
                        <button
                          onClick={() => {
                            setSelectedSubscriptionForUpdate(s);
                            setUpdateModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold text-xs flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-[#D7FF00]" /> Details
                        </button>
                        {s.status === 'ACTIVE' && (
                          <button
                            onClick={() => setUpgradeModalOpen(true)}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-semibold text-xs flex items-center gap-1"
                          >
                            <TrendingUp className="w-3 h-3" /> Upgrade
                          </button>
                        )}
                        {s.membershipPlan?.renewalEnabled && (
                          <button
                            onClick={() => {
                              setSelectedSubscriptionForRenewal(s);
                              setRenewalModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-[#851B2B]/25 hover:bg-[#851B2B]/35 text-[#FFF4E8] rounded font-semibold text-xs flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Renew
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                      No membership subscriptions found. Choose a membership plan to unlock gaming perks!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Membership Usage Log */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold font-heading text-white uppercase tracking-wider">
              Membership Usage History
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3">Game</th>
                    <th className="px-4 py-3">Time Interval</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usages.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3 text-[#D7FF00]">{u.usageDate}</td>
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
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                        No usage logged under active membership yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. TAB: PAYMENT HISTORY ---------------- */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Receipt / Payment ID</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date (IST)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paymentHistory.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#D7FF00] block">{p.receiptNumber}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{p.paymentId}</span>
                    </td>
                    <td className="px-4 py-3 font-sans text-white">{p.paymentPurpose}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400 text-sm">
                      ₹{p.amount / 100}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.paymentStatus === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIALLY_REFUNDED' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveReceiptPaymentId(p.paymentId || p._id)}
                            className="px-2 py-1 bg-[#851B2B]/20 hover:bg-[#851B2B]/35 text-[#FFF4E8] font-semibold rounded text-xs flex items-center gap-1 transition-colors"
                            title="View Digital Receipt"
                          >
                            <FileText className="w-3 h-3 text-[#D7FF00]" /> View
                          </button>
                          <button
                            onClick={() => handleDownloadReceiptPdf(p.paymentId || p._id)}
                            disabled={downloadingPaymentId === (p.paymentId || p._id)}
                            className="px-2 py-1 bg-[#D7FF00]/15 hover:bg-[#D7FF00]/25 text-[#D7FF00] font-semibold rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                            title="Download PDF Receipt"
                          >
                            {downloadingPaymentId === (p.paymentId || p._id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            PDF
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {paymentHistory.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                      No payment transactions on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- 5. TAB: PROFILE & SECURITY ---------------- */}
      {activeTab === 'profile' && (
        <div className="space-y-6 pb-16 sm:pb-10">
          {/* Cloudinary Profile Photo Manager */}
          <ProfilePictureUpload
            initialPicture={customer?.profilePicture || profileForm.profilePicture || user?.profilePicture}
            onUploadSuccess={(url) => {
              setProfileForm((prev) => ({ ...prev, profilePicture: url }));
              setDashboardData((prev) =>
                prev ? { ...prev, customer: { ...prev.customer, profilePicture: url } } : prev
              );
              if (updateUser) {
                updateUser({ profilePicture: url });
              }
              if (refreshUser) {
                refreshUser();
              }
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Details Form */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                <User className="w-5 h-5 text-[#D7FF00]" />
                Edit Personal Information
              </h3>

              <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Unique Customer ID</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={customer?.customerId || ''}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Email Address (Locked)</label>
                  <input
                    type="email"
                    readOnly
                    disabled
                    value={customer?.email || ''}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Avatar / Profile Picture URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profileForm.profilePicture}
                    onChange={(e) => setProfileForm({ ...profileForm, profilePicture: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-5 py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider"
                  >
                    {profileSaving ? 'Saving Changes...' : 'Save Profile Details'}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" />
                Security & Password
              </h3>

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-purple-500/20"
                  >
                    {passwordSaving ? 'Updating Password...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Web Push Notification Settings */}
          <PushNotificationSettings />

          {/* Dedicated Account Session & Logout Section */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#260D17]/85 border border-[#851B2B]/50 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#851B2B]/30 border border-[#851B2B]/60 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-[#F5B942]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-heading text-[#FFF4E8]">
                      Account Session & Access
                    </h3>
                    <p className="text-[11px] text-[#C7A5A8]">
                      Logged in as <span className="text-[#D7FF00] font-semibold">{user?.name || customer?.name}</span> ({user?.email || customer?.email || user?.phone || customer?.phone})
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#C7A5A8] pt-1 leading-relaxed">
                  Sign out of your active session on this device. You will need to sign back in with your credentials to access your profile, bookings, and club passes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(true)}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  outline: 'none',
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#851B2B]/25 hover:bg-[#851B2B]/45 text-[#F06A76] hover:text-[#FFF4E8] border border-[#851B2B]/70 font-heading font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#851B2B]/20 active:scale-95 shrink-0 self-start sm:self-auto select-none cursor-pointer"
                title="Log out of your NOAH GAMING account"
              >
                <LogOut className="w-4 h-4 text-[#F06A76]" />
                <span>Log Out of Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 6. TAB: NOTIFICATIONS ---------------- */}
      {activeTab === 'notifications' && (
        <NotificationCenter
          user={user}
          onNavigateToBooking={onOpenMyBookings}
          onNavigateToMembership={() => setPlansModalOpen(true)}
          onNavigateToProfile={(tab) => setActiveTab(tab)}
          onUnreadCountChange={(count) => setUnreadNotifCount(count)}
        />
      )}

      {/* Modal: Membership Plans Browser */}
      {plansModalOpen && (
        <MembershipPlansModal
          onClose={() => setPlansModalOpen(false)}
          onPurchaseSuccess={() => {
            setPlansModalOpen(false);
            fetchDashboardData();
          }}
        />
      )}

      {/* Modal: Membership Upgrade (Phase 5.1 Prorated Credit) */}
      {upgradeModalOpen && (
        <MembershipUpgradeModal
          onClose={() => setUpgradeModalOpen(false)}
          onUpgradeSuccess={() => {
            setUpgradeModalOpen(false);
            fetchDashboardData();
          }}
        />
      )}

      {/* Modal: Membership Renewal */}
      {renewalModalOpen && (
        <MembershipRenewalModal
          subscription={
            selectedSubscriptionForRenewal ||
            subscriptions.find((s) => s.status === 'ACTIVE') ||
            subscriptions[0]
          }
          onClose={() => {
            setRenewalModalOpen(false);
            setSelectedSubscriptionForRenewal(null);
          }}
          onRenewalSuccess={() => {
            setRenewalModalOpen(false);
            setSelectedSubscriptionForRenewal(null);
            fetchDashboardData();
            if (refreshUser) refreshUser();
          }}
        />
      )}

      {/* Modal: Membership Update & Details */}
      {updateModalOpen && (
        <MembershipUpdateModal
          subscription={
            selectedSubscriptionForUpdate ||
            subscriptions.find((s) => s.status === 'ACTIVE') ||
            subscriptions[0]
          }
          onClose={() => {
            setUpdateModalOpen(false);
            setSelectedSubscriptionForUpdate(null);
          }}
          onOpenRenewal={(sub) => {
            setSelectedSubscriptionForRenewal(sub);
            setRenewalModalOpen(true);
          }}
          onOpenUpgrade={() => {
            setUpgradeModalOpen(true);
          }}
        />
      )}

      {/* Modal: Digital Receipt View */}
      {activeReceiptPaymentId && (
        <ReceiptModal
          paymentId={activeReceiptPaymentId}
          onClose={() => setActiveReceiptPaymentId(null)}
        />
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={logoutConfirmOpen}
        title="Confirm Account Logout"
        message={`Are you sure you want to sign out, ${user?.name || customer?.name || 'Gamer'}? You will be returned to the public lounge landing page.`}
        confirmText="Log Out"
        cancelText="Stay Signed In"
        isDanger={true}
        icon={LogOut}
        onConfirm={handleConfirmLogout}
        onClose={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
};
