import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { receptionistApi } from '../../api/receptionist.js';
import { equipmentApi } from '../../api/equipment.js';
import { bookingApi } from '../../api/booking.js';
import { reportsApi } from '../../api/reports.js';
import { ExtendSessionModal } from './ExtendSessionModal.jsx';
import { CheckInModal } from './CheckInModal.jsx';
import { CheckoutModal } from './CheckoutModal.jsx';
import { QuickRegisterModal } from './QuickRegisterModal.jsx';
import { CollectPaymentModal } from './CollectPaymentModal.jsx';
import { ReceiptModal } from '../payment/ReceiptModal.jsx';
import { UserManagementTab } from '../admin/UserManagementTab.jsx';
import {
  Sparkles,
  Gamepad2,
  Tv,
  Clock,
  Users,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
  Calendar,
  CreditCard,
  Banknote,
  FileText,
  UserCheck,
  Play,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  UserPlus,
  XCircle,
  X,
  Loader2,
  ChevronRight,
  Flame,
  Award,
} from 'lucide-react';
import { Pagination } from '../common/Pagination.jsx';

export const ReceptionistDashboard = ({ onClose, initialTab = 'live' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Pagination states
  const [activeSessionsPage, setActiveSessionsPage] = useState(1);
  const [todayBookingsPage, setTodayBookingsPage] = useState(1);
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
  const [pendingPaymentsPage, setPendingPaymentsPage] = useState(1);
  const dashboardTopRef = useRef(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (dashboardTopRef.current) {
      dashboardTopRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [activeTab]);

  // Dashboard Stats & Realtime Data
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [todayBookings, setTodayBookings] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [devicesList, setDevicesList] = useState([]);
  const [gamesList, setGamesList] = useState([]);

  // Time ticker for live countdowns and clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modals state
  const [extendModalSession, setExtendModalSession] = useState(null);
  const [checkInModalBooking, setCheckInModalBooking] = useState(null);
  const [checkoutModalSession, setCheckoutModalSession] = useState(null);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [collectPaymentBooking, setCollectPaymentBooking] = useState(null);
  const [receiptModalPaymentId, setReceiptModalPaymentId] = useState(null);
  const [receiptModalBookingId, setReceiptModalBookingId] = useState(null);

  // Tab 2: Walk-In Form State
  const [walkInStep, setWalkInStep] = useState(1);
  const [walkInCustomerQuery, setWalkInCustomerQuery] = useState('');
  const [walkInCustomerResults, setWalkInCustomerResults] = useState([]);
  const [walkInSearchingCustomer, setWalkInSearchingCustomer] = useState(false);
  const [walkInSelectedCustomer, setWalkInSelectedCustomer] = useState(null);
  const [walkInSelectedDevice, setWalkInSelectedDevice] = useState(null);
  const [walkInSelectedGame, setWalkInSelectedGame] = useState(null);
  const [walkInBookingType, setWalkInBookingType] = useState('SHARED');
  const [walkInPlayersCount, setWalkInPlayersCount] = useState(1);
  const [walkInDuration, setWalkInDuration] = useState(1);
  const [walkInStartTime, setWalkInStartTime] = useState('');
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('CASH');
  const [walkInPaymentAmountRupees, setWalkInPaymentAmountRupees] = useState(0);
  const [walkInAutoCheckIn, setWalkInAutoCheckIn] = useState(true);
  const [walkInNotes, setWalkInNotes] = useState('');
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  // Tab 3: Today's Bookings Filter & Search
  const [bookingFilterStatus, setBookingFilterStatus] = useState('');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');

  // Tab 4: Customer Verification & History
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [customerHistoryFilter, setCustomerHistoryFilter] = useState('all');
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);

  // Live timer interval (every second)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  const refreshAllData = async () => {
    setLoadingStats(true);
    try {
      const [statsRes, sessionsRes, bookingsRes, pendingRes, devicesRes, gamesRes] =
        await Promise.all([
          receptionistApi.getDashboardStats().catch(() => null),
          receptionistApi.getActiveSessions().catch(() => null),
          receptionistApi.getTodayBookings().catch(() => null),
          receptionistApi.getPendingPayments().catch(() => null),
          equipmentApi.getDevices().catch(() => null),
          equipmentApi.getGames().catch(() => null),
        ]);

      if (statsRes?.success) setStats(statsRes.data);
      if (sessionsRes?.success) setActiveSessions(sessionsRes.data);
      if (bookingsRes?.success) setTodayBookings(bookingsRes.data);
      if (pendingRes?.success) setPendingPayments(pendingRes.data);
      if (devicesRes?.success) setDevicesList(devicesRes.data?.devices || devicesRes.data || []);
      if (gamesRes?.success) setGamesList(gamesRes.data?.games || gamesRes.data || []);
    } catch (err) {
      console.error('Error fetching receptionist data:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    refreshAllData();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(refreshAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper: Format countdown timer
  const formatCountdown = (endAt) => {
    if (!endAt) return { display: '--:--', isUrgent: false, isOverdue: false };
    const diff = Math.floor((new Date(endAt).getTime() - currentTime.getTime()) / 1000);
    if (diff <= 0) {
      const overdueMins = Math.abs(Math.floor(diff / 60));
      return {
        display: `Overdue +${overdueMins}m`,
        isUrgent: true,
        isOverdue: true,
      };
    }
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    const isUrgent = diff <= 15 * 60; // 15 mins or less
    const display =
      hrs > 0
        ? `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return { display, isUrgent, isOverdue: false };
  };

  // Walk-in Customer Search
  useEffect(() => {
    if (!walkInCustomerQuery.trim() || walkInCustomerQuery.length < 2) {
      setWalkInCustomerResults([]);
      return;
    }
    const debounce = setTimeout(async () => {
      setWalkInSearchingCustomer(true);
      try {
        const res = await receptionistApi.searchCustomers(walkInCustomerQuery);
        if (res?.success) setWalkInCustomerResults(res.data || []);
      } catch (err) {
        // ignore
      } finally {
        setWalkInSearchingCustomer(false);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [walkInCustomerQuery]);

  // Customer Tab Search
  useEffect(() => {
    if (!customerSearchQuery.trim() || customerSearchQuery.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    const debounce = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await receptionistApi.searchCustomers(customerSearchQuery);
        if (res?.success) setCustomerSearchResults(res.data || []);
      } catch (err) {
        // ignore
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [customerSearchQuery]);

  // Load selected customer details for Verification Tab
  const loadCustomerDetail = async (customerId, filter = customerHistoryFilter) => {
    setLoadingCustomerDetail(true);
    try {
      const res = await receptionistApi.getCustomerDetails(customerId, filter);
      if (res?.success) setSelectedCustomerDetail(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load customer profile');
    } finally {
      setLoadingCustomerDetail(false);
    }
  };

  // Walk-In Price Calculator
  const calculateWalkInPrice = () => {
    if (!walkInSelectedDevice) return 0;
    const isExclusiveGame = walkInSelectedGame?.isExclusive || walkInSelectedGame?.name === 'GTA 6';
    const isPrivate = walkInBookingType === 'PRIVATE' || isExclusiveGame;
    const isPool = walkInSelectedDevice.deviceType === 'POOL';

    let rate = 60;
    if (isExclusiveGame) {
      rate = 150;
    } else if (isPool) {
      rate = 160;
    }

    const players = isPrivate || isExclusiveGame ? 1 : walkInPlayersCount;
    return rate * walkInDuration * (isExclusiveGame || isPrivate ? 1 : players);
  };

  const walkInTotalPrice = calculateWalkInPrice();

  // Auto-set immediate start time
  useEffect(() => {
    if (!walkInStartTime) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      // Round to next 15-minute slot or current
      const roundedMin = Math.ceil(currentMin / 15) * 15;
      const slotHour = roundedMin === 60 ? currentHour + 1 : currentHour;
      const finalMin = roundedMin === 60 ? 0 : roundedMin;
      setWalkInStartTime(
        `${slotHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`
      );
    }
  }, [walkInStartTime]);

  // Handle Walk-in Booking Submission
  const handleCreateWalkIn = async (e) => {
    e.preventDefault();
    if (!walkInSelectedCustomer) {
      toast.error('Please select or register a customer first.');
      return;
    }
    if (!walkInSelectedDevice) {
      toast.error('Please select a gaming device/console.');
      return;
    }

    setWalkInSubmitting(true);
    try {
      const isExclusiveGame = walkInSelectedGame?.isExclusive || walkInSelectedGame?.name === 'GTA 6';
      const bookingType = isExclusiveGame ? 'PRIVATE' : walkInBookingType;
      const paymentAmountPaise = Math.round(Number(walkInPaymentAmountRupees || 0) * 100);

      const res = await receptionistApi.createWalkInBooking({
        customerId: walkInSelectedCustomer._id,
        deviceId: walkInSelectedDevice._id,
        gameId: walkInSelectedGame?._id || null,
        bookingType,
        startTime: walkInStartTime,
        duration: walkInDuration,
        numberOfPlayers: isExclusiveGame || bookingType === 'PRIVATE' ? 1 : walkInPlayersCount,
        paymentMethod: walkInPaymentMethod,
        paymentAmountPaise,
        transactionReference: 'Walk-in Counter POS',
        notes: walkInNotes,
      });

      if (res?.success) {
        toast.success(
          `Walk-in reservation created for ${walkInSelectedCustomer.name}! Station assigned.`
        );
        refreshAllData();
        // Reset walk-in form
        setWalkInSelectedCustomer(null);
        setWalkInSelectedDevice(null);
        setWalkInSelectedGame(null);
        setWalkInCustomerQuery('');
        setWalkInPaymentAmountRupees(0);
        setWalkInNotes('');
        setActiveTab('live'); // Switch to live console monitoring
      } else {
        throw new Error(res?.message || 'Failed to create walk-in booking.');
      }
    } catch (err) {
      toast.error(err.message || 'Error processing walk-in reservation');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Filtered Today's Bookings
  const filteredTodayBookings = todayBookings.filter((b) => {
    if (bookingFilterStatus) {
      if (bookingFilterStatus === 'CHECKED_IN' && b.checkInStatus !== 'CHECKED_IN') return false;
      if (bookingFilterStatus === 'NOT_CHECKED_IN' && b.checkInStatus !== 'NOT_CHECKED_IN') return false;
      if (bookingFilterStatus === 'NO_SHOW' && b.checkInStatus !== 'NO_SHOW') return false;
      if (bookingFilterStatus === 'CONFIRMED' && b.bookingStatus !== 'CONFIRMED') return false;
      if (bookingFilterStatus === 'COMPLETED' && b.sessionStatus !== 'COMPLETED' && b.bookingStatus !== 'COMPLETED') return false;
      if (bookingFilterStatus === 'CANCELLED' && b.bookingStatus !== 'CANCELLED') return false;
    }
    if (bookingSearchQuery.trim()) {
      const q = bookingSearchQuery.toLowerCase();
      const matchId = b.bookingId?.toLowerCase().includes(q);
      const matchCust = b.customer?.name?.toLowerCase().includes(q) || b.customer?.phone?.includes(q);
      const matchDevice = b.device?.name?.toLowerCase().includes(q);
      const matchGame = b.game?.name?.toLowerCase().includes(q);
      return matchId || matchCust || matchDevice || matchGame;
    }
    return true;
  });

  return (
    <div className="w-full bg-[#171014] text-[#FFF4E8] min-h-screen flex flex-col">
      {/* 1. Header (Normal Document Flow - No Sticky Trap) */}
      <div ref={dashboardTopRef} className="w-full bg-[#260D17] border-b border-[#49202C] px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#851B2B] to-[#A51F35] flex items-center justify-center shadow-lg shadow-[#851B2B]/20 text-[#FFF4E8] font-black border border-[#851B2B]">
              <Sparkles className="w-5 h-5 text-[#F5B942]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-[#FFF4E8] font-heading tracking-wide">
                  RECEPTION POS & COMMAND
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#45C987]/20 text-[#45C987] border border-[#45C987]/40">
                  SHIFT ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#C7A5A8]">
                NOAH GAMING &bull; Front Desk Staff: <span className="text-[#D7FF00] font-semibold">{user?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live IST Clock */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171014] border border-[#49202C] text-xs font-mono text-[#D7FF00]">
              <Clock className="w-3.5 h-3.5 text-[#F5B942]" />
              {currentTime.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}{' '}
              IST
            </div>

            {/* Quick Action: New Walk-in */}
            <button
              onClick={() => setActiveTab('walkin')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-[#171014] bg-[#D7FF00] hover:bg-[#c8ee00] transition-all shadow-md shadow-[#D7FF00]/20 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#171014]" /> Walk-In POS
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={refreshAllData}
              disabled={loadingStats}
              title="Refresh Live Metrics"
              className="p-2 rounded-xl bg-[#171014] hover:bg-[#341220] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin text-[#D7FF00]' : ''}`} />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-[#171014] hover:bg-[#851B2B]/30 border border-[#49202C] text-[#C7A5A8] hover:text-[#F06A76] transition-colors"
                title="Close Receptionist Console"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-grow pb-24">
        {/* 2. Dashboard Summary Cards (8 KPI Metrics Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Today Bookings */}
          <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#C7A5A8] uppercase tracking-wider">
              Today Total
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#FFF4E8] font-heading">
                {stats?.metrics?.totalBookingsToday ?? 0}
              </span>
              <Calendar className="w-4 h-4 text-[#C7A5A8]" />
            </div>
          </div>

          {/* 2. Active Sessions */}
          <div className="p-3.5 rounded-2xl bg-[#851B2B]/20 border border-[#851B2B]/40 flex flex-col justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#45C987] animate-ping" />
              <span className="text-[11px] font-semibold text-[#45C987] uppercase tracking-wider">
                Live Gaming
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#45C987] font-heading">
                {stats?.metrics?.activeGamingSessions ?? activeSessions.length}
              </span>
              <Gamepad2 className="w-4 h-4 text-[#45C987]" />
            </div>
          </div>

          {/* 3. Upcoming Bookings */}
          <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#C7A5A8] uppercase tracking-wider">
              Upcoming
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#FFF4E8] font-heading">
                {stats?.metrics?.upcomingBookings ?? 0}
              </span>
              <Clock className="w-4 h-4 text-[#F5B942]/70" />
            </div>
          </div>

          {/* 4. Available PS5 Consoles */}
          <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#C7A5A8] uppercase tracking-wider">
              Available PS5
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#D7FF00] font-heading">
                {stats?.metrics?.availablePS5Consoles ?? 2} <span className="text-xs text-[#C7A5A8]">/ 2</span>
              </span>
              <Tv className="w-4 h-4 text-[#D7FF00]" />
            </div>
          </div>

          {/* 5. Occupied PS5 Consoles */}
          <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#C7A5A8] uppercase tracking-wider">
              In-Use PS5
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#F5B942] font-heading">
                {stats?.metrics?.occupiedPS5Consoles ?? 0}
              </span>
              <Gamepad2 className="w-4 h-4 text-[#F5B942]" />
            </div>
          </div>

          {/* 6. Walk-Ins Today */}
          <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#C7A5A8] uppercase tracking-wider">
              Walk-Ins
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#FFF4E8] font-heading">
                {stats?.metrics?.walkInBookingsToday ?? 0}
              </span>
              <Users className="w-4 h-4 text-[#C7A5A8]" />
            </div>
          </div>

          {/* 7. Pending Payments */}
          <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#C7A5A8] uppercase tracking-wider">
              Pending Dues
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#F06A76] font-heading">
                {stats?.metrics?.pendingPayments ?? 0}
              </span>
              <CreditCard className="w-4 h-4 text-[#F06A76]" />
            </div>
          </div>

          {/* 8. Today's Revenue */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#851B2B]/30 to-[#260D17] border border-[#851B2B]/50 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#FFF4E8] uppercase tracking-wider">
              Today Revenue
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-[#D7FF00] font-mono flex items-center">
                <IndianRupee className="w-3.5 h-3.5 text-[#D7FF00]" />
                {stats?.metrics?.todayRevenueRupees ?? 0}
              </span>
              <Banknote className="w-4 h-4 text-[#45C987]" />
            </div>
          </div>
        </div>

        {/* 3. Tab Navigation (Clean Horizontal Scrollable Strip) */}
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#260D17] border border-[#49202C] overflow-x-auto scrollbar-none text-xs font-semibold">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'live'
                ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/30 font-bold border border-[#851B2B]'
                : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#341220]'
            }`}
          >
            <Tv className="w-4 h-4" /> Live Consoles & Sessions
            {activeSessions.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'live' ? 'bg-[#171014] text-[#D7FF00]' : 'bg-[#851B2B]/30 text-[#FFF4E8]'
                }`}
              >
                {activeSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('walkin')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'walkin'
                ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/30 font-bold border border-[#851B2B]'
                : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#341220]'
            }`}
          >
            <Plus className="w-4 h-4" /> Walk-In Counter POS
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/30 font-bold border border-[#851B2B]'
                : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#341220]'
            }`}
          >
            <Calendar className="w-4 h-4" /> Today's Bookings & Check-In
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'bookings' ? 'bg-[#171014] text-[#D7FF00]' : 'bg-[#171014] text-[#C7A5A8]'
              }`}
            >
              {todayBookings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/30 font-bold border border-[#851B2B]'
                : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#341220]'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Customer Verification & Profiles
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/30 font-bold border border-[#851B2B]'
                : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#341220]'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Counter Payments & Receipts
            {pendingPayments.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'payments' ? 'bg-[#171014] text-[#F06A76]' : 'bg-[#F06A76]/20 text-[#F06A76]'
                }`}
              >
                {pendingPayments.length} Due
              </span>
            )}
          </button>
        </div>

        {/* 4. Selected Tab Content (Begins cleanly below tab navigation) */}

        {/* TAB 1: LIVE CONSOLES & ACTIVE SESSIONS */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            {/* Physical Console Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#D7FF00]" /> Physical Station Status
                </h3>
                <span className="text-xs text-slate-400">
                  Exactly 2 Physical PS5 Consoles &bull; 1 Pool Table
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(stats?.devices || [
                  { deviceCode: 'PS5-01', name: 'PS5 Station 1', deviceType: 'PS5', capacity: 4, isAvailable: true },
                  { deviceCode: 'PS5-02', name: 'PS5 Station 2', deviceType: 'PS5', capacity: 4, isAvailable: true },
                  { deviceCode: 'POOL-01', name: '8-Ball Pool Table', deviceType: 'POOL', capacity: 2, isAvailable: true },
                ]).map((dev) => {
                  const currentSession = dev.currentSession;
                  const timer = currentSession ? formatCountdown(currentSession.endTime ? new Date(`${new Date().toISOString().slice(0, 10)}T${currentSession.endTime}+05:30`) : null) : null;
                  const isGTA6 = currentSession?.gameName?.includes('GTA') || currentSession?.isExclusiveGame;

                  return (
                    <div
                      key={dev.deviceId || dev.deviceCode}
                      className={`relative p-5 rounded-2xl border transition-all ${
                        dev.status === 'MAINTENANCE'
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : currentSession
                          ? isGTA6
                            ? 'bg-gradient-to-b from-rose-950/30 to-slate-900 border-rose-500/50 shadow-lg shadow-rose-950/20'
                            : 'bg-gradient-to-b from-[#851B2B]/20 to-[#260D17] border-[#49202C] shadow-lg shadow-[#851B2B]/10'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      {/* Station Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {dev.deviceCode}
                            </span>
                            <h4 className="text-base font-bold text-white font-heading">{dev.name}</h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {dev.deviceType === 'PS5' ? 'PlayStation 5 Console' : '8-Ball Billiards'} &bull; Max {dev.capacity} Players
                          </p>
                        </div>

                        {/* Status Badge */}
                        {dev.status === 'MAINTENANCE' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            MAINTENANCE
                          </span>
                        ) : currentSession ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> IN SESSION
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#851B2B]/25 text-[#FFF4E8] border border-[#49202C]">
                            AVAILABLE
                          </span>
                        )}
                      </div>

                      {/* Current Session Details if Active */}
                      {currentSession ? (
                        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                          {isGTA6 && (
                            <div className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-between text-xs text-rose-300 font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-rose-400" /> GTA 6 Exclusive Lock
                              </span>
                              <span className="font-mono text-[11px]">₹150/hr</span>
                            </div>
                          )}

                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Player:</span>
                              <span className="font-semibold text-white">{currentSession.customerName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Game:</span>
                              <span className="font-semibold text-[#FFF4E8]">{currentSession.gameName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Slot:</span>
                              <span className="font-mono text-slate-300">
                                {currentSession.startTime} - {currentSession.endTime}
                              </span>
                            </div>
                          </div>

                          {/* Live Countdown Clock */}
                          <div
                            className={`p-2.5 rounded-xl border text-center ${
                              timer?.isOverdue
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                : timer?.isUrgent
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-slate-900 border-slate-800 text-[#FFF4E8]'
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wider block opacity-75">
                              Remaining Session Time
                            </span>
                            <span className="text-lg font-black font-mono tracking-wider">
                              {timer?.display || `${currentSession.remainingMinutes}m remaining`}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                const activeRecord = activeSessions.find(
                                  (s) => s.bookingId === currentSession.bookingId
                                );
                                if (activeRecord) setExtendModalSession(activeRecord);
                              }}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#851B2B]/25 hover:bg-[#851B2B]/40 text-[#FFF4E8] border border-[#49202C] transition-colors flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Extend
                            </button>
                            <button
                              onClick={() => {
                                const activeRecord = activeSessions.find(
                                  (s) => s.bookingId === currentSession.bookingId
                                );
                                if (activeRecord) setCheckoutModalSession(activeRecord);
                              }}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Check-out
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-slate-800 text-center py-6">
                          <p className="text-xs text-slate-400">Station idle and ready</p>
                          <button
                            onClick={() => {
                              const devObj = devicesList.find((d) => d.deviceCode === dev.deviceCode) || dev;
                              setWalkInSelectedDevice(devObj);
                              setActiveTab('walkin');
                            }}
                            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FFF4E8] bg-[#851B2B]/15 hover:bg-[#851B2B]/25 border border-[#49202C] transition-colors inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Book Station
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Sessions List Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-emerald-400" /> Active Gaming Sessions Table ({activeSessions.length})
                </h3>
              </div>

              {activeSessions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                  <Tv className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No active gaming sessions right now</p>
                  <p className="text-xs text-slate-500 mt-1">Walk-in customers or checked-in reservations will show up here</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                    <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3.5">Booking ID</th>
                        <th className="p-3.5">Customer</th>
                        <th className="p-3.5">Station & Game</th>
                        <th className="p-3.5">Mode</th>
                        <th className="p-3.5">Slot (IST)</th>
                        <th className="p-3.5">Remaining Timer</th>
                        <th className="p-3.5">Payment</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {activeSessions.slice((activeSessionsPage - 1) * 8, activeSessionsPage * 8).map((session) => {
                        const countdown = formatCountdown(session.endAt);
                        const isExclusive = session.game?.isExclusive || session.bookingType === 'PRIVATE';
                        return (
                          <tr key={session._id} className="hover:bg-slate-850/50 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-[#D7FF00]">
                              {session.bookingId}
                            </td>
                            <td className="p-3.5">
                              <p className="font-semibold text-white">{session.customer?.name}</p>
                              <p className="text-[11px] text-slate-400">{session.customer?.phone}</p>
                            </td>
                            <td className="p-3.5">
                              <span className="font-medium text-slate-200">{session.device?.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-slate-400">{session.game?.name || 'Open Title'}</span>
                                {isExclusive && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    GTA 6
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                                {session.bookingType} ({session.numberOfPlayers}p)
                              </span>
                            </td>
                            <td className="p-3.5 font-mono">
                              {session.startTime} - {session.endTime}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold inline-flex items-center gap-1 ${
                                  countdown.isOverdue
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                    : countdown.isUrgent
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-[#851B2B]/15 text-[#FFF4E8] border border-[#49202C]'
                                }`}
                              >
                                <Clock className="w-3 h-3" /> {countdown.display}
                              </span>
                            </td>
                            <td className="p-3.5">
                              {session.balanceRemainingPaise > 0 ? (
                                <span className="text-amber-400 font-semibold font-mono">
                                  ₹{session.balanceRemainingRupees} Due
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-semibold">✓ Paid</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              <button
                                onClick={() => setExtendModalSession(session)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#851B2B]/25 hover:bg-[#851B2B]/40 text-[#FFF4E8] border border-[#49202C] transition-colors"
                              >
                                + Extend
                              </button>
                              <button
                                onClick={() => setCheckoutModalSession(session)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors"
                              >
                                Check-out
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={activeSessionsPage}
                  totalPages={Math.ceil(activeSessions.length / 8)}
                  totalItems={activeSessions.length}
                  pageSize={8}
                  onPageChange={setActiveSessionsPage}
                  className="mt-4"
                />
              </>
            )}
            </div>
          </div>
        )}

        {/* TAB 2: WALK-IN BOOKING COUNTER POS */}
        {activeTab === 'walkin' && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#851B2B]/15 border border-[#49202C] flex items-center justify-center text-[#D7FF00]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">Rapid Walk-In Booking POS</h3>
                  <p className="text-xs text-slate-400">Counter reservation & instant session start</p>
                </div>
              </div>

              {/* Quick register modal trigger */}
              <button
                type="button"
                onClick={() => setQuickRegisterOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-[#FFF4E8] border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" /> + New Customer
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-5">
              {/* Step 1: Customer Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. Customer (Search by Phone or Name) <span className="text-rose-400">*</span>
                </label>
                {walkInSelectedCustomer ? (
                  <div className="p-3.5 rounded-xl bg-[#851B2B]/15 border border-[#49202C] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{walkInSelectedCustomer.name}</span>
                        <span className="font-mono text-xs text-[#D7FF00] font-semibold">
                          ({walkInSelectedCustomer.phone})
                        </span>
                        {walkInSelectedCustomer.membership?.status === 'ACTIVE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ★ Active Member
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ID: {walkInSelectedCustomer.customerId || walkInSelectedCustomer._id} &bull; {walkInSelectedCustomer.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWalkInSelectedCustomer(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={walkInCustomerQuery}
                      onChange={(e) => setWalkInCustomerQuery(e.target.value)}
                      placeholder="Type customer name, phone number, or customer ID..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                    />

                    {/* Autocomplete Dropdown */}
                    {walkInCustomerResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto rounded-xl bg-[#260D17] border border-slate-700 shadow-2xl divide-y divide-slate-800">
                        {walkInCustomerResults.map((cust) => (
                          <button
                            type="button"
                            key={cust._id}
                            onClick={() => {
                              setWalkInSelectedCustomer(cust);
                              setWalkInCustomerResults([]);
                              setWalkInCustomerQuery('');
                            }}
                            className="w-full p-2.5 text-left text-xs hover:bg-[#851B2B]/15 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-white">{cust.name}</span>
                              <span className="text-slate-400 ml-2 font-mono">({cust.phone})</span>
                            </div>
                            <span className="text-[11px] text-[#D7FF00] font-mono">Select &rarr;</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Physical Device Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  2. Select Gaming Station <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {devicesList.map((dev) => {
                    const isSelected = walkInSelectedDevice?._id === dev._id;
                    const isMaint = dev.status === 'MAINTENANCE';
                    return (
                      <button
                        type="button"
                        key={dev._id}
                        disabled={isMaint}
                        onClick={() => {
                          setWalkInSelectedDevice(dev);
                          // Reset game if not compatible
                          setWalkInSelectedGame(null);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#851B2B]/25 border-[#851B2B] shadow-md shadow-[#851B2B]/20'
                            : isMaint
                            ? 'bg-slate-950/40 border-slate-800 opacity-50 cursor-not-allowed'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {dev.deviceCode}
                          </span>
                          <span className="text-[10px] font-semibold text-[#D7FF00]">
                            {dev.deviceType === 'PS5' ? '₹60/p/hr' : '₹160/p/hr'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1.5">{dev.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Capacity: Max {dev.capacity} Players
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Game Selection (if PS5) */}
              {walkInSelectedDevice?.deviceType === 'PS5' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    3. Select Game (or Open Title)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    <button
                      type="button"
                      onClick={() => setWalkInSelectedGame(null)}
                      className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                        !walkInSelectedGame
                          ? 'bg-[#851B2B]/25 border-[#851B2B] text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      🎮 Open PS5 Title
                    </button>
                    {gamesList.map((g) => {
                      const isExclusive = g.isExclusive || g.name === 'GTA 6';
                      const isSelected = walkInSelectedGame?._id === g._id;
                      return (
                        <button
                          type="button"
                          key={g._id}
                          onClick={() => {
                            setWalkInSelectedGame(g);
                            if (g.bookingMode === 'PRIVATE_ONLY' || isExclusive) {
                              setWalkInBookingType('PRIVATE');
                            } else if (g.bookingMode === 'SHARED') {
                              setWalkInBookingType('SHARED');
                            }
                            const minP = g.minPlayers || 1;
                            const maxP = g.maxPlayers || 4;
                            if (walkInPlayersCount < minP) {
                              setWalkInPlayersCount(minP);
                            } else if (walkInPlayersCount > maxP) {
                              setWalkInPlayersCount(maxP);
                            }
                          }}
                          className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                            isSelected
                              ? isExclusive
                                ? 'bg-rose-500/20 border-rose-400 text-rose-300 font-bold'
                                : 'bg-[#851B2B]/25 border-[#851B2B] text-white font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{g.name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                {g.minPlayers === g.maxPlayers ? `${g.maxPlayers}P` : `${g.minPlayers || 1}-${g.maxPlayers || 4}P`}
                              </span>
                              {isExclusive && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/30 text-rose-300 font-mono">
                                  ₹150
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* GTA 6 Exclusive Warning */}
                  {(walkInSelectedGame?.isExclusive || walkInSelectedGame?.name === 'GTA 6') && (
                    <div className="mt-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                      <Flame className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>
                        <strong>GTA 6 Exclusive Booking:</strong> Reserves the entire console exclusively at ₹150/hour. Mandatory advance payment applies.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Configuration Grid (Duration, Players, Start Time) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                {/* Duration */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Duration</label>
                  <select
                    value={walkInDuration}
                    onChange={(e) => setWalkInDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-[#851B2B]"
                  >
                    {[1, 2, 3, 4, 5].map((d) => (
                      <option key={d} value={d}>
                        {d} Hour{d > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Players */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Number of Players
                  </label>
                  <select
                    value={walkInPlayersCount}
                    disabled={
                      walkInSelectedGame?.isExclusive ||
                      walkInSelectedGame?.name === 'GTA 6' ||
                      (walkInSelectedGame && walkInSelectedGame.minPlayers === walkInSelectedGame.maxPlayers)
                    }
                    onChange={(e) => setWalkInPlayersCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-[#851B2B] disabled:opacity-50 font-mono"
                  >
                    {(walkInSelectedGame
                      ? Array.from(
                          { length: Math.max(1, (walkInSelectedGame.maxPlayers || 4) - (walkInSelectedGame.minPlayers || 1) + 1) },
                          (_, i) => (walkInSelectedGame.minPlayers || 1) + i
                        )
                      : [1, 2, 3, 4]
                    ).map((p) => (
                      <option key={p} value={p}>
                        {p} Player{p > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Time (IST)</label>
                  <input
                    type="time"
                    required
                    value={walkInStartTime}
                    onChange={(e) => setWalkInStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-[#851B2B]"
                  />
                </div>
              </div>

              {/* Step 5: Price Summary & Payment Collection */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#851B2B]/20 to-[#260D17] border border-[#49202C] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300">Total Calculated Booking Fee</span>
                    <p className="text-[11px] text-slate-400">
                      Based on station rates, duration ({walkInDuration}h) and players
                    </p>
                  </div>
                  <span className="text-2xl font-black text-white font-mono flex items-center">
                    <IndianRupee className="w-5 h-5 text-[#D7FF00]" /> {walkInTotalPrice}
                  </span>
                </div>

                {/* Payment Collection Options */}
                <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setWalkInPaymentMethod('CASH')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          walkInPaymentMethod === 'CASH'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkInPaymentMethod('COUNTER_UPI')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          walkInPaymentMethod === 'COUNTER_UPI'
                            ? 'bg-[#851B2B]/25 text-[#FFF4E8] border-[#49202C]'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        📱 UPI QR
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Amount Collected at Counter (₹)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={walkInTotalPrice}
                        value={walkInPaymentAmountRupees}
                        onChange={(e) => setWalkInPaymentAmountRupees(Number(e.target.value))}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#851B2B]"
                      />
                      <button
                        type="button"
                        onClick={() => setWalkInPaymentAmountRupees(walkInTotalPrice)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#851B2B]/25 text-[#FFF4E8] border border-[#49202C] hover:bg-[#851B2B]/40"
                      >
                        Full (₹{walkInTotalPrice})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={walkInSubmitting || !walkInSelectedCustomer || !walkInSelectedDevice}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] transition-all shadow-lg shadow-[#851B2B]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {walkInSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing Walk-In...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirm Walk-In & Start Session
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: TODAY'S BOOKINGS & CHECK-IN */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
                {['', 'NOT_CHECKED_IN', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setBookingFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                      bookingFilterStatus === st
                        ? 'bg-[#851B2B] text-[#FFF4E8] border-[#851B2B] font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {st === '' ? 'All Today' : st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={bookingSearchQuery}
                  onChange={(e) => setBookingSearchQuery(e.target.value)}
                  placeholder="Filter booking, customer, phone..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
                />
              </div>
            </div>

            {/* Bookings Table */}
            {filteredTodayBookings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No reservations found matching filters</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
                  {/* Mobile Swipe Hint */}
                  <div className="sm:hidden flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[#D7FF00] font-bold">↔</span> Swipe horizontally to view full booking details
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[#D7FF00] text-[9px] font-bold">Scrollable</span>
                  </div>
                  <div
                    className="overflow-x-auto touch-auto overscroll-x-contain w-full table-scrollbar"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-x pan-y',
                    }}
                  >
                    <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3.5">Booking ID</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Station & Game</th>
                      <th className="p-3.5">Time Slot</th>
                      <th className="p-3.5">Fee & Paid</th>
                      <th className="p-3.5">Check-In Status</th>
                      <th className="p-3.5 text-right">Counter Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {filteredTodayBookings.slice((todayBookingsPage - 1) * 8, todayBookingsPage * 8).map((b) => (
                      <tr key={b._id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-[#D7FF00]">
                          {b.bookingId}
                          {b.isWalkIn && (
                            <span className="block text-[9px] font-sans text-amber-400">Walk-In</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-white">{b.customer?.name}</p>
                          <p className="text-[11px] text-slate-400">{b.customer?.phone}</p>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-slate-200">{b.device?.name}</span>
                          <p className="text-slate-400 text-[11px]">{b.game?.name || 'Open Title'}</p>
                        </td>
                        <td className="p-3.5 font-mono">
                          {b.startTime} ({b.duration}h)
                        </td>
                        <td className="p-3.5">
                          <p className="font-mono text-slate-200">
                            ₹{(b.totalAmount || 0) / 100}
                          </p>
                          {b.balanceRemaining > 0 ? (
                            <span className="text-amber-400 text-[11px] font-mono">
                              ₹{b.balanceRemaining / 100} Due
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">✓ Settled</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {b.checkInStatus === 'CHECKED_IN' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              CHECKED IN
                            </span>
                          ) : b.checkInStatus === 'NO_SHOW' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              NO SHOW
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              PENDING ARRIVAL
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {b.checkInStatus === 'NOT_CHECKED_IN' && b.bookingStatus === 'CONFIRMED' && (
                            <>
                              <button
                                onClick={() => setCheckInModalBooking(b)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                              >
                                Check-In
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Mark booking ${b.bookingId} as NO SHOW?`)) {
                                    try {
                                      await receptionistApi.markNoShow(b._id, 'Customer missed arrival window');
                                      toast.success(`Marked ${b.bookingId} as No-Show`);
                                      refreshAllData();
                                    } catch (err) {
                                      toast.error(err.message || 'Failed to mark no-show');
                                    }
                                  }
                                }}
                                className="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                              >
                                No Show
                              </button>
                            </>
                          )}

                          {b.balanceRemaining > 0 && b.bookingStatus !== 'CANCELLED' && (
                            <button
                              onClick={() => setCollectPaymentBooking(b)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#851B2B]/25 hover:bg-[#851B2B]/40 text-[#FFF4E8] border border-[#49202C] transition-colors"
                            >
                              Collect Due
                            </button>
                          )}

                          <button
                            onClick={() => setReceiptModalBookingId(b.bookingId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="View Receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={todayBookingsPage}
                totalPages={Math.ceil(filteredTodayBookings.length / 8)}
                totalItems={filteredTodayBookings.length}
                pageSize={8}
                onPageChange={setTodayBookingsPage}
              />
            </>
          )}
          </div>
        )}

        {/* TAB 4: CENTRALIZED USER MANAGEMENT (FRONT DESK VIEW) */}
        {activeTab === 'customers' && (
          <UserManagementTab isAdmin={false} />
        )}

        {/* TAB 5: COUNTER PAYMENTS & RECEIPTS */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-400" /> Pending Counter Balances ({pendingPayments.length})
                </h3>
                <p className="text-xs text-slate-400">Reservations with unpaid or partial payment balance</p>
              </div>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">All customer dues are completely settled!</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
                  {/* Mobile Swipe Hint */}
                  <div className="sm:hidden flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[#D7FF00] font-bold">↔</span> Swipe horizontally to view full booking details
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[#D7FF00] text-[9px] font-bold">Scrollable</span>
                  </div>
                  <div
                    className="overflow-x-auto touch-auto overscroll-x-contain w-full table-scrollbar"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-x pan-y',
                    }}
                  >
                    <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3.5">Booking ID</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Station & Game</th>
                      <th className="p-3.5">Date & Slot</th>
                      <th className="p-3.5">Total Fee</th>
                      <th className="p-3.5">Paid So Far</th>
                      <th className="p-3.5">Remaining Due</th>
                      <th className="p-3.5 text-right">Counter Collection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {pendingPayments.slice((pendingPaymentsPage - 1) * 8, pendingPaymentsPage * 8).map((b) => (
                      <tr key={b._id} className="hover:bg-slate-850/50">
                        <td className="p-3.5 font-mono font-bold text-[#D7FF00]">{b.bookingId}</td>
                        <td className="p-3.5">
                          <p className="font-semibold text-white">{b.customer?.name}</p>
                          <p className="text-[11px] text-slate-400">{b.customer?.phone}</p>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-slate-200">{b.device?.name}</span>
                          <span className="text-slate-400 block text-[11px]">{b.game?.name || 'Open Title'}</span>
                        </td>
                        <td className="p-3.5 font-mono">
                          {b.bookingDate} @ {b.startTime}
                        </td>
                        <td className="p-3.5 font-mono font-semibold text-slate-200">
                          ₹{(b.totalAmount || 0) / 100}
                        </td>
                        <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                          ₹{(b.amountPaid || 0) / 100}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-rose-400">
                          ₹{(b.balanceRemaining || 0) / 100}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setCollectPaymentBooking(b)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20"
                          >
                            Collect Cash/UPI &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={pendingPaymentsPage}
                totalPages={Math.ceil(pendingPayments.length / 8)}
                totalItems={pendingPayments.length}
                pageSize={8}
                onPageChange={setPendingPaymentsPage}
              />
            </>
          )}
          </div>
        )}
      </div>

      {/* MODALS */}

      {/* 1. Extend Session Modal */}
      {extendModalSession && (
        <ExtendSessionModal
          session={extendModalSession}
          onClose={() => setExtendModalSession(null)}
          onSuccess={() => {
            refreshAllData();
          }}
        />
      )}

      {/* 2. Check-In Modal */}
      {checkInModalBooking && (
        <CheckInModal
          booking={checkInModalBooking}
          onClose={() => setCheckInModalBooking(null)}
          onSuccess={() => {
            refreshAllData();
          }}
        />
      )}

      {/* 3. Checkout Modal */}
      {checkoutModalSession && (
        <CheckoutModal
          session={checkoutModalSession}
          onClose={() => setCheckoutModalSession(null)}
          onSuccess={() => {
            refreshAllData();
          }}
        />
      )}

      {/* 4. Quick Customer Register Modal */}
      {quickRegisterOpen && (
        <QuickRegisterModal
          onClose={() => setQuickRegisterOpen(false)}
          onSuccess={(newCustomer) => {
            setWalkInSelectedCustomer(newCustomer);
            toast.success(`Customer ${newCustomer.name} selected for walk-in booking!`);
          }}
        />
      )}

      {/* 5. Collect Offline Payment Modal */}
      {collectPaymentBooking && (
        <CollectPaymentModal
          booking={collectPaymentBooking}
          onClose={() => setCollectPaymentBooking(null)}
          onSuccess={() => {
            refreshAllData();
          }}
          onViewReceipt={(paymentId) => {
            setReceiptModalPaymentId(paymentId);
          }}
        />
      )}

      {/* 6. Receipt Modal */}
      {(receiptModalPaymentId || receiptModalBookingId) && (
        <ReceiptModal
          paymentId={receiptModalPaymentId}
          bookingId={receiptModalBookingId}
          onClose={() => {
            setReceiptModalPaymentId(null);
            setReceiptModalBookingId(null);
          }}
        />
      )}
    </div>
  );
};
