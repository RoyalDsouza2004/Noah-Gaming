import React from 'react';
import { usePwa } from '../context/PwaContext.jsx';
import { ThemeToggle } from './common/ThemeToggle.jsx';
import {
  Gamepad2,
  Coins,
  Crown,
  Activity,
  Calendar,
  Bell,
  User,
  LayoutDashboard,
  Sparkles,
  Shield,
  LogOut,
  Tv,
  Download,
} from 'lucide-react';

export const Sidebar = ({
  activeNav = 'home',
  onNavigate,
  user,
  unreadCount = 0,
  onOpenBooking,
  onOpenReceptionistDashboard,
  onOpenAdminDashboard,
  openLoginModal,
  logout,
}) => {
  const { isInstalled, triggerInstall } = usePwa();
  const role = user?.role || 'guest';
  const isAdmin = role === 'admin';
  const isReceptionist = role === 'receptionist';
  const isStaff = isReceptionist || isAdmin;

  const getRoleBadge = (userRole) => {
    switch (userRole) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#851B2B]/40 text-[#FFF4E8] border border-[#851B2B]">
            <Shield className="w-2.5 h-2.5 text-[#F5B942]" /> Admin
          </span>
        );
      case 'receptionist':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/40">
            <Sparkles className="w-2.5 h-2.5 text-[#F5B942]" /> Staff
          </span>
        );
      case 'customer':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[#260D17] text-[#C7A5A8] border border-[#49202C]">
            <User className="w-2.5 h-2.5" /> Gamer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[#260D17] text-[#C7A5A8] border border-[#49202C]">
            Guest
          </span>
        );
    }
  };

  // Construct Role-Based Navigation Items (Strict Part 3 & Part 4 Rule)
  let navItems = [];

  if (isAdmin) {
    navItems = [
      {
        id: 'home',
        label: 'Public Website',
        sublabel: 'Customer Experience',
        icon: LayoutDashboard,
      },
      {
        id: 'admin_overview',
        label: 'Executive Analytics',
        sublabel: 'Business BI & Reports',
        icon: Activity,
      },
      {
        id: 'receptionist',
        label: 'Front Desk POS',
        sublabel: 'Reception & Station Timers',
        icon: Sparkles,
      },
      {
        id: 'admin_devices',
        label: 'Hardware & Consoles',
        sublabel: 'PS5s & Pool Table',
        icon: Tv,
      },
      {
        id: 'admin_pricing',
        label: 'Pricing & Rules',
        sublabel: 'Central Rates Config',
        icon: Coins,
      },
      {
        id: 'admin_memberships',
        label: 'Club Passes',
        sublabel: 'Monthly Subscriptions',
        icon: Crown,
      },
      {
        id: 'admin_bookings',
        label: 'All Reservations',
        sublabel: 'Booking Management',
        icon: Calendar,
      },
      {
        id: 'admin_payments',
        label: 'Payments & Revenue',
        sublabel: 'Financial Audit Trail',
        icon: Coins,
      },
      {
        id: 'admin_automation',
        label: 'Automation Engine',
        sublabel: 'Timers & Notification Logs',
        icon: Sparkles,
      },
      {
        id: 'admin_health',
        label: 'System Health',
        sublabel: 'MongoDB & Server Status',
        icon: Shield,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        sublabel: 'System & User Alerts',
        icon: Bell,
        badge: unreadCount,
      },
      {
        id: 'profile',
        label: 'Admin Profile',
        sublabel: 'Account & Settings',
        icon: User,
      },
    ];
  } else if (isReceptionist) {
    navItems = [
      {
        id: 'receptionist',
        label: 'Front Desk POS',
        sublabel: 'Live Station Timers',
        icon: Sparkles,
      },
      {
        id: 'reception_walkin',
        label: 'Walk-In Booking',
        sublabel: 'Instant Counter Slot',
        icon: Gamepad2,
      },
      {
        id: 'reception_bookings',
        label: "Today's Bookings",
        sublabel: 'Customer Check-ins',
        icon: Calendar,
      },
      {
        id: 'equipment',
        label: 'Hardware Status',
        sublabel: 'Equipment Availability',
        icon: Tv,
      },
      {
        id: 'home',
        label: 'Public Website',
        sublabel: 'Customer View',
        icon: LayoutDashboard,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        sublabel: 'Station & Alert Feed',
        icon: Bell,
        badge: unreadCount,
      },
      {
        id: 'profile',
        label: 'Staff Profile',
        sublabel: 'Shift & Account',
        icon: User,
      },
    ];
  } else {
    // Customer & Public Visitor (Zero Developer / Admin / Health Tools)
    navItems = [
      {
        id: 'home',
        label: 'Home',
        sublabel: 'Lounge Experience',
        icon: LayoutDashboard,
      },
      {
        id: 'equipment',
        label: 'Equipment & Consoles',
        sublabel: 'PS5s & Pool Table',
        icon: Gamepad2,
      },
      {
        id: 'pricing',
        label: 'Pricing & Rules',
        sublabel: 'Hourly Rates & GTA 6',
        icon: Coins,
      },
      {
        id: 'passes',
        label: 'Club Passes',
        sublabel: 'Monthly Memberships',
        icon: Crown,
      },
      {
        id: 'bookings',
        label: 'My Bookings',
        sublabel: 'Reservations & Slots',
        icon: Calendar,
      },
      ...(user
        ? [
            {
              id: 'notifications',
              label: 'Notifications',
              sublabel: 'Alerts & Messages',
              icon: Bell,
              badge: unreadCount,
            },
            {
              id: 'profile',
              label: 'My Profile',
              sublabel: 'Account & Pass Status',
              icon: User,
            },
          ]
        : []),
    ];
  }

  return (
    <aside
      aria-label="Desktop Navigation Sidebar"
      className="hidden md:flex flex-col w-64 fixed top-0 bottom-0 left-0 bg-[#171014] border-r border-[#49202C] z-40 select-none overflow-y-auto"
    >
      {/* 1. Brand Header */}
      <div className="h-16 px-4 border-b border-[#49202C] flex items-center justify-between shrink-0 bg-[#171014]/95">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 group focus:outline-none text-left"
          title="NOAH GAMING Home"
        >
          <div className="w-9 h-9 rounded-full bg-[#171014] p-0.5 flex items-center justify-center shadow-md shadow-[#851B2B]/30 border border-[#851B2B]/60 flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
            <img src="/icons/Noah_gaming_logo.svg" alt="NOAH GAMING" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline leading-none">
              <span className="text-base font-black tracking-wider text-[#FFF4E8] font-heading">
                NOAH
              </span>
              <span className="text-base font-black tracking-wider text-[#D7FF00] font-heading ml-1">
                GAMING
              </span>
            </div>
            <span className="text-[7.5px] font-semibold tracking-widest text-[#C7A5A8] uppercase leading-none mt-1">
              PLAY • CHILL • CONNECT
            </span>
          </div>
        </button>
      </div>

      {/* 2. Navigation Items List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 pt-1 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#C7A5A8]/70 font-bold">
            {isAdmin ? 'Admin Console' : isReceptionist ? 'Reception Desk' : 'Navigation'}
          </span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeNav === item.id ||
            (item.id === 'home' && (!activeNav || activeNav === 'home')) ||
            (item.id.startsWith('admin') && activeNav.startsWith('admin') && activeNav === item.id) ||
            (item.id === 'receptionist' && activeNav === 'receptionist');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group relative focus:outline-none ${
                isActive
                  ? 'bg-[#851B2B] text-[#FFF4E8] font-bold shadow-md shadow-[#851B2B]/40 border-l-4 border-[#D7FF00]'
                  : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#260D17] border-l-4 border-transparent'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#171014]/60 text-[#D7FF00]'
                    : 'bg-[#260D17] text-[#C7A5A8] group-hover:text-[#FFF4E8] group-hover:bg-[#381322]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs truncate ${isActive ? 'text-[#FFF4E8] font-heading font-bold' : 'font-medium'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#45C987] shadow-sm shadow-[#45C987]/60 animate-pulse shrink-0"
                        title="Active Page"
                      />
                    )}
                  </div>
                  {item.badge > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#D7FF00] text-[#171014] shadow-sm animate-pulse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                {item.sublabel && (
                  <p
                    className={`text-[10px] truncate leading-tight ${
                      isActive ? 'text-[#FFF4E8]/80' : 'text-[#C7A5A8]/60 group-hover:text-[#C7A5A8]'
                    }`}
                  >
                    {item.sublabel}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 2.5 Install PWA Application Shortcut */}
      {!isInstalled && (
        <div className="px-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={triggerInstall}
            className="w-full h-9 px-3 rounded-xl border border-[#49202C] bg-[#260D17] hover:bg-[#381322] text-xs font-semibold text-[#C7A5A8] hover:text-[#FFF4E8] transition-all flex items-center justify-between shadow-sm group active:scale-[0.98]"
            title="Install NOAH GAMING App to Desktop or Tablet"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#D7FF00] group-hover:scale-110 transition-transform" />
              <span>Install App</span>
            </div>
            <span className="text-[10px] font-bold text-[#D7FF00] bg-[#D7FF00]/10 border border-[#D7FF00]/20 px-1.5 py-0.5 rounded">
              APP
            </span>
          </button>
        </div>
      )}

      {/* 3. User Identity Profile Footer Card */}
      <div className="p-3 border-t border-[#49202C] bg-[#171014]/95 shrink-0">
        {user ? (
          <div className="p-2 rounded-xl bg-[#260D17] border border-[#49202C] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity focus:outline-none"
              title="Open Profile"
            >
              <div className="w-8 h-8 rounded-full bg-[#851B2B] text-[#FFF4E8] flex items-center justify-center font-bold text-xs shrink-0 border border-[#A51F35] overflow-hidden">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#FFF4E8] truncate block">
                  {user.name}
                </span>
                <div className="mt-0.5">{getRoleBadge(user.role)}</div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle className="h-8 w-8 px-1" />
              <button
                type="button"
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-lg text-[#C7A5A8] hover:text-[#F06A76] hover:bg-[#851B2B]/30 transition-colors focus:outline-none shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-[#260D17] border border-[#49202C] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#381322] text-[#C7A5A8] flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#FFF4E8] block">Guest Gamer</span>
                <span className="text-[10px] text-[#C7A5A8]">Public visitor</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle className="h-8 w-8 px-1" />
              <button
                type="button"
                onClick={openLoginModal}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#851B2B] text-[#FFF4E8] hover:bg-[#A51F35] transition-colors shrink-0"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
