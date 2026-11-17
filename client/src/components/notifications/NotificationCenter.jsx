import React, { useState, useEffect } from 'react';
import { notificationsApi } from '../../api/notifications.js';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import { PushNotificationSettings } from './PushNotificationSettings.jsx';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  Gamepad2,
  Crown,
  CreditCard,
  X,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  AlertCircle,
  Inbox,
  ArrowRight,
} from 'lucide-react';

function formatNotificationTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const timeStr = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return timeStr;
  }

  const datePart = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });

  return `${datePart}, ${timeStr}`;
}

export const NotificationCenter = ({
  user,
  onClose,
  onNavigateToBooking,
  onNavigateToMembership,
  onNavigateToProfile,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, unread: 0, page: 1, pages: 1, limit: 15 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showPushSettings, setShowPushSettings] = useState(false);

  const fetchNotifications = async (page = 1, append = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (page === 1) setLoading(true);
    else setRefreshing(true);

    try {
      const params = { page, limit: 15 };
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (unreadOnly) params.isRead = false;

      const res = await notificationsApi.getNotifications(params);
      if (res?.success) {
        const notifs = res.data?.notifications || [];
        const pag = res.data?.pagination || { total: notifs.length, unread: 0, page: 1, pages: 1 };

        if (append) {
          setNotifications((prev) => [...prev, ...notifs]);
        } else {
          setNotifications(notifs);
        }
        setPagination(pag);

        if (onUnreadCountChange && pag.unread !== undefined) {
          onUnreadCountChange(pag.unread);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1, false);
  }, [categoryFilter, unreadOnly, user]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await notificationsApi.markAsRead(id);
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: n.readAt || new Date().toISOString() } : n))
        );
        const newUnread = Math.max(0, pagination.unread - 1);
        setPagination((prev) => ({ ...prev, unread: newUnread }));
        if (onUnreadCountChange) onUnreadCountChange(newUnread);
      }
    } catch (err) {
      showToast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await notificationsApi.markAllAsRead();
      if (res?.success) {
        const now = new Date().toISOString();
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || now })));
        setPagination((prev) => ({ ...prev, unread: 0 }));
        if (onUnreadCountChange) onUnreadCountChange(0);
        showToast.success('All notifications marked as read');
      }
    } catch (err) {
      showToast.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (n) => {
    setSelectedNotification(n);
    if (!n.isRead) {
      handleMarkAsRead(n._id);
    }
  };

  const handleActionNavigate = (n) => {
    if (n.category?.includes('BOOKING') || n.relatedBooking) {
      if (onNavigateToBooking) onNavigateToBooking();
    } else if (n.category?.includes('MEMBERSHIP') || n.category?.includes('PASS')) {
      if (onNavigateToMembership) onNavigateToMembership();
    } else if (n.category?.includes('PAYMENT')) {
      if (onNavigateToProfile) onNavigateToProfile('payments');
    } else {
      if (onNavigateToProfile) onNavigateToProfile('overview');
    }
  };

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'BOOKING_CONFIRMED':
      case 'UPCOMING_BOOKING':
        return {
          icon: Calendar,
          label: 'Booking',
          color: 'text-[#45C987] bg-[#45C987]/15 border-[#45C987]/30',
        };
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_PENDING':
      case 'PAYMENT_FAILED':
        return {
          icon: CreditCard,
          label: 'Payment',
          color: 'text-[#F5B942] bg-[#F5B942]/15 border-[#F5B942]/30',
        };
      case 'MEMBERSHIP_ACTIVATED':
      case 'MEMBERSHIP_EXPIRING':
      case 'MEMBERSHIP_EXPIRED':
      case 'MEMBERSHIP_RENEWED':
        return {
          icon: Crown,
          label: 'Club Pass',
          color: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
        };
      case 'SESSION_STARTED':
      case 'SESSION_WARNING':
      case 'SESSION_EXPIRED':
      case 'SESSION_COMPLETED':
      case 'SESSION_EXTENDED':
        return {
          icon: Gamepad2,
          label: 'Game Session',
          color: 'text-[#D7FF00] bg-[#D7FF00]/15 border-[#D7FF00]/30',
        };
      default:
        return {
          icon: Bell,
          label: 'System',
          color: 'text-[#FFF4E8] bg-[#260D17] border-[#49202C]',
        };
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Alerts' },
    { id: 'BOOKING_CONFIRMED', label: 'Bookings' },
    { id: 'PAYMENT_CONFIRMED', label: 'Payments' },
    { id: 'SESSION_STARTED', label: 'Sessions' },
    { id: 'MEMBERSHIP_ACTIVATED', label: 'Memberships' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col bg-[#171014] border border-[#49202C] rounded-2xl shadow-xl text-[#FFF4E8] overflow-hidden">
      {/* 1. Compact Header */}
      <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#260D17] border-b border-[#49202C] flex items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#851B2B] to-[#A51F35] flex items-center justify-center font-bold shadow-md shadow-[#851B2B]/20 border border-[#851B2B]/60 shrink-0">
            <Bell className="w-4 h-4 text-[#D7FF00]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black font-heading text-[#FFF4E8] tracking-wider uppercase truncate">
                Notification Center
              </h2>
              {pagination.unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#D7FF00] text-[#171014] text-[9px] font-black font-mono shadow-sm shrink-0">
                  {pagination.unread} NEW
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#C7A5A8] truncate">
              Live alerts for bookings, game sessions, payments & club passes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPushSettings((prev) => !prev)}
            className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1 whitespace-nowrap shadow-sm ${
              showPushSettings
                ? 'bg-[#851B2B] text-white border-[#A51F35]'
                : 'bg-[#260D17] hover:bg-[#851B2B]/30 border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8]'
            }`}
            title="Configure browser push notifications"
          >
            <BellRing className="w-3 h-3 text-[#D7FF00]" />
            <span className="hidden sm:inline">Push Alerts</span>
          </button>

          {pagination.unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg bg-[#260D17] hover:bg-[#851B2B]/40 border border-[#49202C] hover:border-[#851B2B] text-[11px] font-semibold text-[#D7FF00] transition-colors flex items-center gap-1 whitespace-nowrap shadow-sm"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3 h-3" />
              <span className="hidden sm:inline">Mark All Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchNotifications(1, false)}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#260D17] hover:bg-[#381322] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] flex items-center justify-center transition-colors shrink-0"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#260D17] hover:bg-[#851B2B]/30 border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] flex items-center justify-center transition-colors shrink-0"
              title="Close notification center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Push Notification Quick Settings Panel */}
      {showPushSettings && (
        <div className="p-2.5 sm:p-3 bg-[#140b11] border-b border-[#49202C] animate-fadeIn">
          <PushNotificationSettings compact={true} />
        </div>
      )}

      {/* 2. Compact Filter Bar */}
      <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#171014] border-b border-[#49202C] flex items-center justify-between gap-2 text-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                categoryFilter === c.id
                  ? 'bg-[#851B2B] text-[#FFF4E8] font-bold shadow-sm border border-[#A51F35]'
                  : 'bg-[#260D17] text-[#C7A5A8] hover:text-[#FFF4E8] border border-[#49202C]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Unread Toggle */}
        <button
          type="button"
          onClick={() => setUnreadOnly((prev) => !prev)}
          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-all shrink-0 ${
            unreadOnly
              ? 'bg-[#D7FF00]/15 text-[#D7FF00] border-[#D7FF00]/40 font-bold'
              : 'bg-[#260D17] text-[#C7A5A8] border-[#49202C] hover:text-[#FFF4E8]'
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>Unread Only</span>
        </button>
      </div>

      {/* 3. Compact Space-Efficient Notification List */}
      <div className="p-2 sm:p-3 space-y-1 sm:space-y-1.5 max-h-[64vh] overflow-y-auto flex-1">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#C7A5A8] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#D7FF00]" />
            <span>Loading notifications...</span>
          </div>
        ) : !user ? (
          /* Unauthenticated State */
          <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#260D17] border border-[#49202C] flex items-center justify-center mb-2.5 text-[#D7FF00] shadow-inner">
              <Bell className="w-5 h-5 text-[#D7FF00]" />
            </div>
            <h3 className="text-xs font-bold font-heading text-[#FFF4E8]">
              Sign In to View Notifications
            </h3>
            <p className="text-[11px] text-[#C7A5A8] max-w-sm mt-0.5">
              Please sign in to access your alerts for bookings, game sessions, payments, and club passes.
            </p>
          </div>
        ) : notifications.length === 0 ? (
          /* Empty State */
          <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#260D17] border border-[#49202C] flex items-center justify-center mb-2 text-[#851B2B] shadow-inner">
              <Inbox className="w-5 h-5 text-[#C7A5A8]/50" />
            </div>
            <h3 className="text-xs font-bold font-heading text-[#FFF4E8]">
              {unreadOnly ? 'No Unread Notifications' : 'All Caught Up!'}
            </h3>
            <p className="text-[11px] text-[#C7A5A8] max-w-sm mt-0.5">
              {unreadOnly
                ? 'You have read all current notifications.'
                : 'No alerts right now. Confirmation messages and session timers will appear here in real time.'}
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const cat = getCategoryBadge(n.category);
            const CatIcon = cat.icon;

            return (
              <div
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 sm:gap-3 group relative ${
                  !n.isRead
                    ? 'bg-[#260D17] border-[#851B2B] shadow-sm hover:border-[#A51F35]'
                    : 'bg-[#171014] border-[#49202C]/40 hover:bg-[#260D17]/40 text-[#C7A5A8]'
                }`}
              >
                {/* Category Icon */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${cat.color}`}
                >
                  <CatIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs sm:text-[13px] font-bold font-heading truncate ${!n.isRead ? 'text-[#FFF4E8]' : 'text-[#C7A5A8]'} group-hover:text-[#D7FF00] transition-colors`}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D7FF00] shrink-0 animate-pulse" title="Unread" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#C7A5A8]/75 font-mono shrink-0 whitespace-nowrap">
                      {formatNotificationTime(n.createdAt)}
                    </span>
                  </div>

                  <p className={`text-[11.5px] sm:text-xs line-clamp-1 sm:line-clamp-2 mt-0.5 leading-snug ${!n.isRead ? 'text-[#FFF4E8]/90' : 'text-[#C7A5A8]/80'}`}>
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-[#49202C]/30 text-[10px]">
                    <span className="text-[#C7A5A8]/70 font-mono">
                      {new Date(n.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}
                    </span>

                    <div className="flex items-center gap-2.5">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(n._id, e)}
                          className="text-[10.5px] font-semibold text-[#D7FF00] hover:text-[#cbf200] transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Mark read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionNavigate(n);
                        }}
                        className="text-[10.5px] font-semibold text-[#C7A5A8] hover:text-[#FFF4E8] flex items-center gap-0.5"
                      >
                        View <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Real Pagination */}
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          onPageChange={(p) => fetchNotifications(p, false)}
          className="mt-2"
        />
      </div>

      {/* 4. Details Modal if selected */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-4 sm:p-5 bg-[#260D17] border border-[#851B2B] rounded-2xl shadow-2xl text-[#FFF4E8] space-y-3">
            <div className="flex items-center justify-between border-b border-[#49202C] pb-2.5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#D7FF00]" />
                <span className="text-xs font-bold font-heading uppercase text-[#F5B942]">
                  Notification Details
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="text-[#C7A5A8] hover:text-[#FFF4E8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#FFF4E8] font-heading">
                {selectedNotification.title}
              </h3>
              <p className="text-xs text-[#FFF4E8]/90 mt-1.5 leading-relaxed bg-[#171014] p-2.5 rounded-xl border border-[#49202C]">
                {selectedNotification.message}
              </p>
            </div>

            <div className="space-y-1 text-xs text-[#C7A5A8] font-mono bg-[#171014]/60 p-2.5 rounded-xl border border-[#49202C]/60">
              <div className="flex justify-between">
                <span>Received At:</span>
                <span className="text-[#FFF4E8]">
                  {new Date(selectedNotification.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </span>
              </div>
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="text-[#D7FF00] font-bold">{selectedNotification.category}</span>
              </div>
              {selectedNotification.relatedBooking && (
                <div className="flex justify-between">
                  <span>Booking Reference:</span>
                  <span className="text-[#F5B942]">
                    {selectedNotification.relatedBooking.bookingId || selectedNotification.relatedBooking}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#49202C]">
              <button
                type="button"
                onClick={() => {
                  const n = selectedNotification;
                  setSelectedNotification(null);
                  handleActionNavigate(n);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#851B2B] hover:bg-[#A51F35] text-[#FFF4E8] text-xs font-bold font-heading uppercase flex items-center gap-1.5 shadow-md shadow-[#851B2B]/30"
              >
                <span>Navigate to Target</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
