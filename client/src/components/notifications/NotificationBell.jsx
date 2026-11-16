import React, { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '../../api/notifications.js';
import { showToast } from '../../utils/toast.js';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Gamepad2,
  AlertTriangle,
  Crown,
  CreditCard,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export const NotificationBell = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const dropdownRef = useRef(null);

  // Poll unread count periodically
  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.getUnreadCount();
      if (res.success) {
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Quiet fail on network hiccup
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      const res = await notificationsApi.getNotifications(params);
      if (res.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.pagination?.unread || 0);
      }
    } catch (err) {
      showToast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000); // 15s check
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, categoryFilter]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await notificationsApi.markAsRead(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      showToast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await notificationsApi.markAllAsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        showToast.success('All notifications marked as read');
      }
    } catch (err) {
      showToast.error('Failed to mark all as read');
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'SESSION_STARTED':
      case 'SESSION_COMPLETED':
      case 'SESSION_EXTENDED':
        return <Gamepad2 className="w-4 h-4 text-[#D7FF00]" />;
      case 'SESSION_WARNING':
      case 'SESSION_EXPIRED':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'UPCOMING_BOOKING':
      case 'BOOKING_CONFIRMED':
        return <CheckCheck className="w-4 h-4 text-emerald-400" />;
      case 'MEMBERSHIP_ACTIVATED':
      case 'MEMBERSHIP_EXPIRING':
      case 'MEMBERSHIP_EXPIRED':
      case 'MEMBERSHIP_RENEWED':
        return <Crown className="w-4 h-4 text-purple-400" />;
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_FAILED':
      case 'PAYMENT_PENDING':
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-[#260D17] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] hover:border-[#851B2B] transition-all focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#D7FF00] text-[9px] font-black text-[#171014] font-mono shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#260D17] border border-[#49202C] shadow-2xl z-50 overflow-hidden animate-fadeIn flex flex-col max-h-[500px]">
          {/* Header */}
          <div className="p-3.5 border-b border-[#49202C] bg-[#171014] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#D7FF00]" />
              <span className="text-xs font-bold font-heading text-[#FFF4E8] uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#D7FF00]/15 text-[#D7FF00] text-[10px] font-mono font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-[#D7FF00] hover:text-[#cbf200] transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#C7A5A8] hover:text-[#FFF4E8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 p-2 bg-[#171014] border-b border-[#49202C] overflow-x-auto scrollbar-none text-[11px]">
            {['ALL', 'SESSION_WARNING', 'SESSION_STARTED', 'UPCOMING_BOOKING', 'MEMBERSHIP_EXPIRING'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-[#851B2B] text-[#FFF4E8] font-bold shadow-sm'
                    : 'bg-[#260D17] text-[#C7A5A8] hover:text-[#FFF4E8] border border-[#49202C]'
                }`}
              >
                {cat === 'ALL'
                  ? 'All'
                  : cat === 'SESSION_WARNING'
                  ? 'Timers'
                  : cat === 'SESSION_STARTED'
                  ? 'Sessions'
                  : cat === 'UPCOMING_BOOKING'
                  ? 'Bookings'
                  : 'Passes'}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto divide-y divide-slate-800/50 flex-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                <Bell className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && handleMarkAsRead(n._id, { stopPropagation: () => {} })}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-900/60 ${
                    !n.isRead ? 'bg-[#851B2B]/20' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                    {getCategoryIcon(n.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate font-heading">
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#D7FF00] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>{new Date(n.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
                      {n.deliveryChannels?.includes('WHATSAPP') && (
                        <span className="text-emerald-400 font-semibold">WhatsApp &bull; In-App</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
