import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PwaProvider } from './context/PwaContext.jsx';
import { PushNotificationProvider } from './context/PushNotificationContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { MobileBottomNav } from './components/MobileBottomNav.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { Footer } from './components/Footer.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { MobileInstallBanner } from './components/pwa/MobileInstallBanner.jsx';
import { IosInstallModal } from './components/pwa/IosInstallModal.jsx';
import { BookingWizard } from './components/booking/BookingWizard.jsx';
import { MyBookings } from './components/booking/MyBookings.jsx';
import { CustomerDashboard } from './components/customer/CustomerDashboard.jsx';
import { MembershipPlansModal } from './components/membership/MembershipPlansModal.jsx';
import { ReceptionistDashboard } from './components/receptionist/ReceptionistDashboard.jsx';
import { AdminDashboard } from './components/admin/AdminDashboard.jsx';
import { NotificationCenter } from './components/notifications/NotificationCenter.jsx';
import { notificationApi } from './api/notifications.js';
import { showToast } from './utils/toast.js';

function AppContent() {
  const { user, loading, openLoginModal, logout } = useAuth();
  const { isDark } = useTheme();
  const [activeNav, setActiveNav] = useState('home');
  const [bookingWizardOpen, setBookingWizardOpen] = useState(false);
  const [selectedDeviceForBooking, setSelectedDeviceForBooking] = useState(null);
  const [selectedGameForBooking, setSelectedGameForBooking] = useState(null);
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [customerDashboardOpen, setCustomerDashboardOpen] = useState(false);
  const [customerDashboardInitialTab, setCustomerDashboardInitialTab] = useState('overview');
  const [membershipPlansOpen, setMembershipPlansOpen] = useState(false);
  const [selectedPlanForPurchase, setSelectedPlanForPurchase] = useState(null);
  const [receptionistDashboardOpen, setReceptionistDashboardOpen] = useState(false);
  const [receptionistInitialTab, setReceptionistInitialTab] = useState('live');
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState('overview');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time unread notification count for sidebar & mobile header
  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      if (!user) {
        setUnreadCount(0);
        return;
      }
      try {
        const res = await notificationApi.getUnreadCount();
        if (isMounted && res?.success) {
          setUnreadCount(res.data?.unreadCount || 0);
        }
      } catch (err) {
        // silent fail
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Synchronize route from browser URL hash and popstate (supports browser Back / Forward navigation)
  useEffect(() => {
    if (loading) return; // Wait until initial token check completes before checking route permissions

    const syncRouteFromHash = () => {
      const hash = window.location.hash;
      const token = localStorage.getItem('noah_auth_token') || localStorage.getItem('nexus_auth_token');
      let effectiveUser = user;
      if (!effectiveUser && token) {
        try {
          effectiveUser = JSON.parse(localStorage.getItem('noah_user') || 'null');
        } catch (e) {}
      }

      if (hash.startsWith('#admin')) {
        if (!effectiveUser) {
          if (!token) openLoginModal();
          return;
        }
        if (effectiveUser.role !== 'admin') {
          showToast.error('Access Denied: Administrator credentials required.');
          window.location.hash = '#home';
          return;
        }
        const rawTab = hash.replace('#admin-', '').replace('#admin', '');
        const tab = rawTab || 'overview';
        setAdminInitialTab(tab);
        setAdminDashboardOpen(true);
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav(`admin_${tab}`);
      } else if (hash === '#receptionist' || hash.startsWith('#receptionist-')) {
        if (!effectiveUser) {
          if (!token) openLoginModal();
          return;
        }
        if (effectiveUser.role !== 'receptionist' && effectiveUser.role !== 'admin') {
          showToast.error('Access Denied: Front Desk Staff authorization required.');
          window.location.hash = '#home';
          return;
        }
        const tab = hash.includes('walkin') ? 'walkin' : hash.includes('bookings') ? 'bookings' : 'live';
        setReceptionistInitialTab(tab);
        setReceptionistDashboardOpen(true);
        setAdminDashboardOpen(false);
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setNotificationsOpen(false);
        setActiveNav(tab === 'live' ? 'receptionist' : `reception_${tab}`);
      } else if (hash === '#bookings') {
        if (!effectiveUser) {
          if (!token) openLoginModal();
          return;
        }
        setMyBookingsOpen(true);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav('bookings');
      } else if (hash === '#profile') {
        if (!effectiveUser) {
          if (!token) openLoginModal();
          return;
        }
        setCustomerDashboardOpen(true);
        setCustomerDashboardInitialTab('profile');
        setMyBookingsOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav('profile');
      } else if (hash === '#notifications') {
        if (!effectiveUser) {
          if (!token) openLoginModal();
          return;
        }
        setNotificationsOpen(true);
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setActiveNav('notifications');
      } else if (hash === '#passes') {
        setMembershipPlansOpen(true);
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav('passes');
      } else if (hash === '#book') {
        setBookingWizardOpen(true);
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
      } else if (hash === '#overview') {
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav('equipment');
        const el = document.getElementById('overview');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else if (hash === '#pricing') {
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav('pricing');
        const el = document.getElementById('pricing');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else if (hash === '#system-health' || hash === '#auth-console') {
        if (user?.role === 'admin') {
          setAdminInitialTab('health');
          setAdminDashboardOpen(true);
          setReceptionistDashboardOpen(false);
          setMyBookingsOpen(false);
          setCustomerDashboardOpen(false);
          setMembershipPlansOpen(false);
          setBookingWizardOpen(false);
          setNotificationsOpen(false);
          setActiveNav('admin_health');
        } else {
          showToast.error('Access Denied: Internal diagnostic tools are restricted to administrators.');
          window.location.hash = '#home';
        }
      } else {
        // Default customer home view
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setActiveNav('home');
      }
    };

    syncRouteFromHash();
    window.addEventListener('hashchange', syncRouteFromHash);
    window.addEventListener('popstate', syncRouteFromHash);
    return () => {
      window.removeEventListener('hashchange', syncRouteFromHash);
      window.removeEventListener('popstate', syncRouteFromHash);
    };
  }, [user, loading]);

  const getEffectiveUser = () => {
    if (user) return user;
    try {
      const saved = localStorage.getItem('noah_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const handleOpenAdminDashboard = (tab = 'overview') => {
    const effectiveUser = getEffectiveUser();
    if (!effectiveUser) {
      openLoginModal();
      return;
    }
    if (effectiveUser.role !== 'admin') {
      showToast.error('Access Denied: Administrator credentials required.');
      window.location.hash = '#home';
      return;
    }
    if (adminDashboardOpen && adminInitialTab === tab) {
      const container = document.getElementById('admin-dashboard-container');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    setMyBookingsOpen(false);
    setCustomerDashboardOpen(false);
    setMembershipPlansOpen(false);
    setBookingWizardOpen(false);
    setReceptionistDashboardOpen(false);
    setNotificationsOpen(false);
    setAdminInitialTab(tab);
    setAdminDashboardOpen(true);
    setActiveNav(`admin_${tab}`);
    window.location.hash = tab && tab !== 'overview' ? `#admin-${tab}` : '#admin';
  };

  const handleOpenReceptionistDashboard = (tab = 'live') => {
    const effectiveUser = getEffectiveUser();
    if (!effectiveUser) {
      openLoginModal();
      return;
    }
    if (effectiveUser.role !== 'receptionist' && effectiveUser.role !== 'admin') {
      showToast.error('Access Denied: Front Desk Staff authorization required.');
      window.location.hash = '#home';
      return;
    }
    if (receptionistDashboardOpen && receptionistInitialTab === tab) {
      const container = document.getElementById('receptionist-dashboard-container');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    setMyBookingsOpen(false);
    setCustomerDashboardOpen(false);
    setMembershipPlansOpen(false);
    setBookingWizardOpen(false);
    setAdminDashboardOpen(false);
    setNotificationsOpen(false);
    setReceptionistInitialTab(tab);
    setReceptionistDashboardOpen(true);
    setActiveNav(tab === 'live' ? 'receptionist' : `reception_${tab}`);
    window.location.hash = tab && tab !== 'live' ? `#receptionist-${tab}` : '#receptionist';
  };

  const handleOpenMembershipPlans = (plan = null) => {
    setSelectedPlanForPurchase(plan);
    setMyBookingsOpen(false);
    setCustomerDashboardOpen(false);
    setBookingWizardOpen(false);
    setReceptionistDashboardOpen(false);
    setAdminDashboardOpen(false);
    setNotificationsOpen(false);
    setMembershipPlansOpen(true);
    window.location.hash = '#passes';
  };

  const handleNavigate = (navId) => {
    setActiveNav(navId);

    if (navId.startsWith('admin_')) {
      const tab = navId.replace('admin_', '');
      handleOpenAdminDashboard(tab);
      return;
    }

    switch (navId) {
      case 'home':
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        window.location.hash = '#home';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'equipment':
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        window.location.hash = '#overview';
        const overviewEl = document.getElementById('overview');
        if (overviewEl) {
          overviewEl.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        break;
      case 'pricing':
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        window.location.hash = '#pricing';
        const pricingEl = document.getElementById('pricing');
        if (pricingEl) {
          pricingEl.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        break;
      case 'passes':
        handleOpenMembershipPlans(null);
        break;
      case 'bookings':
        if (!getEffectiveUser()) {
          openLoginModal();
          return;
        }
        if (myBookingsOpen) {
          const bModal = document.getElementById('my-bookings-container');
          if (bModal) bModal.scrollTo({ top: 0, behavior: 'smooth' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setMyBookingsOpen(true);
        window.location.hash = '#bookings';
        break;
      case 'notifications':
        if (!getEffectiveUser()) {
          openLoginModal();
          return;
        }
        setMyBookingsOpen(false);
        setCustomerDashboardOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(true);
        window.location.hash = '#notifications';
        break;
      case 'profile':
        if (!getEffectiveUser()) {
          openLoginModal();
          return;
        }
        if (customerDashboardOpen) {
          const pModal = document.getElementById('customer-dashboard-container');
          if (pModal) pModal.scrollTo({ top: 0, behavior: 'smooth' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setMyBookingsOpen(false);
        setMembershipPlansOpen(false);
        setBookingWizardOpen(false);
        setReceptionistDashboardOpen(false);
        setAdminDashboardOpen(false);
        setNotificationsOpen(false);
        setCustomerDashboardInitialTab('profile');
        setCustomerDashboardOpen(true);
        window.location.hash = '#profile';
        break;
      case 'receptionist':
        handleOpenReceptionistDashboard('live');
        break;
      case 'reception_walkin':
        handleOpenReceptionistDashboard('walkin');
        break;
      case 'reception_bookings':
        handleOpenReceptionistDashboard('bookings');
        break;
      case 'reception_memberships':
        handleOpenReceptionistDashboard('memberships');
        break;
      default:
        break;
    }
  };

  const handleOpenBooking = (device = null, game = null) => {
    setSelectedDeviceForBooking(device);
    setSelectedGameForBooking(game);
    setNotificationsOpen(false);
    setBookingWizardOpen(true);
    window.location.hash = '#book';
  };

  return (
    <div className="min-h-screen w-full max-w-full flex bg-[#171014] text-[#FFF4E8] selection:bg-[#851B2B] selection:text-[#FFF4E8] overflow-x-hidden">
      {/* Global Toast Notification Engine */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDark ? '#260D17' : '#FFFFFF',
            color: isDark ? '#FFF4E8' : '#382019',
            border: isDark ? '1px solid #49202C' : '1px solid #F0DCCB',
            borderRadius: '16px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            padding: '12px 16px',
            boxShadow: isDark
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)'
              : '0 10px 25px -5px rgba(56, 32, 25, 0.1), 0 8px 10px -6px rgba(56, 32, 25, 0.05)',
          },
          success: {
            iconTheme: {
              primary: isDark ? '#45C987' : '#16A34A',
              secondary: isDark ? '#171014' : '#FFFFFF',
            },
            style: {
              border: isDark
                ? '1px solid rgba(69, 201, 135, 0.4)'
                : '1px solid rgba(22, 163, 74, 0.4)',
            },
          },
          error: {
            iconTheme: {
              primary: isDark ? '#F06A76' : '#DC2626',
              secondary: isDark ? '#171014' : '#FFFFFF',
            },
            style: {
              border: isDark
                ? '1px solid rgba(240, 106, 118, 0.4)'
                : '1px solid rgba(220, 38, 38, 0.4)',
            },
          },
          loading: {
            iconTheme: {
              primary: isDark ? '#D7FF00' : '#E87524',
              secondary: isDark ? '#171014' : '#FFFFFF',
            },
            style: {
              border: isDark
                ? '1px solid rgba(215, 255, 0, 0.4)'
                : '1px solid rgba(232, 117, 36, 0.4)',
            },
          },
        }}
      />

      {/* ========================================================= */}
      {/* 1. Desktop Persistent Left Sidebar (md:flex)              */}
      {/* ========================================================= */}
      <Sidebar
        activeNav={activeNav}
        onNavigate={handleNavigate}
        user={user}
        unreadCount={unreadCount}
        onOpenBooking={() => handleOpenBooking(null)}
        onOpenReceptionistDashboard={() => handleOpenReceptionistDashboard('live')}
        onOpenAdminDashboard={handleOpenAdminDashboard}
        openLoginModal={openLoginModal}
        logout={logout}
      />

      {/* ========================================================= */}
      {/* 2. Main Application Container (md:ml-64 on Desktop)       */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 w-full">
        {/* Top Navbar */}
        <Navbar
          onOpenBooking={() => handleOpenBooking(null)}
          onOpenReceptionistDashboard={() => handleOpenReceptionistDashboard('live')}
          onOpenAdminDashboard={() => handleOpenAdminDashboard('overview')}
          onOpenNotifications={() => handleNavigate('notifications')}
          unreadCount={unreadCount}
          activeNav={activeNav}
        />

        {/* Mobile Install App Banner */}
        <MobileInstallBanner />

        {/* Main Content Area: Public Customer Gaming Lounge Website */}
        <main className="flex-grow w-full max-w-full mt-16 pb-36 sm:pb-40 md:pb-8">
          <HomePage
            onOpenBooking={handleOpenBooking}
            onOpenMyBookings={() => handleNavigate('bookings')}
            onOpenCustomerDashboard={() => handleNavigate('profile')}
            onOpenMembershipPlans={handleOpenMembershipPlans}
          />
        </main>

        <Footer />
      </div>

      <AuthModal />
      <IosInstallModal />


      {/* ========================================================= */}
      {/* Modals & Sub-Views: Placed with md:left-64 and z-40 so:    */}
      {/* - Desktop sidebar (w-64 fixed left-0) stays 100% visible  */}
      {/* - Mobile bottom nav (z-50) stays 100% visible on top      */}
      {/* - pb-28 sm:pb-32 ensures content is never covered         */}
      {/* ========================================================= */}

      {/* Booking Wizard */}
      {bookingWizardOpen && (
        <div className="fixed inset-0 md:left-64 z-40 flex items-center justify-center p-2 sm:p-4 md:p-6 pb-28 sm:pb-32 md:pb-6 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-4xl m-auto">
            <BookingWizard
              initialDevice={selectedDeviceForBooking}
              initialGame={selectedGameForBooking}
              onBookingComplete={() => {
                setBookingWizardOpen(false);
                handleNavigate('bookings');
              }}
              onClose={() => {
                setBookingWizardOpen(false);
                window.location.hash = '#home';
              }}
            />
          </div>
        </div>
      )}

      {/* Customer Reservations / My Bookings */}
      {myBookingsOpen && (
        <div id="my-bookings-container" className="fixed inset-0 md:left-64 z-40 bg-[#171014]/95 backdrop-blur-md overflow-y-auto overscroll-contain block pb-36 sm:pb-40 md:pb-12">
          <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
            <MyBookings
              onNewBooking={() => {
                setMyBookingsOpen(false);
                handleOpenBooking(null);
              }}
              onClose={() => {
                setMyBookingsOpen(false);
                window.location.hash = '#home';
              }}
            />
          </div>
        </div>
      )}

      {/* Customer Profile & Dashboard */}
      {customerDashboardOpen && (
        <div id="customer-dashboard-container" className="fixed inset-0 md:left-64 z-40 bg-[#171014]/95 backdrop-blur-md overflow-y-auto overscroll-contain block pb-36 sm:pb-40 md:pb-12">
          <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
            <CustomerDashboard
              initialTab={customerDashboardInitialTab}
              onOpenBooking={(dev) => {
                setCustomerDashboardOpen(false);
                handleOpenBooking(dev);
              }}
              onOpenMyBookings={() => {
                setCustomerDashboardOpen(false);
                handleNavigate('bookings');
              }}
              onClose={() => {
                setCustomerDashboardOpen(false);
                window.location.hash = '#home';
              }}
            />
          </div>
        </div>
      )}

      {/* Notification Center */}
      {notificationsOpen && (
        <div id="notifications-container" className="fixed inset-0 md:left-64 z-40 bg-black/90 backdrop-blur-md overflow-y-auto overscroll-contain block pb-36 sm:pb-40 md:pb-12">
          <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
            <NotificationCenter
              user={user}
              onClose={() => {
                setNotificationsOpen(false);
                window.location.hash = '#home';
              }}
              onNavigateToBooking={() => {
                setNotificationsOpen(false);
                handleNavigate('bookings');
              }}
              onNavigateToMembership={() => {
                setNotificationsOpen(false);
                handleNavigate('passes');
              }}
              onNavigateToProfile={(tab) => {
                setNotificationsOpen(false);
                setCustomerDashboardInitialTab(tab || 'overview');
                handleNavigate('profile');
              }}
              onUnreadCountChange={(count) => setUnreadCount(count)}
            />
          </div>
        </div>
      )}

      {/* Monthly Membership Plans */}
      {membershipPlansOpen && (
        <MembershipPlansModal
          initialPlanId={selectedPlanForPurchase?._id || selectedPlanForPurchase?.id}
          onClose={() => {
            setMembershipPlansOpen(false);
            setSelectedPlanForPurchase(null);
            window.location.hash = '#home';
          }}
          onPurchaseSuccess={() => {
            setMembershipPlansOpen(false);
            setSelectedPlanForPurchase(null);
            handleNavigate('profile');
          }}
        />
      )}

      {/* Receptionist POS Command Console */}
      {receptionistDashboardOpen && (
        <div id="receptionist-dashboard-container" className="fixed inset-0 md:left-64 z-40 bg-[#F5F6FA] dark:bg-[#171014] overflow-y-auto overscroll-contain block pb-36 sm:pb-40 md:pb-12">
          <ReceptionistDashboard
            initialTab={receptionistInitialTab}
            onTabChange={(newTab) => {
              setReceptionistInitialTab(newTab);
              setActiveNav(newTab === 'live' ? 'receptionist' : `reception_${newTab}`);
              const targetHash = newTab === 'live' ? '#receptionist' : `#receptionist-${newTab}`;
              if (window.location.hash !== targetHash) {
                window.history.replaceState(null, '', targetHash);
              }
            }}
            onClose={() => {
              setReceptionistDashboardOpen(false);
              window.location.hash = '#home';
            }}
          />
        </div>
      )}

      {/* Administrator Command & Management Console */}
      {adminDashboardOpen && (
        <div id="admin-dashboard-container" className="fixed inset-0 md:left-64 z-40 bg-[#F5F6FA] dark:bg-[#171014] overflow-y-auto overscroll-contain block pb-36 sm:pb-40 md:pb-12">
          <AdminDashboard
            initialTab={adminInitialTab}
            onClose={() => {
              setAdminDashboardOpen(false);
              window.location.hash = '#home';
            }}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* Persistent Mobile Bottom Navigation Bar (z-[60] md:hidden) */}
      {/* Mounted at the very bottom of DOM so it is never covered   */}
      {/* ========================================================= */}
      <MobileBottomNav
        user={user}
        activeNav={activeNav}
        onNavigate={handleNavigate}
        openLoginModal={openLoginModal}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PwaProvider>
          <PushNotificationProvider>
            <AppContent />
          </PushNotificationProvider>
        </PwaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
