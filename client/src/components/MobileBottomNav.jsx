import React, { useState, useEffect } from 'react';
import {
  House,
  Gamepad2,
  CalendarDays,
  UserRound,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { useMobileNavScroll } from '../hooks/useMobileNavScroll.js';
import { useAuth } from '../context/AuthContext.jsx';

export const MobileBottomNav = ({
  user,
  activeNav = 'home',
  onNavigate,
  openLoginModal,
}) => {
  const auth = useAuth?.() || {};
  const currentUser = user || auth.user;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { isVisible } = useMobileNavScroll({ activeNav });

  // Handle virtual keyboard on mobile to avoid blocking form inputs
  useEffect(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      const handleResize = () => {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setIsKeyboardVisible(isKeyboard);
      };
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, []);

  const role = currentUser?.role || 'customer';

  // Determine which navigation item is active based on activeNav and window.location.hash
  const getActiveItemId = () => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';

    if (role === 'admin') {
      // 1. Overview: dashboard, analytics, automation, health
      if (
        activeNav.startsWith('admin_overview') ||
        activeNav === 'admin_analytics' ||
        activeNav === 'admin_automation' ||
        activeNav === 'admin_health' ||
        hash === '#admin' ||
        hash === '#admin-overview' ||
        hash === '#admin-analytics' ||
        hash === '#admin-automation' ||
        hash === '#admin-health' ||
        hash === '#system-health' ||
        hash === '#auth-console'
      ) {
        return 'admin_overview';
      }
      // 1b. Receptionist POS Desk Shortcut for Admin
      if (
        activeNav === 'receptionist' ||
        activeNav === 'reception_live' ||
        activeNav === 'reception_walkin' ||
        activeNav === 'reception_bookings' ||
        hash === '#receptionist' ||
        hash === '#receptionist-live' ||
        hash === '#receptionist-walkin' ||
        hash === '#receptionist-bookings'
      ) {
        return 'reception_dashboard';
      }
      // 2. Hardware: devices, games, exclusive, categories, pricing, maintenance
      if (
        activeNav === 'admin_devices' ||
        activeNav === 'admin_games' ||
        activeNav === 'admin_exclusive' ||
        activeNav === 'admin_categories' ||
        activeNav === 'admin_pricing' ||
        activeNav === 'admin_maintenance' ||
        hash === '#admin-devices' ||
        hash === '#admin-games' ||
        hash === '#admin-exclusive' ||
        hash === '#admin-categories' ||
        hash === '#admin-pricing' ||
        hash === '#admin-maintenance'
      ) {
        return 'admin_devices';
      }
      // 3. Bookings: bookings, calendar, payments, memberships
      if (
        activeNav === 'admin_bookings' ||
        activeNav === 'admin_calendar' ||
        activeNav === 'admin_payments' ||
        activeNav === 'admin_memberships' ||
        hash === '#admin-bookings' ||
        hash === '#admin-calendar' ||
        hash === '#admin-payments' ||
        hash === '#admin-memberships'
      ) {
        return 'admin_bookings';
      }
      // 4. Profile: admin profile, account settings
      if (
        activeNav === 'profile' ||
        activeNav === 'admin_profile' ||
        hash === '#profile' ||
        hash === '#admin-profile'
      ) {
        return 'profile';
      }
      return 'admin_overview';
    }

    if (role === 'receptionist') {
      // 1. Dashboard: live consoles & sessions, hardware status
      if (
        activeNav === 'receptionist' ||
        activeNav === 'reception_live' ||
        activeNav === 'reception_status' ||
        hash === '#receptionist' ||
        hash === '#receptionist-live'
      ) {
        return 'reception_dashboard';
      }
      // 2. Walk-In POS
      if (activeNav === 'reception_walkin' || hash === '#receptionist-walkin') {
        return 'reception_walkin';
      }
      // 3. Today's Bookings & Check-ins
      if (activeNav === 'reception_bookings' || hash === '#receptionist-bookings') {
        return 'reception_bookings';
      }
      // 4. Staff Profile & Account
      if (
        activeNav === 'profile' ||
        activeNav === 'reception_profile' ||
        hash === '#profile'
      ) {
        return 'profile';
      }
      return 'reception_dashboard';
    }

    // Default Customer / Public Visitor Navigation
    // 1. Equipment: equipment, pricing
    if (
      activeNav === 'equipment' ||
      activeNav === 'pricing' ||
      hash === '#overview' ||
      hash === '#equipment' ||
      hash === '#pricing'
    ) {
      return 'equipment';
    }
    // 2. Bookings: bookings, booking wizard
    if (
      activeNav === 'bookings' ||
      activeNav === 'book' ||
      hash === '#bookings' ||
      hash === '#book'
    ) {
      return 'bookings';
    }
    // 3. Profile: profile, memberships, notifications
    if (
      activeNav === 'profile' ||
      activeNav === 'passes' ||
      activeNav === 'notifications' ||
      hash === '#profile' ||
      hash === '#passes' ||
      hash === '#notifications'
    ) {
      return 'profile';
    }
    // 4. Home: default
    return 'home';
  };

  const activeItemId = getActiveItemId();

  // Mobile navigation items per role
  let navItems = [];

  if (role === 'admin') {
    navItems = [
      {
        id: 'admin_overview',
        label: 'Admin',
        icon: LayoutDashboard,
        route: 'admin_overview',
      },
      {
        id: 'reception_dashboard',
        label: 'POS Desk',
        icon: Sparkles,
        route: 'receptionist',
      },
      {
        id: 'admin_bookings',
        label: 'Bookings',
        icon: CalendarDays,
        route: 'admin_bookings',
      },
      {
        id: 'admin_devices',
        label: 'Hardware',
        icon: Gamepad2,
        route: 'admin_devices',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: UserRound,
        route: 'profile',
      },
    ];
  } else if (role === 'receptionist') {
    navItems = [
      {
        id: 'reception_dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        route: 'receptionist',
      },
      {
        id: 'reception_walkin',
        label: 'Walk-In',
        icon: Gamepad2,
        route: 'reception_walkin',
      },
      {
        id: 'reception_bookings',
        label: "Today's",
        icon: CalendarDays,
        route: 'reception_bookings',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: UserRound,
        route: 'profile',
      },
    ];
  } else {
    // Customer / Public Visitor Navigation
    navItems = [
      {
        id: 'home',
        label: 'Home',
        icon: House,
        route: 'home',
      },
      {
        id: 'equipment',
        label: 'Equipment',
        icon: Gamepad2,
        route: 'equipment',
      },
      {
        id: 'bookings',
        label: 'Bookings',
        icon: CalendarDays,
        route: 'bookings',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: UserRound,
        route: 'profile',
      },
    ];
  }

  const handleItemClick = (e, item) => {
    // Prevent event bubbling without preventing default button click delivery
    e.stopPropagation();

    // If item requires authentication and user is not logged in
    if (!user && (item.id === 'bookings' || item.id === 'profile')) {
      if (openLoginModal) openLoginModal();
      return;
    }

    if (onNavigate) {
      onNavigate(item.route);
    }
  };

  // If virtual keyboard is open, do not obstruct form inputs
  if (isKeyboardVisible) return null;

  return (
    <div
      id="mobile-bottom-nav"
      role="navigation"
      aria-label="Mobile Bottom Navigation"
      aria-hidden={!isVisible}
      style={{
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        WebkitTapHighlightColor: 'transparent',
        transform: isVisible
          ? 'translate3d(-50%, 0, 0)'
          : 'translate3d(-50%, calc(100% + 2.5rem), 0)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition:
          'transform 230ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out',
        willChange: 'transform, opacity',
      }}
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 w-[calc(100%-1.5rem)] max-w-md z-[60] md:hidden rounded-full bg-[#171014]/90 border border-[#851B2B]/40 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_1px_2px_rgba(255,255,255,0.06)_inset] px-1.5 py-1.5 select-none"
    >
      <nav className="w-full flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItemId === item.id;
          const isProfileItem = item.id === 'profile';
          const profilePic = currentUser?.profilePicture;

          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => handleItemClick(e, item)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                outline: 'none',
              }}
              className="flex-1 flex flex-col items-center justify-center py-1 px-0.5 relative transition-transform active:scale-90 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none min-h-[46px]"
            >
              <div
                className={`flex items-center justify-center transition-all duration-150 ${
                  isActive
                    ? 'w-10 h-10 rounded-full bg-[#851B2B]/55 border border-[#851B2B]/70 shadow-[0_0_14px_rgba(133,27,43,0.45)] scale-105'
                    : 'w-10 h-10 rounded-full'
                }`}
              >
                {isProfileItem && currentUser ? (
                  <div
                    className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0 border transition-all relative ${
                      isActive
                        ? 'border-[#D7FF00] shadow-[0_0_10px_rgba(215,255,0,0.6)]'
                        : 'border-[#FFF4E8]/50'
                    } bg-gradient-to-br from-[#851B2B] to-[#A51F35] text-[#FFF4E8]`}
                  >
                    <span className="font-heading font-black text-[10.5px] text-[#FFF4E8]">
                      {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                    {profilePic && (
                      <img
                        src={profilePic}
                        alt={currentUser.name || 'Profile'}
                        className="w-full h-full object-cover rounded-full absolute inset-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <Icon
                    className={`transition-colors duration-150 ${
                      isActive ? 'w-5 h-5 text-[#D7FF00]' : 'w-5 h-5 text-white/75'
                    }`}
                  />
                )}
              </div>

              <span
                className={`text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 transition-all select-none ${
                  isActive ? 'font-bold font-heading scale-105 text-[#D7FF00]' : 'font-medium text-white/80'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
