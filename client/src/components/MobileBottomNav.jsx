import React, { useState, useEffect, useRef } from 'react';
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
import { useTheme } from '../context/ThemeContext.jsx';

export const MobileBottomNav = ({
  user,
  activeNav = 'home',
  onNavigate,
  openLoginModal,
}) => {
  const auth = useAuth?.() || {};
  const { isDark } = useTheme();
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

  // Refs for tracking position and width of active item for the gliding glass indicator
  const navRef = useRef(null);
  const itemRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    top: 4,
    height: 44,
    ready: false,
  });

  useEffect(() => {
    const updateIndicator = () => {
      const activeEl = itemRefs.current[activeItemId];
      const navEl = navRef.current;
      if (activeEl && navEl) {
        const activeRect = activeEl.getBoundingClientRect();
        const navRect = navEl.getBoundingClientRect();
        setIndicatorStyle({
          left: Math.round(activeRect.left - navRect.left + 2),
          width: Math.round(activeRect.width - 4),
          top: 3,
          height: Math.round(navRect.height - 6),
          ready: true,
        });
      }
    };

    updateIndicator();
    // Re-calculate on window resize, scroll or orientation changes
    window.addEventListener('resize', updateIndicator);
    const timeout = setTimeout(updateIndicator, 50);
    return () => {
      window.removeEventListener('resize', updateIndicator);
      clearTimeout(timeout);
    };
  }, [activeItemId, role, navItems.length]);

  const handleItemClick = (e, item) => {
    e.stopPropagation();

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
        backgroundColor: isDark
          ? 'rgba(90, 24, 40, 0.78)'
          : 'color-mix(in oklab, white 65%, transparent)',
        backdropFilter: isDark ? 'blur(24px) saturate(190%)' : 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: isDark ? 'blur(24px) saturate(190%)' : 'blur(22px) saturate(180%)',
        WebkitTapHighlightColor: 'transparent',
        transform: isVisible
          ? 'translate3d(-50%, 0, 0)'
          : 'translate3d(-50%, calc(100% + 2.5rem), 0)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition:
          'transform 230ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out, background-color 250ms ease, border-color 250ms ease',
        willChange: 'transform, opacity',
      }}
      className={`fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 w-[calc(100%-1.5rem)] max-w-md z-[60] md:hidden rounded-full px-1.5 py-1 select-none transition-all ${
        isDark
          ? 'bg-[#5A1828]/78 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.25),0_16px_36px_-12px_rgba(0,0,0,0.65),0_0_20px_-3px_rgba(90,24,40,0.45)]'
          : 'bg-white/65 border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,.85),0_12px_35px_-15px_rgba(0,0,0,.22)]'
      }`}
    >
      <nav ref={navRef} className="relative w-full flex items-center justify-around">
        {/* Animated Gliding Translucent Active Selection Indicator */}
        <div
          className={`mobile-nav-indicator absolute rounded-full pointer-events-none transition-all duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isDark
              ? 'bg-gradient-to-br from-white/22 to-[#851B2B]/45 border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_12px_rgba(0,0,0,0.3)]'
              : 'bg-white/65 border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_2px_8px_rgba(0,0,0,.06)]'
          }`}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            top: `${indicatorStyle.top}px`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.ready ? 1 : 0,
            zIndex: 1,
          }}
        />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItemId === item.id;
          const isProfileItem = item.id === 'profile';
          const profilePic = currentUser?.profilePicture;

          return (
            <button
              key={item.id}
              ref={(el) => (itemRefs.current[item.id] = el)}
              type="button"
              onClick={(e) => handleItemClick(e, item)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                outline: 'none',
              }}
              className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 relative z-10 transition-transform active:scale-95 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none min-h-[46px]"
            >
              <div className="flex items-center justify-center w-8 h-6 transition-all duration-200">
                {isProfileItem && currentUser ? (
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0 border transition-all relative ${
                      isActive
                        ? isDark
                          ? 'border-white shadow-md ring-2 ring-white/30 scale-110'
                          : 'border-[#171923] shadow-sm scale-110'
                        : isDark
                        ? 'border-white/50'
                        : 'border-slate-400'
                    } bg-gradient-to-br from-[#851B2B] to-[#A51F35] text-white`}
                  >
                    <span className="font-heading font-black text-[9.5px] text-white">
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
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive
                        ? isDark
                          ? 'text-white scale-110 nav-icon-active'
                          : 'text-[#171923] scale-110'
                        : isDark
                        ? 'text-white/80 hover:text-white nav-icon-inactive'
                        : 'text-[#414858]'
                    }`}
                  />
                )}
              </div>

              <span
                className={`text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 transition-all select-none ${
                  isActive
                    ? isDark
                      ? 'font-black font-heading text-white scale-105 nav-label-active'
                      : 'font-black font-heading text-[#171923] scale-105'
                    : isDark
                    ? 'font-semibold text-white/80 hover:text-white nav-label-inactive'
                    : 'font-semibold text-[#414858]'
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
