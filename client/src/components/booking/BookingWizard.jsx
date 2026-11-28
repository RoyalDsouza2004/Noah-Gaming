import React, { useState, useEffect, useRef } from 'react';
import { bookingApi } from '../../api/booking.js';
import { equipmentApi } from '../../api/equipment.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { ReceiptModal } from '../payment/ReceiptModal.jsx';
import { showToast } from '../../utils/toast.js';
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
} from 'lucide-react';

export const BookingWizard = ({ initialDevice, initialGame, onBookingComplete, onClose }) => {
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const { isLight } = useTheme();

  // Step 1 = Station & Pricing Category
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
  const [navigatingCategory, setNavigatingCategory] = useState(null); // visual confirmation before auto-nav

  // Date & Duration selection
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [bookingDate, setBookingDate] = useState(todayStr);
  const [duration, setDuration] = useState(1); // in hours
  const [bookingType, setBookingType] = useState('SHARED'); // 'SHARED' or 'PRIVATE'
  const [numberOfPlayers, setNumberOfPlayers] = useState(1);

  // Availability & Slots
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [dateClosureReason, setDateClosureReason] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [navigatingSlot, setNavigatingSlot] = useState(null); // visual confirmation before auto-nav

  // Server-side Pricing Quote
  const [pricingQuote, setPricingQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Final Confirmed Booking
  const [confirmedBooking, setConfirmedBooking] = useState(null);
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

        if (devRes.success) {
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

  // Derive dynamic pricing from backend configuration with safe fallbacks
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
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedDevice || !bookingDate) return;
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const res = await bookingApi.getAvailability(
          selectedDevice._id,
          bookingDate,
          duration,
          null
        );
        if (res.success && res.data) {
          setAvailabilitySlots(res.data.slots || []);
          setDateClosureReason(res.data.isClosed ? res.data.closureReason || 'Gaming lounge is closed on this date.' : null);
        }
      } catch (err) {
        console.warn('Availability check failed:', err.message);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchAvailability();
  }, [selectedDevice, bookingDate, duration]);

  // Fetch precision pricing quote from backend
  useEffect(() => {
    const fetchQuote = async () => {
      if (!selectedDevice) return;
      setQuoteLoading(true);
      try {
        const res = await equipmentApi.calculatePrice({
          deviceId: selectedDevice._id,
          gameId: null,
          pricingCategory: selectedDevice.deviceType === 'POOL' ? 'NONE' : pricingCategory,
          gameClassification: selectedDevice.deviceType === 'POOL' ? 'NONE' : pricingCategory,
          isVenueSelection: true,
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

  // Handle PS5 Pricing Category selection -> AUTOMATIC NAVIGATION TO TIMING (Step 2)
  const handleSelectPricingCategory = (category) => {
    setPricingCategory(category);
    setNavigatingCategory(category);
    setError('');

    // Brief 150ms visual confirmation of selection before automatic navigation
    setTimeout(() => {
      setNavigatingCategory(null);
      setStep(2);
    }, 150);
  };

  // Handle Pool Table selection -> AUTOMATIC NAVIGATION TO TIMING (Step 2)
  const handleSelectPoolStation = (device) => {
    setSelectedDevice(device);
    setPricingCategory('NONE');
    setBookingType('SHARED');
    setNavigatingCategory('POOL');
    setError('');

    setTimeout(() => {
      setNavigatingCategory(null);
      setStep(2);
    }, 150);
  };

  // Handle Live Slot Selection -> AUTOMATIC NAVIGATION TO REVIEW (Step 3)
  const handleSelectSlot = (slot) => {
    if (!slot.available) {
      setError('This time slot is fully booked. Please choose an alternate slot.');
      return;
    }

    // Verify all required booking details are present before automatic progression
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
    if (selectedDevice?.deviceType !== 'POOL' && !bookingType) {
      setError('Please select booking mode (Shared or Private).');
      return;
    }

    setError('');
    setSelectedSlot(slot);
    setNavigatingSlot(slot.startTime);

    // Automatic progression to Step 3 once valid slot is clicked
    setTimeout(() => {
      setNavigatingSlot(null);
      setStep(3);
    }, 200);
  };

  // Final Confirmation Submit -> Counter Payment Only
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
      const payload = {
        deviceId: selectedDevice._id,
        gameId: null,
        pricingCategory: selectedDevice.deviceType === 'POOL' ? 'NONE' : pricingCategory,
        gameClassification: selectedDevice.deviceType === 'POOL' ? 'NONE' : pricingCategory,
        isVenueSelection: true,
        bookingType: selectedDevice.deviceType === 'POOL' ? 'SHARED' : bookingType,
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
      showToast.success('Reservation confirmed! See you at the counter 🎮');
      if (onBookingComplete) onBookingComplete(newBooking);
    } catch (err) {
      setError(err.message || 'Booking submission failed. Please try again.');
    } finally {
      setSubmitting(false);
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
            {step === 1 && 'CHOOSE GAMING STATION'}
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
        {/* STEP 1: SELECT GAMING STATION & PRICING CATEGORY (AUTOMATIC NAVIGATION) */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Select your station. Clicking your preferred pricing option will <span className="font-semibold text-[#851B2B] dark:text-[#D7FF00]">automatically advance</span> to Timing & Details.
              </p>
            </div>

            {/* Station Options Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {devices.map((device) => {
                const isSelected = selectedDevice?._id === device._id;
                const isPS5 = device.deviceType === 'PS5';

                return (
                  <div
                    key={device._id}
                    onClick={() => {
                      if (!isPS5) {
                        handleSelectPoolStation(device);
                      } else {
                        setSelectedDevice(device);
                      }
                    }}
                    className={`p-5 rounded-2xl transition-all border flex flex-col justify-between cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/80 dark:bg-[#171014] border-[#851B2B] shadow-xl shadow-[#851B2B]/20 ring-2 ring-[#851B2B]'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-[#851B2B]/50 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${isPS5 ? 'bg-[#851B2B]/10 text-[#851B2B] dark:text-[#D7FF00]' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
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
                          {device.description || (isPS5 ? '4K 120Hz Sony PlayStation 5 lounge console' : 'Championship grade 8-ball billiards pool table')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> Up to {device.capacity} Players
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {isPS5 ? (isSelected ? 'Selected Console' : 'Select Station') : `₹${poolRate}/hr • Tap to Book`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* When a PS5 station is active: Show the two distinct pricing categories */}
            {selectedDevice && selectedDevice.deviceType === 'PS5' && (
              <div className="pt-2 animate-fadeIn space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F5B942]" />
                    Choose Pricing Category for {selectedDevice.name}:
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">Tap any option to advance</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: NON-EXCLUSIVE */}
                  <div
                    onClick={() => handleSelectPricingCategory('NON_EXCLUSIVE')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between group ${
                      navigatingCategory === 'NON_EXCLUSIVE'
                        ? 'bg-[#851B2B]/20 border-[#851B2B] ring-2 ring-[#851B2B] scale-[0.99]'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-[#851B2B] hover:shadow-xl hover:shadow-[#851B2B]/10 hover:bg-slate-50 dark:hover:bg-[#171014]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black font-heading tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          NON-EXCLUSIVE
                        </span>
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white">
                            ₹{ps5NonExclusiveRate}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            per player / hour
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-3 group-hover:text-[#851B2B] dark:group-hover:text-[#D7FF00] transition-colors">
                        Standard Lounge Titles
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Access NOAH GAMING’s wide library of multiplayer, sports, racing, and fighting titles (EA FC 25, Tekken 8, GT7, Spider-Man 2 & more).
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-[#851B2B] dark:text-[#D7FF00] font-bold">
                      <span>Shared or Private Station</span>
                      <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Select Non-Exclusive <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Option 2: EXCLUSIVE */}
                  <div
                    onClick={() => handleSelectPricingCategory('EXCLUSIVE')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between group ${
                      navigatingCategory === 'EXCLUSIVE'
                        ? 'bg-[#851B2B]/20 border-[#851B2B] ring-2 ring-[#851B2B] scale-[0.99]'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-[#851B2B] hover:shadow-xl hover:shadow-[#851B2B]/10 hover:bg-slate-50 dark:hover:bg-[#171014]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black font-heading tracking-wider bg-amber-500/15 text-amber-600 dark:text-[#F5B942] border border-amber-500/30">
                          EXCLUSIVE
                        </span>
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white">
                            ₹{ps5ExclusiveRate}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            per player / hour
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-3 group-hover:text-[#851B2B] dark:group-hover:text-[#D7FF00] transition-colors">
                        Exclusive Premium Experience
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Dedicated high-performance console allocation for flagship exclusive releases (such as GTA 6 & VIP console privileges).
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-[#851B2B] dark:text-[#D7FF00] font-bold">
                      <span>Priority Hardware Lock</span>
                      <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Select Exclusive <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                    ? '8-Ball Pool Table'
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

            {/* Available Time Slots Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white uppercase tracking-wider">
                    Select Available Time Slot:
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Click any available slot to <span className="font-semibold text-[#851B2B] dark:text-[#D7FF00]">automatically proceed</span> to final review.
                  </p>
                </div>
                {slotsLoading && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking slots...
                  </span>
                )}
              </div>

              {dateClosureReason ? (
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
                    const isAvailable = slot.available;

                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => handleSelectSlot(slot)}
                        className={`p-2.5 rounded-xl border text-center transition-all select-none ${
                          isNavigating || isSelected
                            ? 'bg-[#851B2B] text-white border-[#851B2B] shadow-lg shadow-[#851B2B]/40 ring-2 ring-[#851B2B]'
                            : isAvailable
                            ? 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-[#851B2B] hover:shadow-md cursor-pointer text-slate-800 dark:text-slate-200'
                            : 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <span className="block font-bold font-mono text-sm">
                          {slot.startTime}
                        </span>
                        <span className="block text-[10px] mt-0.5 opacity-80">
                          {isAvailable ? `${slot.remainingPlayers || 1} seat${(slot.remainingPlayers || 1) > 1 ? 's' : ''}` : 'Booked'}
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
                    {bookingDate} @ {selectedSlot?.startTime}
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

            {/* Actions: Back & Confirm Action */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold font-heading text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Timing
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmReservation}
                className="px-6 py-3 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-black font-heading text-xs uppercase tracking-wider transition-all shadow-xl shadow-[#851B2B]/30 disabled:opacity-50 flex items-center gap-2 hover:scale-[1.01]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>CONFIRM RESERVATION (PAY AT VENUE)</span>
                  </>
                )}
              </button>
            </div>
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
                  {confirmedBooking.device?.name || selectedDevice?.name} • Select at Venue
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Scheduled Time:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {confirmedBooking.bookingDate} @ {confirmedBooking.startTime} ({confirmedBooking.duration} hr{confirmedBooking.duration > 1 ? 's' : ''})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Players:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {confirmedBooking.numberOfPlayers} Player{confirmedBooking.numberOfPlayers > 1 ? 's' : ''} ({confirmedBooking.bookingType})
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Payable at Counter:</span>
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

      {/* Embedded Receipt Modal */}
      {receiptModalOpen && confirmedBooking && (
        <ReceiptModal
          booking={confirmedBooking}
          onClose={() => setReceiptModalOpen(false)}
        />
      )}
    </div>
  );
};
