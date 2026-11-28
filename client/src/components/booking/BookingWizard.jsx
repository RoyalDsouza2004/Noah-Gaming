import React, { useState, useEffect, useCallback } from 'react';
import { bookingApi } from '../../api/booking.js';
import { equipmentApi } from '../../api/equipment.js';
import { paymentApi } from '../../api/payment.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useFeatureFlags } from '../../hooks/useFeatureFlags.js';
import { RazorpayModal } from '../payment/RazorpayModal.jsx';
import { ReceiptModal } from '../payment/ReceiptModal.jsx';
import { showToast } from '../../utils/toast.js';
import { format12HourTime, format12HourRange } from '../../utils/timeFormat.js';
import {
  Gamepad2,
  Tv,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Flame,
  Shield,
  Layers,
  CircleDot,
  Check,
  RefreshCw,
  Coins,
  X,
  CreditCard,
  FileText,
  Lock,
  Banknote,
  Crown,
  ChevronRight,
  MapPin,
  RotateCcw,
} from 'lucide-react';

export const BookingWizard = ({ initialDevice, initialGame, onBookingComplete, onClose }) => {
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const { isLight } = useTheme();
  const { enableOnlinePayments } = useFeatureFlags();

  // Wizard Steps:
  // Step 1 = Station & Pricing Category (embedded in each card)
  // Step 2 = Timing, Duration, Players & Live Slots
  // Step 3 = Review & Payment at Venue
  // Step 4 = Confirmed Reservation Receipt
  const [step, setStep] = useState(1);

  // Equipment & Pricing data from backend
  const [devices, setDevices] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Station and Pricing selections
  const [selectedDevice, setSelectedDevice] = useState(initialDevice || null);
  const [pricingCategory, setPricingCategory] = useState('NON_EXCLUSIVE'); // 'NON_EXCLUSIVE' | 'EXCLUSIVE' | 'NONE'
  const [navigatingKey, setNavigatingKey] = useState(null); // visual highlight before auto-nav

  // IST Date handling
  const getTodayIST = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const getTomorrowIST = () => {
    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(tomorrow);
    } catch {
      return new Date(Date.now() + 86400000).toISOString().split('T')[0];
    }
  };

  const todayStr = getTodayIST();
  const tomorrowStr = getTomorrowIST();

  const [bookingDate, setBookingDate] = useState(todayStr);
  const [duration, setDuration] = useState(1); // in hours
  const [bookingType, setBookingType] = useState('SHARED'); // 'SHARED' or 'PRIVATE'
  const [numberOfPlayers, setNumberOfPlayers] = useState(1);

  // Availability & Slots
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [dateClosureReason, setDateClosureReason] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [navigatingSlot, setNavigatingSlot] = useState(null);

  // Server-side Pricing Quote
  const [pricingQuote, setPricingQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Final Confirmed Booking & Online Payment
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [confirmedPayment, setConfirmedPayment] = useState(null);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Load Devices and Central Pricing Rules from Backend
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [devRes, prRes] = await Promise.all([
          equipmentApi.getDevices('status=ACTIVE'),
          equipmentApi.getPricing('status=ACTIVE').catch(() => null),
        ]);

        if (devRes?.success) {
          setDevices(devRes.data.devices);
          if (initialDevice) {
            const found = devRes.data.devices.find(
              (d) => d._id === (initialDevice._id || initialDevice)
            );
            if (found) {
              setSelectedDevice(found);
              if (found.deviceType === 'POOL') {
                setPricingCategory('NONE');
              }
            }
          }
        }
        if (prRes?.success && prRes.data?.pricingPlans) {
          setPricingPlans(prRes.data.pricingPlans);
        }
      } catch (err) {
        setError(err.message || 'Failed to load gaming equipment');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Authoritative prices configured in backend
  const ps5NonExclusivePlan = pricingPlans.find(
    (p) => p.deviceType === 'PS5' && !p.game && p.status === 'ACTIVE'
  );
  const ps5ExclusivePlan = pricingPlans.find(
    (p) =>
      (p.deviceType === 'EXCLUSIVE' ||
        p.name?.toLowerCase().includes('exclusive') ||
        p.name?.toLowerCase().includes('gta')) &&
      p.status === 'ACTIVE'
  );
  const poolPlan = pricingPlans.find(
    (p) => p.deviceType === 'POOL' && p.status === 'ACTIVE'
  );

  const ps5NonExclusiveRate = ps5NonExclusivePlan
    ? Math.round(ps5NonExclusivePlan.amount / 100)
    : 70;
  const ps5ExclusiveRate = ps5ExclusivePlan
    ? Math.round(ps5ExclusivePlan.amount / 100)
    : 150;
  const poolRate = poolPlan ? Math.round(poolPlan.amount / 100) : 150;

  // Max selectable players for current station
  const maxStationPlayers = selectedDevice?.capacity || 4;

  // Fetch real-time availability slots
  const fetchAvailability = useCallback(async () => {
    if (!selectedDevice || !bookingDate) return;
    setSlotsLoading(true);
    setSlotsError('');
    setSelectedSlot(null);
    try {
      const res = await bookingApi.getAvailability(
        selectedDevice._id,
        bookingDate,
        duration,
        null
      );
      if (res?.success && res.data) {
        setAvailabilitySlots(res.data.slots || []);
        setDateClosureReason(
          res.data.isClosed ? res.data.closureReason || 'Gaming lounge is closed on this date.' : null
        );
      } else {
        throw new Error(res?.message || 'Failed to check availability.');
      }
    } catch (err) {
      console.error('[Availability API Error]:', err);
      setSlotsError(err.message || 'Could not verify slot availability. Please retry.');
      setAvailabilitySlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDevice, bookingDate, duration]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    if (step === 2) {
      fetchAvailability();
    }
  }, [step, fetchAvailability]);

  useEffect(() => {
    const handleSync = () => fetchAvailability();
    window.addEventListener('booking_updated', handleSync);
    window.addEventListener('session_updated', handleSync);
    return () => {
      window.removeEventListener('booking_updated', handleSync);
      window.removeEventListener('session_updated', handleSync);
    };
  }, [fetchAvailability]);

  // Robust slot availability checker (always checks mode & player capacity)
  const isSlotAvailable = (slot) => {
    if (!slot) return false;
    if (slot.isPast) return false;
    if (slot.status === 'MAINTENANCE' || slot.status === 'UNAVAILABLE' || slot.status === 'FULL') {
      return false;
    }
    if (typeof slot.available === 'boolean' && !slot.available) {
      return false;
    }
    const remaining = slot.remainingPlayers || 0;
    if (bookingType === 'PRIVATE') {
      return Boolean(slot.canBookPrivate && remaining >= numberOfPlayers);
    }
    return Boolean(slot.canBookShared && remaining >= numberOfPlayers);
  };

  // Check if all slots for today have already passed
  const allTodaySlotsPassed =
    bookingDate === todayStr &&
    availabilitySlots.length > 0 &&
    availabilitySlots.every((s) => s.isPast);

  // Fetch precision pricing quote from backend
  useEffect(() => {
    const fetchQuote = async () => {
      if (!selectedDevice) return;
      setQuoteLoading(true);
      try {
        const isPS5 = selectedDevice.deviceType === 'PS5';
        const res = await equipmentApi.calculatePrice({
          deviceId: selectedDevice._id,
          gameId: null,
          pricingCategory: isPS5 ? pricingCategory : 'NONE',
          gameClassification: isPS5 ? pricingCategory : 'NONE',
          isVenueSelection: isPS5,
          durationMinutes: duration * 60,
          playersCount: numberOfPlayers,
          customerId: user?._id || null,
          bookingDate: bookingDate || null,
          bookingType,
        });
        if (res.success) {
          setPricingQuote(res.data);
        }
      } catch (err) {
        console.warn('Pricing quote error:', err.message);
      } finally {
        setQuoteLoading(false);
      }
    };
    fetchQuote();
  }, [selectedDevice, pricingCategory, duration, numberOfPlayers, bookingType, bookingDate, user?._id]);

  // Handle Station + Pricing selection inside card -> AUTOMATIC NAVIGATION TO STEP 2
  const handleSelectStationPricing = (device, category) => {
    setSelectedDevice(device);
    setPricingCategory(category);
    setNavigatingKey(`${device._id}_${category}`);
    setError('');

    if (device.deviceType === 'POOL') {
      setBookingType('SHARED');
    } else if (category === 'EXCLUSIVE') {
      setBookingType('PRIVATE');
    }

    // 150ms visual ring feedback before immediate progression
    setTimeout(() => {
      setNavigatingKey(null);
      setStep(2);
    }, 150);
  };

  // Handle Live Slot Selection -> AUTOMATIC NAVIGATION TO REVIEW (Step 3)
  const handleSelectSlot = (slot) => {
    if (slotsLoading) return;

    if (!isSlotAvailable(slot)) {
      if (slot.isPast) {
        setError('This time slot is in the past. Please select an upcoming slot or next date.');
      } else if (slot.reason) {
        setError(slot.reason);
      } else if (duration > 1) {
        setError(
          `The ${duration}-hour interval starting at ${format12HourTime(slot.startTime)} overlaps an existing reservation. Please choose a shorter duration or another start time.`
        );
      } else {
        setError('This time slot does not have sufficient open player seats. Please choose an alternate slot.');
      }
      return;
    }

    // Verify all required booking details are present before progression
    if (!bookingDate) {
      setError('Please select a valid booking date.');
      return;
    }
    if (!duration || duration < 0.5) {
      setError('Please choose a valid session duration.');
      return;
    }
    if (!numberOfPlayers || numberOfPlayers < 1) {
      setError('Please select the number of players.');
      return;
    }

    setError('');
    setSelectedSlot(slot);
    setNavigatingSlot(slot.startTime);

    // Automatic progression to Step 3 once valid slot is clicked
    setTimeout(() => {
      setNavigatingSlot(null);
      setStep(3);
    }, 180);
  };

  // Final Confirmation Submit -> Counter Payment (Pay at Venue)
  const handleConfirmReservation = async () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    if (!selectedDevice || !bookingDate || !selectedSlot) {
      setError('Missing booking details or time slot selection. Please go back and verify.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const isPS5 = selectedDevice.deviceType === 'PS5';
      const payload = {
        deviceId: selectedDevice._id,
        gameId: null,
        pricingCategory: isPS5 ? pricingCategory : 'NONE',
        gameClassification: isPS5 ? pricingCategory : 'NONE',
        isVenueSelection: isPS5,
        bookingType: isPS5 ? bookingType : bookingType,
        bookingDate,
        startTime: selectedSlot.startTime,
        duration,
        numberOfPlayers,
      };

      const res = await bookingApi.createBooking(payload);
      if (!res.success || !res.data?.booking) {
        throw new Error(res.message || 'Failed to create reservation.');
      }

      const newBooking = res.data.booking;
      setConfirmedBooking(newBooking);
      setStep(4);
      fetchAvailability();
      window.dispatchEvent(new Event('booking_updated'));
      showToast.success('Reservation confirmed! See you at the counter 🎮');
      if (onBookingComplete) onBookingComplete(newBooking);
    } catch (err) {
      setError(err.message || 'Booking submission failed. Please try again.');
      fetchAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  // Online Payment Submit (Razorpay) -> Guarded by Admin-controlled enableOnlinePayments flag
  const handlePayOnline = async () => {
    if (!enableOnlinePayments) {
      showToast.error('Online payments are currently unavailable. Please pay at the venue.');
      return;
    }

    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    if (!selectedDevice || !bookingDate || !selectedSlot) {
      setError('Missing booking details or time slot selection. Please go back and verify.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      let targetBooking = confirmedBooking;
      if (!targetBooking) {
        const isPS5 = selectedDevice.deviceType === 'PS5';
        const payload = {
          deviceId: selectedDevice._id,
          gameId: null,
          pricingCategory: isPS5 ? pricingCategory : 'NONE',
          gameClassification: isPS5 ? pricingCategory : 'NONE',
          isVenueSelection: isPS5,
          bookingType: isPS5 ? bookingType : bookingType,
          bookingDate,
          startTime: selectedSlot.startTime,
          duration,
          numberOfPlayers,
        };
        const res = await bookingApi.createBooking(payload);
        if (!res.success || !res.data?.booking) {
          throw new Error(res.message || 'Failed to create reservation.');
        }
        targetBooking = res.data.booking;
        setConfirmedBooking(targetBooking);
        fetchAvailability();
        window.dispatchEvent(new Event('booking_updated'));
      }

      const orderRes = await paymentApi.createOrder({
        bookingId: targetBooking._id,
        paymentPurpose: 'BOOKING_FULL',
      });
      if (!orderRes.success || !orderRes.data) {
        throw new Error(orderRes.message || 'Unable to initiate online payment order.');
      }

      setRazorpayOrder(orderRes.data);
      setRazorpayModalOpen(true);
    } catch (err) {
      setError(err.message || 'Could not initiate online payment.');
      fetchAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = (paymentData) => {
    setRazorpayModalOpen(false);
    setConfirmedPayment(paymentData);
    setConfirmedBooking((prev) =>
      prev
        ? {
            ...prev,
            paymentStatus: 'PAID',
            amountPaid: prev.totalAmount,
            balanceRemaining: 0,
          }
        : prev
    );
    setStep(4);
    fetchAvailability();
    window.dispatchEvent(new Event('booking_updated'));
    showToast.success('Online payment successful! Reservation confirmed.');
    if (onBookingComplete && confirmedBooking) {
      onBookingComplete(confirmedBooking);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 max-h-[92vh] flex flex-col bg-white dark:bg-[#260D17] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Wizard Header & Modern Step Indicator */}
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#851B2B] dark:text-[#D7FF00] font-bold">
              {step <= 3 ? `Step ${step} of 3` : 'Booking Complete'}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black font-heading text-slate-900 dark:text-white uppercase tracking-wider mt-0.5">
            {step === 1 && 'CHOOSE STATION & PRICING'}
            {step === 2 && 'TIMING & BOOKING DETAILS'}
            {step === 3 && 'REVIEW & VENUE PAYMENT'}
            {step === 4 && 'RESERVATION CONFIRMED'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {step <= 3 && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {[
                { s: 1, label: 'Station' },
                { s: 2, label: 'Timing' },
                { s: 3, label: 'Review' },
              ].map(({ s }) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s < step) setStep(s);
                  }}
                  disabled={s > step}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                    step === s
                      ? 'bg-[#851B2B] text-white font-heading shadow-md shadow-[#851B2B]/40 ring-2 ring-[#851B2B]/30'
                      : step > s
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-pointer hover:scale-105'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                  }`}
                  title={`Go to step ${s}`}
                >
                  {step > s ? '✓' : s}
                </button>
              ))}
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors"
              title="Close Booking Wizard"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="mt-3 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Scrollable Wizard Body */}
      <div className="overflow-y-auto flex-1 space-y-4 sm:space-y-6 pt-3 pr-1">
        {/* ========================================================================= */}
        {/* STEP 1: SELECT GAMING STATION & EMBEDDED PRICING (AUTO ADVANCES ON CLICK) */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Choose your station and pricing category. Clicking any option will{' '}
                <span className="font-semibold text-[#851B2B] dark:text-[#D7FF00]">
                  automatically advance
                </span>{' '}
                to Timing Selection.
              </p>
            </div>

            {/* Station Options Cards: Pricing options embedded directly inside each card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {devices.map((device) => {
                const isPS5 = device.deviceType === 'PS5';
                const isPool = device.deviceType === 'POOL';

                return (
                  <div
                    key={device._id}
                    className="p-5 rounded-2xl border bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between transition-all"
                  >
                    {/* Card Top: Station Header & Info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div
                          className={`p-2.5 rounded-xl ${
                            isPS5
                              ? 'bg-[#851B2B]/10 text-[#851B2B] dark:text-[#D7FF00]'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {isPS5 ? <Gamepad2 className="w-5 h-5" /> : <CircleDot className="w-5 h-5" />}
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                          {device.deviceCode}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base font-heading">
                          {device.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {device.description ||
                            (isPS5
                              ? '4K 120Hz Sony PlayStation 5 lounge console'
                              : 'Championship grade 8-ball billiards pool table')}
                        </p>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-medium">
                          <Users className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> Max{' '}
                          {device.capacity} Players
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          ● Station Ready
                        </span>
                      </div>
                    </div>

                    {/* Card Bottom: Embedded Pricing Options Directly Inside The Card */}
                    <div className="mt-5 pt-3.5 border-t border-slate-200 dark:border-slate-800/80">
                      {isPS5 ? (
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                            Select Category to Continue:
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Non-Exclusive Button Inside Station Card */}
                            <button
                              type="button"
                              onClick={() => handleSelectStationPricing(device, 'NON_EXCLUSIVE')}
                              className={`p-2.5 rounded-xl border text-left transition-all group flex flex-col justify-between ${
                                navigatingKey === `${device._id}_NON_EXCLUSIVE`
                                  ? 'bg-[#851B2B] text-white border-[#851B2B] ring-2 ring-[#851B2B]'
                                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-[#851B2B] hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95'
                              }`}
                            >
                              <span className="text-[10px] font-black font-heading tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                                NON-EXCLUSIVE
                              </span>
                              <div className="mt-1">
                                <span className="text-base font-black font-heading text-slate-900 dark:text-white block">
                                  ₹{ps5NonExclusiveRate}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-mono">
                                  / hr / player
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-[#851B2B] dark:text-[#D7FF00] mt-1.5 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                Book &rarr;
                              </span>
                            </button>

                            {/* Exclusive Button Inside Station Card */}
                            <button
                              type="button"
                              onClick={() => handleSelectStationPricing(device, 'EXCLUSIVE')}
                              className={`p-2.5 rounded-xl border text-left transition-all group flex flex-col justify-between ${
                                navigatingKey === `${device._id}_EXCLUSIVE`
                                  ? 'bg-[#851B2B] text-white border-[#851B2B] ring-2 ring-[#851B2B]'
                                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-[#851B2B] hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95'
                              }`}
                            >
                              <span className="text-[10px] font-black font-heading tracking-wider text-amber-600 dark:text-[#F5B942] uppercase">
                                EXCLUSIVE
                              </span>
                              <div className="mt-1">
                                <span className="text-base font-black font-heading text-slate-900 dark:text-white block">
                                  ₹{ps5ExclusiveRate}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-mono">
                                  / hr / player
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-[#851B2B] dark:text-[#D7FF00] mt-1.5 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                Book &rarr;
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* Pool Table Direct Button Inside Card */}
                          <button
                            type="button"
                            onClick={() => handleSelectStationPricing(device, 'NONE')}
                            className={`w-full p-3 rounded-xl border text-center transition-all group flex items-center justify-between ${
                              navigatingKey === `${device._id}_NONE`
                                ? 'bg-[#851B2B] text-white border-[#851B2B] ring-2 ring-[#851B2B]'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-[#851B2B] hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95'
                            }`}
                          >
                            <div className="text-left">
                              <span className="text-[10px] font-black font-heading tracking-wider text-purple-600 dark:text-purple-400 uppercase block">
                                TOURNAMENT POOL
                              </span>
                              <span className="text-base font-black font-heading text-slate-900 dark:text-white block">
                                ₹{poolRate} <span className="text-[10px] font-normal text-slate-500 font-mono">/ hour</span>
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#851B2B] dark:text-[#D7FF00] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              Reserve &rarr;
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: TIMING, DURATION, PLAYERS & SLOTS (AUTO ADVANCES ON SLOT CLICK)  */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Top Selection Summary / Change Station Pill */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white font-heading">
                  {selectedDevice?.name}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold text-[#851B2B] dark:text-[#D7FF00]">
                  {selectedDevice?.deviceType === 'POOL'
                    ? `Tournament Table (₹${poolRate}/hr)`
                    : pricingCategory === 'EXCLUSIVE'
                    ? `EXCLUSIVE (₹${ps5ExclusiveRate}/player/hr)`
                    : `NON-EXCLUSIVE (₹${ps5NonExclusiveRate}/player/hr)`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[11px] font-bold text-[#851B2B] dark:text-[#D7FF00] hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Change Station / Pricing
              </button>
            </div>

            {/* Configurable Details: Date, Duration, Mode, Players */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Date */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[11px] font-bold font-heading uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> 1. Booking Date
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#171014] border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-[#851B2B] outline-none"
                />
              </div>

              {/* 2. Duration */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[11px] font-bold font-heading uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> 2. Duration
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((hr) => (
                    <button
                      key={hr}
                      type="button"
                      onClick={() => setDuration(hr)}
                      className={`py-2 rounded-lg text-xs font-bold font-heading transition-all ${
                        duration === hr
                          ? 'bg-[#851B2B] text-white shadow-sm'
                          : 'bg-white dark:bg-[#171014] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {hr} hr{hr > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Number of Players */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[11px] font-bold font-heading uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> 3. Players
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].slice(0, maxStationPlayers).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumberOfPlayers(num)}
                      className={`py-2 rounded-lg text-xs font-bold font-heading transition-all ${
                        numberOfPlayers === num
                          ? 'bg-[#851B2B] text-white shadow-sm'
                          : 'bg-white dark:bg-[#171014] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {num}P
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Booking Mode (Shared vs Private) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[11px] font-bold font-heading uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> 4. Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBookingType('SHARED')}
                    className={`py-2 rounded-lg text-xs font-bold font-heading transition-all ${
                      bookingType === 'SHARED'
                        ? 'bg-[#851B2B] text-white shadow-sm'
                        : 'bg-white dark:bg-[#171014] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    Shared
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingType('PRIVATE')}
                    className={`py-2 rounded-lg text-xs font-bold font-heading transition-all ${
                      bookingType === 'PRIVATE'
                        ? 'bg-[#851B2B] text-white shadow-sm'
                        : 'bg-white dark:bg-[#171014] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>
            </div>

            {/* Late Night Banner if today's slots ended */}
            {allTodaySlotsPassed && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>All session slots for today have ended. Switch to tomorrow to view available slots.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingDate(tomorrowStr)}
                  className="px-3 py-1.5 rounded-lg bg-[#851B2B] hover:bg-[#6e1623] text-white font-bold font-heading text-[11px] uppercase tracking-wider transition-colors"
                >
                  Switch to Tomorrow ({tomorrowStr})
                </button>
              </div>
            )}

            {/* Available Time Slots Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white uppercase tracking-wider">
                    Select Available Time Slot:
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Click any open slot to <span className="font-semibold text-[#851B2B] dark:text-[#D7FF00]">automatically proceed</span> to final review.
                  </p>
                </div>
                {slotsLoading && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying live slots...
                  </span>
                )}
              </div>

              {/* Slot Error Banner with Retry */}
              {slotsError ? (
                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2 text-xs">
                  <p className="text-rose-600 dark:text-rose-300 font-semibold">{slotsError}</p>
                  <button
                    type="button"
                    onClick={fetchAvailability}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#851B2B] text-white font-bold font-heading text-xs uppercase tracking-wider hover:bg-[#6e1623] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry Availability Check
                  </button>
                </div>
              ) : dateClosureReason ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs sm:text-sm text-center">
                  {dateClosureReason}
                </div>
              ) : availabilitySlots.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 text-center text-xs">
                  {slotsLoading ? 'Querying live station schedules...' : 'No time slots available for the selected date.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5 max-h-[36vh] overflow-y-auto pr-1">
                  {availabilitySlots.map((slot) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime;
                    const isNavigating = navigatingSlot === slot.startTime;
                    const available = isSlotAvailable(slot);

                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!available || slotsLoading}
                        onClick={() => handleSelectSlot(slot)}
                        className={`p-2.5 rounded-xl border text-center transition-all select-none ${
                          slotsLoading
                            ? 'opacity-50 cursor-wait bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/40'
                            : isNavigating || isSelected
                            ? 'bg-[#851B2B] text-white border-[#851B2B] shadow-lg shadow-[#851B2B]/40 ring-2 ring-[#851B2B]'
                            : available
                            ? 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-[#851B2B] hover:shadow-md cursor-pointer text-slate-800 dark:text-slate-200'
                            : 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <span className="block font-bold font-mono text-xs sm:text-sm">
                          {format12HourTime(slot.startTime)}
                        </span>
                        <span className="block text-[10px] mt-0.5 opacity-80">
                          {slot.isPast
                            ? 'Past'
                            : slot.status === 'MAINTENANCE'
                            ? 'Maintenance'
                            : available
                            ? `${slot.remainingPlayers || 1} seat${(slot.remainingPlayers || 1) > 1 ? 's' : ''}`
                            : 'Booked'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: REVIEW & PAYMENT AT VENUE                                         */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Booking Summary Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold font-heading uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Reservation Summary
                </span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-[#851B2B] dark:text-[#D7FF00] hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Modify Timing / Players
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Station</span>
                  <span className="font-bold font-heading text-sm text-slate-900 dark:text-white mt-0.5 block">
                    {selectedDevice?.name}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Pricing Category</span>
                  <span className="font-bold text-sm text-[#851B2B] dark:text-[#D7FF00] mt-0.5 block">
                    {selectedDevice?.deviceType === 'POOL'
                      ? 'Tournament Pool Table'
                      : pricingCategory === 'EXCLUSIVE'
                      ? 'Exclusive PS5 Game'
                      : 'Non-Exclusive PS5 Game'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Date & Slot</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block font-mono">
                    {bookingDate} &bull; {selectedSlot?.endTime ? format12HourRange(selectedSlot.startTime, selectedSlot.endTime) : format12HourTime(selectedSlot?.startTime)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Duration</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {duration} hour{duration > 1 ? 's' : ''}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Players & Mode</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {numberOfPlayers} Player{numberOfPlayers > 1 ? 's' : ''} ({bookingType})
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Unit Rate</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block font-mono">
                    ₹{selectedDevice?.deviceType === 'POOL' ? poolRate : pricingCategory === 'EXCLUSIVE' ? ps5ExclusiveRate : ps5NonExclusiveRate} / hr / p
                  </span>
                </div>
              </div>

              {/* Price Calculation Breakdown */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <span>
                    Formula: {numberOfPlayers} Player{numberOfPlayers > 1 ? 's' : ''} × ₹{selectedDevice?.deviceType === 'POOL' ? poolRate : pricingCategory === 'EXCLUSIVE' ? ps5ExclusiveRate : ps5NonExclusiveRate} × {duration} hr{duration > 1 ? 's' : ''}
                  </span>
                  {pricingQuote?.membershipBenefit?.applied && (
                    <span className="block text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ Membership Benefit Applied: -₹{Math.round((pricingQuote.membershipBenefit.discountPaise || 0) / 100)}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Payable at Counter</span>
                  <span className="text-2xl font-black font-heading text-slate-900 dark:text-white">
                    ₹{pricingQuote ? Math.round(pricingQuote.totalAmountPaise / 100) : (numberOfPlayers * (selectedDevice?.deviceType === 'POOL' ? poolRate : pricingCategory === 'EXCLUSIVE' ? ps5ExclusiveRate : ps5NonExclusiveRate) * duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* PAYMENT AT VENUE MANDATORY BANNER */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h4 className="font-bold font-heading text-sm text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  PAYMENT AT VENUE
                </h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  No online payment or credit card advance required. Your slot is held immediately upon confirmation. Please present your booking reference at the NOAH GAMING front desk counter to pay via Cash or Counter UPI and choose your title.
                </p>
              </div>
            </div>

            {/* Actions: Back + Smart Payment Buttons */}
            {(() => {
              const totalRupees = pricingQuote
                ? Math.round(pricingQuote.totalAmountPaise / 100)
                : (numberOfPlayers * (selectedDevice?.deviceType === 'POOL' ? poolRate : pricingCategory === 'EXCLUSIVE' ? ps5ExclusiveRate : ps5NonExclusiveRate) * duration);
              const isZeroPayment = totalRupees === 0;
              return (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold font-heading text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Timing
                    </button>

                    {isZeroPayment ? (
                      /* ₹0 total – membership covers everything – single Confirm button */
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleConfirmReservation}
                        className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black font-heading text-xs uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.01]"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Confirming...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>CONFIRM BOOKING</span>
                          </>
                        )}
                      </button>
                    ) : (
                      /* Normal payment: PAY ONLINE (feature-flag) + PAY AT VENUE */
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        {/* Pay Online Button - Always Visible, Disabled by Default unless Admin Enables */}
                        <button
                          type="button"
                          disabled={!enableOnlinePayments || submitting}
                          onClick={handlePayOnline}
                          aria-disabled={!enableOnlinePayments}
                          title={
                            enableOnlinePayments
                              ? 'Pay online securely via Razorpay UPI / Cards'
                              : 'Online payments are currently unavailable'
                          }
                          className={`px-5 py-3 rounded-xl font-bold font-heading text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                            enableOnlinePayments
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/25 cursor-pointer'
                              : 'bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-65'
                          }`}
                        >
                          {enableOnlinePayments ? (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>PAY ONLINE</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>PAY ONLINE</span>
                            </>
                          )}
                        </button>

                        {/* Pay at Venue Button - Always Available */}
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleConfirmReservation}
                          className="px-6 py-3 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-black font-heading text-xs uppercase tracking-wider transition-all shadow-xl shadow-[#851B2B]/30 disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.01]"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Confirming...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              <span>PAY AT VENUE / CONFIRM</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isZeroPayment && !enableOnlinePayments && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right flex items-center justify-end gap-1">
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>Online payments are currently unavailable.</span>
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: RESERVATION CONFIRMED & RECEIPT VIEW                              */}
        {/* ========================================================================= */}
        {step === 4 && confirmedBooking && (
          <div className="space-y-5 animate-fadeIn text-center py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-500 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">
                Booking ID: {confirmedBooking.bookingId}
              </span>
              <h3 className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white uppercase tracking-wider mt-1">
                RESERVATION CONFIRMED
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Your station has been reserved. Please arrive 10 minutes prior to your start time.
              </p>
            </div>

            {/* Booking Details Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 max-w-lg mx-auto text-left text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Station & Title:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {confirmedBooking.device?.name || selectedDevice?.name} •{' '}
                  {(confirmedBooking.device?.deviceType || selectedDevice?.deviceType) === 'POOL'
                    ? 'Tournament 8-Ball Pool'
                    : 'Title Selected at Venue'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Scheduled Time:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {confirmedBooking.bookingDate} •{' '}
                  {confirmedBooking.endTime
                    ? format12HourRange(confirmedBooking.startTime, confirmedBooking.endTime)
                    : format12HourTime(confirmedBooking.startTime)}{' '}
                  ({confirmedBooking.duration} hr{confirmedBooking.duration > 1 ? 's' : ''})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Players:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {confirmedBooking.numberOfPlayers} Player{confirmedBooking.numberOfPlayers > 1 ? 's' : ''} ({confirmedBooking.bookingType})
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {confirmedBooking.paymentStatus === 'PAID' ? 'Paid Online:' : 'Payable at Counter:'}
                </span>
                <span className="text-lg font-black font-heading text-[#851B2B] dark:text-[#D7FF00]">
                  ₹{Math.round(confirmedBooking.totalAmount / 100)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReceiptModalOpen(true)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold font-heading text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-[#851B2B] dark:text-[#D7FF00]" />
                <span>View Receipt</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] text-white font-bold font-heading text-xs uppercase tracking-wider transition-all shadow-md shadow-[#851B2B]/20"
              >
                Done / Back to Lounge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Razorpay Checkout Modal (Only opened when Admin enables Online Payments) */}
      {razorpayModalOpen && razorpayOrder && confirmedBooking && (
        <RazorpayModal
          order={razorpayOrder}
          bookingDetails={confirmedBooking}
          onSuccess={handlePaymentSuccess}
          onClose={() => setRazorpayModalOpen(false)}
        />
      )}

      {/* Embedded Receipt Modal */}
      {receiptModalOpen && confirmedBooking && (
        <ReceiptModal
          paymentId={confirmedPayment?.paymentId}
          bookingId={confirmedBooking?._id}
          booking={confirmedBooking}
          onClose={() => setReceiptModalOpen(false)}
        />
      )}
    </div>
  );
};
