import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePwa } from '../context/PwaContext.jsx';
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
  unreadCount = 0,
  activeNav = 'home',
}) => {
  const { user, isAuthenticated, logout, openLoginModal, openRegisterModal, isAdmin, isReceptionist } = useAuth();
  const { isInstalled, triggerInstall } = usePwa();

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
        return 'Jaipur Premier Gaming Lounge';
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-16 z-30 bg-[#171014]/95 backdrop-blur-md border-b border-[#49202C]">
      <div className="w-full h-full px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* ========================================================= */}
        {/* LEFT: Mobile Logo (Mobile only) or Active Section (Desktop) */}
        {/* ========================================================= */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
          {/* Mobile Logo: visible only on mobile (md:hidden) */}
          <a
            href="#home"
            className="flex md:hidden items-center gap-2 group shrink-0 focus:outline-none"
            title="NOAH GAMING Home"
          >
            <div className="w-8 h-8 rounded-xl bg-[#171014] flex items-center justify-center shadow-md shadow-[#851B2B]/30 border border-[#851B2B]/60 p-1 shrink-0 overflow-hidden">
              <img src="/icons/Noah_gaming_logo.svg" alt="NOAH GAMING" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-baseline leading-none shrink-0">
              <span className="text-sm xs:text-base font-black tracking-wider text-[#FFF4E8] font-heading">
                NOAH
              </span>
              <span className="text-sm xs:text-base font-black tracking-wider text-[#D7FF00] font-heading ml-1">
                GAMING
              </span>
            </div>
          </a>

          {/* Desktop Active Section / Lounge Status indicator */}
          <div className="hidden md:flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#45C987] shadow-sm shadow-[#45C987]/50 animate-pulse shrink-0" />
            <h1 className="text-xs lg:text-sm font-bold font-heading text-[#FFF4E8] tracking-wide truncate">
              {getPageTitle(activeNav)}
            </h1>
            <span className="hidden xl:inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#260D17] border border-[#49202C] text-[#C7A5A8] font-mono">
              Open 10 AM – 11 PM
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT: Actions: Notifications (mobile), Book, POS, Login  */}
        {/* ========================================================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. Mobile Top-Right Notification Bell (Strict Part 7.1 B Rule) */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex md:hidden relative h-9 w-9 items-center justify-center rounded-xl bg-[#260D17] hover:bg-[#381322] border border-[#49202C] text-[#C7A5A8] hover:text-[#D7FF00] transition-colors shrink-0"
            title="Open Notification Center"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-[#FFF4E8]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D7FF00] text-[#171014] text-[9px] font-black font-mono flex items-center justify-center shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* 2. Install App CTA (Visible on Mobile and Desktop when not installed) */}
          {!isInstalled && (
            <button
              type="button"
              onClick={triggerInstall}
              className="flex h-9 px-2 sm:px-2.5 rounded-xl border border-[#49202C] bg-[#260D17] hover:bg-[#381322] text-xs font-semibold text-[#C7A5A8] hover:text-[#FFF4E8] transition-all items-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-sm shrink-0 active:scale-95"
              title="Install NOAH GAMING App to your device"
              aria-label="Install App"
            >
              <Download className="w-3.5 h-3.5 text-[#D7FF00] shrink-0" />
              <span className="text-[11px] sm:text-xs font-semibold">Install</span>
            </button>
          )}

          {/* 3. Book Session CTA (Primary High-Contrast Neon Lime CTA) */}
          <button
            type="button"
            onClick={onOpenBooking}
            className="h-9 px-2.5 sm:px-4 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-black font-heading text-xs tracking-wider uppercase transition-all shadow-md shadow-[#D7FF00]/20 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] shrink-0"
            title="Book a gaming station session"
          >
            <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#171014] shrink-0" />
            <span className="hidden sm:inline">Book Session</span>
            <span className="sm:hidden font-bold">Book</span>
          </button>

          {/* 4. Staff POS Command Shortcut (Authorized Receptionist or Admin) */}
          {isAuthenticated && (isReceptionist || isAdmin) && (
            <button
              type="button"
              onClick={onOpenReceptionistDashboard}
              className="hidden sm:flex h-9 px-2.5 sm:px-3 rounded-xl bg-[#851B2B]/25 hover:bg-[#851B2B]/40 border border-[#851B2B] text-xs font-bold text-[#FFF4E8] transition-colors items-center gap-1.5 whitespace-nowrap shadow-sm shadow-[#851B2B]/20 shrink-0"
              title="Open Front Desk Reception POS & Live Sessions"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F5B942] shrink-0" />
              <span>Front Desk POS</span>
            </button>
          )}

          {/* 5. Admin Command Shortcut (Administrator Only) */}
          {isAuthenticated && isAdmin && (
            <button
              type="button"
              onClick={onOpenAdminDashboard}
              className="hidden lg:flex h-9 px-2.5 sm:px-3 rounded-xl bg-[#F5B942]/15 hover:bg-[#F5B942]/25 border border-[#F5B942]/40 text-xs font-bold text-[#F5B942] transition-colors items-center gap-1.5 whitespace-nowrap shadow-sm shrink-0"
              title="Open Lounge Administrator Management Suite"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Admin Suite</span>
            </button>
          )}

          {/* 6. Logout / Login */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={logout}
              title="Log out of session"
              className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#260D17] hover:bg-[#851B2B]/30 border border-[#49202C] text-[#C7A5A8] hover:text-[#F06A76] transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openLoginModal}
                className="h-9 px-2.5 sm:px-3 text-xs font-semibold text-[#FFF4E8] hover:bg-[#260D17] rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={openRegisterModal}
                className="hidden sm:inline-flex h-9 px-3 sm:px-3.5 text-xs font-bold bg-[#851B2B] hover:bg-[#A51F35] text-[#FFF4E8] rounded-xl font-heading shadow-md shadow-[#851B2B]/25 transition-all whitespace-nowrap items-center justify-center shrink-0"
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
