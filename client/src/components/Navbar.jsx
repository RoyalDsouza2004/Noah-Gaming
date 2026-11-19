import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePwa } from '../context/PwaContext.jsx';
import { scheduleApi } from '../api/schedule.js';
import {
  Gamepad2,
  Sparkles,
  Download,
  LogOut,
  User,
  Shield,
  Activity,
  Bell,
  LayoutDashboard,
} from 'lucide-react';

export const Navbar = ({
  onOpenBooking,
  onOpenReceptionistDashboard,
  onOpenAdminDashboard,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0,
  activeNav = 'home',
}) => {
  const { user, isAuthenticated, logout, openLoginModal, openRegisterModal, isAdmin, isReceptionist } = useAuth();
  const { isInstalled, triggerInstall } = usePwa();
  const [operatingStatus, setOperatingStatus] = useState(null);

  useEffect(() => {
    scheduleApi.getOperatingStatus()
      .then((res) => {
        if (res?.success && res.data) setOperatingStatus(res.data);
      })
      .catch(() => {});
  }, []);

  const getPageTitle = (nav) => {
    switch (nav) {
      case 'equipment':
        return 'Gaming Equipment & Consoles';
      case 'pricing':
        return 'Pricing, Rates & Rules';
      case 'passes':
        return 'NOAH Club Passes & Memberships';
      case 'bookings':
        return 'My Booking Reservations';
      case 'notifications':
        return 'Notification Center';
      case 'profile':
        return 'Player Profile & History';
      case 'receptionist':
        return 'Front Desk POS Command';
      case 'admin':
        return 'Administrator Management Suite';
      default:
        return 'Bajagoli Premier Gaming Lounge';
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-16 z-30 bg-white/95 dark:bg-[#171014]/95 backdrop-blur-md border-b border-[#E2E5EC] dark:border-[#49202C] transition-colors duration-200">
      <div className="w-full h-full px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* ========================================================= */}
        {/* LEFT: Mobile Logo (Mobile only) or Active Section (Desktop) */}
        {/* ========================================================= */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          {/* Mobile Logo: visible only on mobile (md:hidden) */}
          <a
            href="#home"
            style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
            className="flex md:hidden items-center gap-2 group shrink-0 focus:outline-none"
            title="NOAH GAMING Home"
          >
            <div className="w-8 h-8 xs:w-9 xs:h-9 rounded-full bg-white dark:bg-[#171014] flex items-center justify-center shadow-md shadow-[#851B2B]/20 border border-[#851B2B]/40 p-0.5 shrink-0 overflow-hidden">
              <img src="/icons/Noah_gaming_logo.svg" alt="NOAH GAMING" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="flex flex-col justify-center leading-none">
              <div className="flex items-center gap-1 leading-tight">
                <span className="text-xs xs:text-sm font-black tracking-wider text-[#171923] dark:text-[#FFF4E8] font-heading">
                  NOAH
                </span>
                <span className="text-xs xs:text-sm font-black tracking-wider text-[#851B2B] dark:text-[#D7FF00] font-heading">
                  GAMING
                </span>
              </div>
              <span className="hidden xs:block text-[8px] font-bold text-[#626B7A] dark:text-[#C7A5A8] tracking-widest uppercase mt-0.5">
                {isAdmin ? 'ADMIN' : isReceptionist ? 'FRONT DESK' : 'LOUNGE'}
              </span>
            </div>
          </a>

          {/* Desktop Active Section / Lounge Status indicator */}
          <div className="hidden md:flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#176B3A] dark:bg-[#45C987] shadow-sm shadow-[#45C987]/50 animate-pulse shrink-0" />
            <h1 className="text-xs lg:text-sm font-bold font-heading text-[#171923] dark:text-[#FFF4E8] tracking-wide truncate">
              {getPageTitle(activeNav)}
            </h1>
            <span className="hidden xl:inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#F0F2F6] dark:bg-[#260D17] border border-[#E2E5EC] dark:border-[#49202C] text-[#414858] dark:text-[#C7A5A8] font-mono">
              {(() => {
                const todayHours = operatingStatus?.todaySchedule || operatingStatus?.today;
                if (!todayHours?.openTime || !todayHours?.closeTime) return 'Open 10 AM – 11 PM';
                const format12 = (t) => {
                  const [h, m] = t.split(':').map(Number);
                  const period = h >= 12 ? 'PM' : 'AM';
                  const h12 = h % 12 === 0 ? 12 : h % 12;
                  return m > 0 ? `${h12}:${String(m).padStart(2, '0')} ${period}` : `${h12} ${period}`;
                };
                return `Open ${format12(todayHours.openTime)} – ${format12(todayHours.closeTime)}`;
              })()}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT: Actions: Notifications (mobile), Book, POS, Login  */}
        {/* ========================================================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. Mobile Top-Right Notification Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex md:hidden relative h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-[#260D17] hover:bg-[#F1F3F7] dark:hover:bg-[#381322] border border-[#E2E5EC] dark:border-[#49202C] text-[#414858] dark:text-[#C7A5A8] hover:text-[#851B2B] dark:hover:text-[#D7FF00] shadow-sm transition-colors shrink-0"
            title="Open Notification Center"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-current" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#851B2B] dark:bg-[#D7FF00] text-white dark:text-[#171014] text-[9px] font-black font-mono flex items-center justify-center shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* 2. Install App CTA (Visible on Desktop or Customer view) */}
          {!isInstalled && !isAdmin && !isReceptionist && (
            <button
              type="button"
              onClick={triggerInstall}
              className="hidden sm:flex h-9 px-2 sm:px-2.5 rounded-xl border border-[#E2E5EC] dark:border-[#49202C] bg-white dark:bg-[#260D17] hover:bg-[#F1F3F7] dark:hover:bg-[#381322] text-xs font-semibold text-[#414858] dark:text-[#C7A5A8] hover:text-[#171923] dark:hover:text-[#FFF4E8] transition-all items-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-sm shrink-0 active:scale-95"
              title="Install NOAH GAMING App to your device"
              aria-label="Install App"
            >
              <Download className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00] shrink-0" />
              <span className="text-[11px] sm:text-xs font-semibold">Install</span>
            </button>
          )}

          {/* 3. Book Session CTA (Primary High-Contrast Burgundy Brand CTA with crisp white text & icons) */}
          <button
            type="button"
            onClick={onOpenBooking}
            className={`h-9 px-2.5 sm:px-4 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-black font-heading text-xs tracking-wider uppercase transition-all shadow-md shadow-[#851B2B]/25 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] shrink-0 ${
              isAuthenticated && (isReceptionist || isAdmin) ? 'hidden sm:flex' : 'flex'
            }`}
            title="Book a gaming station session"
          >
            <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span className="hidden sm:inline text-white">Book Session</span>
            <span className="sm:hidden font-bold text-white">Book</span>
          </button>

          {/* 4. Staff POS Command Shortcut (Authorized Receptionist or Admin) */}
          {isAuthenticated && (isReceptionist || isAdmin) && (
            <button
              type="button"
              onClick={onOpenReceptionistDashboard}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                outline: 'none',
              }}
              className="flex h-9 px-2 sm:px-3 rounded-xl bg-[#851B2B]/15 dark:bg-[#851B2B]/35 hover:bg-[#851B2B]/25 dark:hover:bg-[#851B2B]/50 border border-[#851B2B]/40 dark:border-[#851B2B] text-xs font-bold text-[#851B2B] dark:text-[#FFF4E8] transition-all items-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-sm shrink-0 active:scale-95 outline-none focus:outline-none"
              title="Open Front Desk Reception POS & Live Sessions"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#F5B942] shrink-0" />
              <span className="hidden xs:inline">Front Desk POS</span>
              <span className="xs:hidden">POS</span>
            </button>
          )}

          {/* 5. Admin Command Shortcut (Administrator Only) */}
          {isAuthenticated && isAdmin && (
            <button
              type="button"
              onClick={onOpenAdminDashboard}
              className="hidden lg:flex h-9 px-2.5 sm:px-3 rounded-xl bg-[#855000]/10 dark:bg-[#F5B942]/15 hover:bg-[#855000]/20 dark:hover:bg-[#F5B942]/25 border border-[#855000]/30 dark:border-[#F5B942]/40 text-xs font-bold text-[#855000] dark:text-[#F5B942] transition-colors items-center gap-1.5 whitespace-nowrap shadow-sm shrink-0"
              title="Open Lounge Administrator Management Suite"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Admin Suite</span>
            </button>
          )}

          {/* 6. Profile Icon & Settings Shortcut (Authenticated) */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onOpenProfile || (() => { window.location.hash = '#profile'; })}
              title="Open Player Profile & Theme Settings"
              className="h-9 w-9 rounded-xl flex items-center justify-center bg-white dark:bg-[#260D17] hover:bg-[#F1F3F7] dark:hover:bg-[#381322] border border-[#E2E5EC] dark:border-[#49202C] text-[#414858] dark:text-[#C7A5A8] hover:text-[#851B2B] dark:hover:text-[#FFF4E8] shadow-sm transition-all shrink-0 overflow-hidden active:scale-95"
              aria-label="Player Profile & Settings"
            >
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name || 'Profile'}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-4 h-4 text-current" />
              )}
            </button>
          )}

          {/* 7. Logout / Login */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={logout}
              title="Log out of session"
              className="h-9 w-9 rounded-xl flex items-center justify-center bg-white dark:bg-[#260D17] hover:bg-rose-50 dark:hover:bg-[#851B2B]/30 border border-[#E2E5EC] dark:border-[#49202C] text-[#626B7A] dark:text-[#C7A5A8] hover:text-rose-600 dark:hover:text-[#F06A76] shadow-sm transition-all shrink-0 active:scale-95"
              aria-label="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openLoginModal}
                className="h-9 px-2.5 sm:px-3 text-xs font-semibold text-[#171923] dark:text-[#FFF4E8] hover:bg-[#F1F3F7] dark:hover:bg-[#260D17] rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={openRegisterModal}
                className="hidden sm:inline-flex h-9 px-3 sm:px-3.5 text-xs font-bold bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white rounded-xl font-heading shadow-md shadow-[#851B2B]/25 transition-all whitespace-nowrap items-center justify-center shrink-0"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
