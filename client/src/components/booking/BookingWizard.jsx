import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../api/booking.js';
import { equipmentApi } from '../../api/equipment.js';
import { paymentApi } from '../../api/payment.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { RazorpayModal } from '../payment/RazorpayModal.jsx';
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
  Smartphone,
  Crown,
  AlertTriangle,
} from 'lucide-react';

export const isGameMultiplayer = (game) => {
  if (!game) return false;
  if (game.isExclusive) return false; // Exclusive titles like GTA 6 have their own private console lock
  if (game.bookingMode === 'PRIVATE_ONLY') return false;
  if (game.bookingMode === 'SHARED') return true;

  // Single player check: if maximum supported players is 1, it is strictly single player
  const maxP = game.maxPlayers || 1;
  const localP = game.localPlayersSupported || 1;
  if (maxP <= 1 && localP <= 1) {
    return false;
  }

  // If game supports multiple local/couch or shared players
  if (maxP > 1 || localP > 1) {
    return true;
  }

  if (game.multiplayer) {
    if (game.multiplayer.localCoop || game.multiplayer.splitScreen) return true;
    if (game.multiplayer.maxOfflineMultiplayerPlayers && game.multiplayer.maxOfflineMultiplayerPlayers > 1) return true;
    if (game.multiplayer.maxOnlinePlayers && game.multiplayer.maxOnlinePlayers > 1) return true;
  }

  return false;
};

export const BookingWizard = ({ initialDevice, initialGame, onBookingComplete, onClose }) => {
  const { user, isAuthenticated, openLoginModal } = useAuth();

  // Wizard Step: 1 = Device, 2 = Game, 3 = Date/Time/Slot, 4 = Players & Pricing, 5 = Confirmation
  const [step, setStep] = useState(initialGame ? 3 : 1);

  // Data
  const [devices, setDevices] = useState([]);
  const [games, setGames] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selections
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDevice, setSelectedDevice] = useState(initialDevice || null);
  const [selectedGame, setSelectedGame] = useState(initialGame || null);
  const [isVenueSelection, setIsVenueSelection] = useState(false);

  // Date & Duration selection (default Tomorrow in YYYY-MM-DD IST)
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const [bookingDate, setBookingDate] = useState(todayStr);
  const [duration, setDuration] = useState(1); // in hours
  const [bookingType, setBookingType] = useState('SHARED'); // 'SHARED' or 'PRIVATE'

  // Availability & Slots
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [dateClosureReason, setDateClosureReason] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Player count & Pricing
  const [numberOfPlayers, setNumberOfPlayers] = useState(1);
  const [pricingQuote, setPricingQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Membership benefit states (derived from backend quote)
  const membershipBenefit = pricingQuote?.membershipBenefit || null;
  const isMembershipFullyCovered = membershipBenefit?.isFullyCovered === true || (pricingQuote && pricingQuote.totalAmountPaise === 0 && membershipBenefit?.applied);
  const membershipAdvanceLimit = membershipBenefit?.advanceBookingLimit || null;

  // Calculate max booking date string based on active membership advance limit in Asia/Kolkata
  const maxBookingDateStr = (() => {
    if (!membershipAdvanceLimit) return null;
    const now = new Date();
    // IST offset: +5:30
    const istNow = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
    const maxDate = new Date(istNow.getTime() + Number(membershipAdvanceLimit) * 24 * 60 * 60 * 1000);
    return maxDate.toISOString().split('T')[0];
  })();

  // Final Confirmed Booking & Phase 4 Payment States
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState('ONLINE'); // 'ONLINE' | 'COUNTER'
  const [razorpayOrder, setRazorpayOrder] = useState(null);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [tempBookingForPayment, setTempBookingForPayment] = useState(null);

  // Load Devices and Games
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [devRes, gmRes, catRes, prRes] = await Promise.all([
          equipmentApi.getDevices('status=ACTIVE'),
          equipmentApi.getGames('status=ACTIVE'),
          equipmentApi.getCategories('status=ACTIVE'),
          equipmentApi.getPricing('status=ACTIVE').catch(() => null),
        ]);

        if (devRes.success) {
          setDevices(devRes.data.devices);
          if (initialDevice) {
            const found = devRes.data.devices.find((d) => d._id === (initialDevice._id || initialDevice));
            setSelectedDevice(found || devRes.data.devices[0]);
          } else if (initialGame && initialGame.compatibleDevices?.length > 0) {
            const compatibleId = initialGame.compatibleDevices[0]._id || initialGame.compatibleDevices[0];
            const found = devRes.data.devices.find((d) => d._id === compatibleId);
            setSelectedDevice(found || devRes.data.devices[0]);
          } else if (devRes.data.devices.length > 0) {
            setSelectedDevice(devRes.data.devices[0]);
          }
        }
        if (gmRes.success) {
          setGames(gmRes.data.games);
          if (initialGame) {
            const matchedGame = gmRes.data.games.find((g) => g._id === (initialGame._id || initialGame));
            if (matchedGame) setSelectedGame(matchedGame);
          }
        }
        if (catRes.success) setCategories(catRes.data.categories);
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

  // Fetch real-time availability slots whenever selectedDevice, selectedGame, bookingDate, or duration changes
  const fetchAvailability = async () => {
    if (!selectedDevice || !bookingDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await bookingApi.getAvailability(
        selectedDevice._id,
        bookingDate,
        duration,
        isVenueSelection ? null : selectedGame?._id
      );
      if (res.success && res.data) {
        setAvailabilitySlots(res.data.slots || []);
        if (res.data.isClosed) {
          setDateClosureReason(res.data.closureReason || 'Gaming lounge is closed on this date.');
        } else {
          setDateClosureReason(null);
        }
      }
    } catch (err) {
      console.warn('Availability check failed:', err.message);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [selectedDevice, selectedGame, isVenueSelection, bookingDate, duration]);

  // Fetch price quote whenever device, game, duration, players, date, or bookingType change
  useEffect(() => {
    const fetchQuote = async () => {
      if (!selectedDevice) return;
      setQuoteLoading(true);
      try {
        const res = await equipmentApi.calculatePrice({
          deviceId: selectedDevice._id,
          gameId: isVenueSelection ? null : selectedGame?._id,
          isVenueSelection,
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
        console.warn('Pricing calculation error:', err.message);
      } finally {
        setQuoteLoading(false);
      }
    };
    fetchQuote();
  }, [selectedDevice, selectedGame, isVenueSelection, duration, numberOfPlayers, bookingType, bookingDate, user?._id]);

  // Minimum & Maximum selectable players for current game and state
  const getMinPlayersAllowed = () => {
    if (isVenueSelection) return 1;
    if (selectedGame?.minPlayers) {
      return Math.max(1, selectedGame.minPlayers);
    }
    return 1;
  };

  const getMaxPlayersAllowed = () => {
    if (!selectedDevice) return 1;
    const gameMax = isVenueSelection ? selectedDevice.capacity : (selectedGame?.maxPlayers || selectedDevice.capacity);

    if (bookingType === 'PRIVATE') {
      return gameMax;
    }
    if (selectedSlot) {
      return Math.min(gameMax, selectedSlot.remainingPlayers || 1);
    }
    return gameMax;
  };

  // Synchronize player count and booking mode when game or slot changes
  useEffect(() => {
    if (selectedGame && !isVenueSelection) {
      if (selectedGame.bookingMode === 'PRIVATE_ONLY' || selectedGame.isExclusive) {
        setBookingType('PRIVATE');
      } else if (isGameMultiplayer(selectedGame) || selectedGame.bookingMode === 'SHARED') {
        setBookingType('SHARED');
      }
    }

    const minP = getMinPlayersAllowed();
    const maxP = Math.max(minP, getMaxPlayersAllowed());

    if (numberOfPlayers < minP) {
      setNumberOfPlayers(minP);
    } else if (numberOfPlayers > maxP) {
      setNumberOfPlayers(maxP);
    }
  }, [selectedGame, isVenueSelection, selectedDevice, bookingType, selectedSlot]);

  const handleConfirmBooking = async () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    if (!selectedDevice || !bookingDate || !selectedSlot) {
      setError('Please select a valid device, date, and available time slot.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        deviceId: selectedDevice._id,
        gameId: isVenueSelection ? null : (selectedGame?._id || null),
        isVenueSelection,
        bookingType,
        bookingDate,
        startTime: selectedSlot.startTime,
        duration,
        numberOfPlayers,
      };

      // 1. Create booking in MongoDB (with 15-min reservation hold)
      const res = await bookingApi.createBooking(payload);
      if (!res.success || !res.data?.booking) {
        throw new Error(res.message || 'Failed to create reservation');
      }

      const newBooking = res.data.booking;
      setTempBookingForPayment(newBooking);

      // 2. If booking is fully covered by membership benefit (â‚¹0) -> no payment needed!
      if (isMembershipFullyCovered || newBooking.paymentStatus === 'PAID') {
        setConfirmedBooking(newBooking);
        setStep(5);
        showToast.success('Session confirmed! Covered by your membership benefit 🎮');
        if (onBookingComplete) onBookingComplete(newBooking);
        return;
      }

      const requiresAdvance = pricingQuote?.advanceRequired || selectedGame?.isExclusive;

      // 3. If online payment selected or mandatory GTA 6 advance required
      if (paymentChoice === 'ONLINE' || requiresAdvance) {
        const purpose = requiresAdvance ? 'GTA6_ADVANCE' : 'BOOKING_FULL';
        const orderRes = await paymentApi.createOrder({
          bookingId: newBooking._id,
          paymentPurpose: purpose,
        });

        if (orderRes.success && orderRes.data) {
          setRazorpayOrder(orderRes.data);
          setRazorpayModalOpen(true);
        } else {
          throw new Error(orderRes.message || 'Failed to initiate Razorpay payment order');
        }
      } else {
        // Counter payment selected (Regular booking)
        setConfirmedBooking(newBooking);
        setStep(5);
        showToast.success('Booking reserved successfully! Pay at the counter.');
        if (onBookingComplete) onBookingComplete(newBooking);
      }
    } catch (err) {
      setError(err.message || 'Failed to complete booking. Please try another slot.');
      showToast.error(err.message || 'Failed to complete booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = (payment, updatedBooking) => {
    setConfirmedBooking(updatedBooking || tempBookingForPayment);
    setConfirmedPayment(payment);
    setRazorpayModalOpen(false);
    setStep(5);
    showToast.success('Payment completed & session confirmed!');
    if (onBookingComplete) onBookingComplete(updatedBooking || tempBookingForPayment);
  };

  const filteredGames = games.filter((g) => {
    if (selectedCategory !== 'ALL') {
      const catId = g.category?._id || g.category;
      if (catId !== selectedCategory) return false;
    }
    // Filter compatible with selected device if any
    if (selectedDevice && g.compatibleDevices?.length > 0) {
      const compatible = g.compatibleDevices.some((d) => (d._id || d) === selectedDevice._id);
      if (!compatible) return false;
    }
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 max-h-[92vh] flex flex-col bg-white dark:bg-[#260D17] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#851B2B] dark:text-[#D7FF00]">Step {step} of 4</span>
            <span className="sm:hidden text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#171014] text-[#851B2B] dark:text-[#D7FF00] font-mono font-bold">
              {step}/4
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold font-heading text-slate-900 dark:text-white mt-0.5">
            {step === 1 && 'SELECT GAMING STATION'}
            {step === 2 && 'CHOOSE YOUR TITLE'}
            {step === 3 && 'SCHEDULE DATE & LIVE TIME SLOT'}
            {step === 4 && 'PLAYERS, MODE & PRICE REVIEW'}
            {step === 5 && 'RESERVATION CONFIRMED'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {step < 5 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-all ${
                    step === s
                      ? 'bg-[#851B2B] text-white font-heading'
                      : step > s
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-500'
                  }`}
                >
                  {step > s ? '✓' : s}
                </span>
              ))}
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Close wizard"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2 animate-fadeIn shrink-0">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Scrollable Step Body */}
      <div className="overflow-y-auto flex-1 space-y-4 sm:space-y-6 pr-1">
        {/* ---------------- STEP 1: SELECT DEVICE ---------------- */}
        {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Choose your gaming station. Each station has independent availability and capacity management.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {devices.map((device) => {
              const isSelected = selectedDevice?._id === device._id;
              return (
                <div
                  key={device._id}
                  onClick={() => setSelectedDevice(device)}
                  className={`booking-station-card p-5 rounded-2xl cursor-pointer transition-all border flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-50/70 dark:bg-[#171014] border-[#851B2B] shadow-lg shadow-[#851B2B]/20 ring-2 ring-[#851B2B]'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-[#851B2B]/40 dark:hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#851B2B] dark:text-[#D7FF00]">
                        {device.deviceType === 'POOL' ? (
                          <CircleDot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Gamepad2 className="w-5 h-5 text-[#851B2B] dark:text-[#D7FF00]" />
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                        {device.deviceCode}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base font-heading">{device.name}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{device.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> Max {device.capacity} Players
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {device.deviceType === 'POOL' ? 'Tournament Table' : 'Station Ready'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                if (selectedDevice?.deviceType === 'POOL') {
                  setSelectedGame(null);
                  setIsVenueSelection(false);
                  setStep(3);
                } else {
                  setStep(2);
                }
              }}
              disabled={!selectedDevice}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-bold font-heading text-xs uppercase tracking-wider transition-all shadow-md shadow-[#851B2B]/20 disabled:opacity-50"
            >
              <span className="text-white">
                {selectedDevice?.deviceType === 'POOL'
                  ? 'Continue to Date & Time Slots'
                  : 'Continue to Game Selection'}
              </span>{' '}
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 2: SELECT GAME ---------------- */}
      {step === 2 && (() => {
        const ps5Pricing = pricingPlans.find((p) => p.deviceType === 'PS5' && !p.game);
        const ps5RateRupees = ps5Pricing ? ps5Pricing.amount / 100 : 70;

        const getExclusiveGameRate = (game) => {
          const directPricing = pricingPlans.find(
            (p) => (p.game && (p.game === game._id || p.game._id === game._id)) || p._id === game.pricing
          );
          if (directPricing) return directPricing.amount / 100;
          const exclPricing = pricingPlans.find(
            (p) => p.deviceType === 'EXCLUSIVE' || (p.name && /GTA 6|Exclusive/i.test(p.name))
          );
          return exclPricing ? exclPricing.amount / 100 : 150;
        };

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">
                  Select a title or choose upon arrival for <strong className="text-white">{selectedDevice?.name}</strong>.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard PS5 rate: <strong className="text-emerald-400 font-mono">₹{ps5RateRupees}/hr/p</strong>. Exclusive titles lock the entire physical console.
                </p>
              </div>

              {/* Category filter */}
              <div className="flex overflow-x-auto gap-1 text-xs">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    selectedCategory === 'ALL' ? 'bg-[#851B2B] text-[#FFF4E8] font-heading' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => setSelectedCategory(c._id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === c._id ? 'bg-[#851B2B] text-[#FFF4E8] font-heading' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[360px] overflow-y-auto pr-1">
              {/* Option 1: Prominent SELECT AT VENUE card */}
              <div
                onClick={() => {
                  setIsVenueSelection(true);
                  setSelectedGame(null);
                  setBookingType('SHARED');
                }}
                className={`p-4 rounded-xl cursor-pointer border transition-all flex flex-col justify-between ${
                  isVenueSelection && !selectedGame
                    ? 'bg-[#171014] border-[#851B2B] shadow-lg shadow-[#851B2B]/25 ring-2 ring-[#851B2B]'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1 font-heading">
                      <Sparkles className="w-2.5 h-2.5" /> Non-Exclusive
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      ₹{ps5RateRupees}/hr/p
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm font-heading mt-1">Select at Venue</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Choose your game when you arrive at NOAH GAMING.
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#D7FF00] font-semibold flex items-center gap-1">
                    <Users className="w-3 h-3 text-[#D7FF00]" /> 1-4 Players
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Shared / Private
                  </span>
                </div>
              </div>

              {/* Compatible Games */}
              {filteredGames.map((game) => {
                const isSelected = !isVenueSelection && selectedGame?._id === game._id;
                const isGta6 = /GTA 6|Grand Theft Auto VI/i.test(game.name);
                const isGta6Locked = isGta6 && (game.status === 'INACTIVE' || !game.status);
                const isExclusive = Boolean(game.isExclusive || isGta6);
                const gamePriceRupees = isExclusive ? getExclusiveGameRate(game) : ps5RateRupees;

                return (
                  <div
                    key={game._id}
                    onClick={() => {
                      if (isGta6Locked) return;
                      setIsVenueSelection(false);
                      setSelectedGame(game);
                      if (game.bookingMode === 'PRIVATE_ONLY' || isExclusive) {
                        setBookingType('PRIVATE');
                      } else if (game.bookingMode === 'SHARED') {
                        setBookingType('SHARED');
                      }
                      const minP = game.minPlayers || 1;
                      const maxP = game.maxPlayers || 4;
                      if (numberOfPlayers < minP) {
                        setNumberOfPlayers(minP);
                      } else if (numberOfPlayers > maxP) {
                        setNumberOfPlayers(maxP);
                      }
                    }}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isGta6Locked
                        ? 'bg-slate-950/60 border-slate-800/50 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#171014] border-[#851B2B] shadow-lg shadow-[#851B2B]/25 ring-2 ring-[#851B2B] cursor-pointer'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        {isExclusive ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#851B2B]/30 border border-[#851B2B]/60 text-amber-300 flex items-center gap-1 font-heading">
                            <Flame className="w-2.5 h-2.5 text-amber-400" /> Exclusive
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-heading">
                            Non-Exclusive
                          </span>
                        )}

                        <span
                          className={`text-xs font-mono font-black ${
                            isExclusive ? 'text-amber-300' : 'text-emerald-400'
                          }`}
                        >
                          ₹{gamePriceRupees}/hr{isExclusive ? ' (console)' : '/p'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-white text-sm font-heading">{game.name}</h4>
                        {isGta6Locked && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold flex items-center gap-0.5 whitespace-nowrap">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{game.description}</p>
                      {isGta6Locked && (
                        <p className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                          Admin Activation Required
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#D7FF00] font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#D7FF00]" />
                        {game.minPlayers === game.maxPlayers
                          ? `${game.maxPlayers} Player${game.maxPlayers > 1 ? 's' : ''}`
                          : `${game.minPlayers || 1}-${game.maxPlayers || 4} Players`}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          isExclusive || game.bookingMode === 'PRIVATE_ONLY'
                            ? 'bg-amber-500/20 text-amber-300'
                            : isGameMultiplayer(game) || game.bookingMode === 'SHARED'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {isExclusive || game.bookingMode === 'PRIVATE_ONLY'
                          ? 'Private Only'
                          : isGameMultiplayer(game) || game.bookingMode === 'SHARED'
                          ? 'Shared Seats'
                          : 'Shared/Private'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Stations
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isVenueSelection && !selectedGame}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-bold font-heading text-xs uppercase tracking-wider shadow-md shadow-[#851B2B]/20 disabled:opacity-50"
              >
                <span className="text-white">Continue to Date & Time Slots</span> <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ---------------- STEP 3: SCHEDULE DATE, DURATION & LIVE SLOTS ---------------- */}
      {step === 3 && (
        <div className="space-y-4">
          {isVenueSelection && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-md shadow-emerald-500/10">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold font-heading uppercase text-emerald-200">
                  Select at Venue Session
                </span>
                <p className="text-[11px] text-emerald-300/90 mt-0.5">
                  You can choose any non-exclusive title upon arrival at NOAH GAMING. Billed dynamically at the standard PS5 lounge rate.
                </p>
              </div>
            </div>
          )}

          {selectedGame?.isExclusive && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/10">
              <div className="flex items-start gap-2.5">
                <Flame className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold font-heading uppercase text-amber-200">
                    GTA 6 Physical PS5 Console Lock
                  </span>
                  <p className="text-[11px] text-amber-300/90 mt-0.5">
                    Reserving GTA 6 locks the entire physical <strong>{selectedDevice?.name}</strong> console for your private session at ₹{pricingQuote?.pricingRule?.ratePerUnitRupees || 150}/hr. The other PS5 console remains independently available for regular or GTA 6 sessions. Mandatory advance payment required.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider shrink-0 self-start sm:self-center">
                Private Console Lock
              </span>
            </div>
          )}

          {/* Date & Duration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Booking Date
              </label>
              <input
                type="date"
                min={todayStr}
                max={maxBookingDateStr || undefined}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#851B2B] font-mono"
              />
              {membershipAdvanceLimit && (
                <span className="text-[10px] text-[#D7FF00] font-mono mt-1 block">
                  ✓ Member Limit: Up to {membershipAdvanceLimit} days ahead
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Session Duration
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDuration(hrs)}
                    className={`py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                      duration === hrs
                        ? 'bg-[#851B2B] text-[#FFF4E8] shadow-sm font-heading'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {hrs} hr{hrs > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Booking Mode
              </label>
              {selectedGame?.isExclusive || selectedGame?.bookingMode === 'PRIVATE_ONLY' ? (
                <div className="py-2.5 px-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-[11px] text-amber-300 font-bold flex items-center justify-between">
                  <span>Private Session Only</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Console Lock
                  </span>
                </div>
              ) : isGameMultiplayer(selectedGame) || selectedGame?.bookingMode === 'SHARED' ? (
                <div className="py-2.5 px-3 rounded-lg bg-blue-950/50 border border-blue-500/40 text-[11px] text-blue-300 font-bold flex items-center justify-between">
                  <span>Shared Session (Reserve Seats)</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                    Multiplayer Seats
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setBookingType('SHARED')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                      bookingType === 'SHARED'
                        ? 'bg-[#851B2B] text-[#FFF4E8] font-heading'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Shared
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingType('PRIVATE')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                      bookingType === 'PRIVATE'
                        ? 'bg-purple-500 text-white font-heading'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Private
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Time Slot Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D7FF00]" />
                Live Available Time Slots ({selectedDevice?.name} on {bookingDate})
              </h4>
              <button
                type="button"
                onClick={fetchAvailability}
                className="text-xs text-slate-400 hover:text-[#D7FF00] flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${slotsLoading ? 'animate-spin text-[#D7FF00]' : ''}`} />
                Refresh
              </button>
            </div>

            {slotsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#D7FF00]" />
                Calculating real-time slot occupancy from database...
              </div>
            ) : dateClosureReason ? (
              <div className="p-6 rounded-2xl bg-[#851B2B]/20 border border-[#851B2B]/50 text-center space-y-2 animate-fadeIn">
                <AlertTriangle className="w-8 h-8 text-[#F5B942] mx-auto" />
                <div className="text-sm font-bold text-[#FFF4E8]">Gaming Lounge Closed on this Date</div>
                <p className="text-xs text-[#C7A5A8] max-w-md mx-auto">{dateClosureReason}</p>
                <p className="text-[11px] text-[#D7FF00] font-semibold">Please select a different date above to view available time slots.</p>
              </div>
            ) : availabilitySlots.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                No operating time slots available for the selected duration and date.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {availabilitySlots.map((slot, index) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  const isClickable = selectedGame?.isExclusive
                    ? slot.canBookPrivate
                    : bookingType === 'SHARED'
                    ? slot.canBookShared
                    : slot.canBookPrivate;

                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={!isClickable}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setNumberOfPlayers(1);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#851B2B]/25 border-[#851B2B] shadow-md shadow-[#851B2B]/20'
                          : isClickable
                          ? slot.status === 'PARTIALLY_BOOKED'
                            ? 'bg-[#171014] border-[#49202C] hover:border-[#851B2B]'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/60 border-slate-800/40 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-white font-mono block">
                          {slot.displayStartTime} – {slot.displayEndTime}
                        </span>

                        <div className="mt-1.5 flex items-center gap-1">
                          {slot.status === 'AVAILABLE' && (
                            <span className="text-[10px] font-semibold text-emerald-400">
                              {slot.capacity}/{slot.capacity} Available
                            </span>
                          )}
                          {slot.status === 'PARTIALLY_BOOKED' && (
                            <span className="text-[10px] font-semibold text-[#FFF4E8]">
                              {slot.remainingPlayers} Left ({slot.occupiedPlayers} Booked)
                            </span>
                          )}
                          {slot.status === 'FULL' && (
                            <span className="text-[10px] font-semibold text-rose-400">
                              {slot.hasPrivateBooking ? 'Private Session' : 'Full Capacity'}
                            </span>
                          )}
                          {slot.status === 'MAINTENANCE' && (
                            <span className="text-[10px] font-semibold text-amber-400">Maintenance</span>
                          )}
                          {slot.status === 'UNAVAILABLE' && (
                            <span className="text-[10px] font-semibold text-slate-500">Past Slot</span>
                          )}
                        </div>
                      </div>

                      {/* Visual Player Capacity Bar */}
                      <div className="mt-2.5 flex gap-1">
                        {Array.from({ length: slot.capacity || 4 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${
                              i < slot.occupiedPlayers
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(selectedDevice?.deviceType === 'POOL' ? 1 : 2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to {selectedDevice?.deviceType === 'POOL' ? 'Stations' : 'Games'}
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!selectedSlot}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider disabled:opacity-50"
            >
              Review & Select Players <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 4: PLAYERS & PRICING REVIEW ---------------- */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player count selection */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D7FF00]" />
                Select Number of Players
              </h4>

              <p className="text-xs text-slate-400">
                {isVenueSelection ? (
                  <span>
                    <strong className="text-white">Select at Venue</strong> lets you choose your game on arrival. Accommodates{' '}
                    <span className="text-[#D7FF00] font-bold">1 to {selectedDevice?.capacity || 4} players</span>.
                    {bookingType === 'SHARED'
                      ? ` Up to ${getMaxPlayersAllowed()} slot(s) currently open for booking.`
                      : ` You are reserving the entire ${selectedDevice?.name} exclusively.`}
                  </span>
                ) : selectedGame ? (
                  <span>
                    <strong className="text-white">{selectedGame.name}</strong> accommodates{' '}
                    <span className="text-[#D7FF00] font-bold">
                      {selectedGame.minPlayers === selectedGame.maxPlayers
                        ? `${selectedGame.maxPlayers} player${selectedGame.maxPlayers > 1 ? 's' : ''}`
                        : `${selectedGame.minPlayers || 1} to ${selectedGame.maxPlayers || 4} players`}
                    </span>
                    .{' '}
                    {bookingType === 'SHARED'
                      ? `Up to ${getMaxPlayersAllowed()} slot(s) currently open for booking.`
                      : `You are reserving the entire ${selectedDevice?.name} exclusively.`}
                  </span>
                ) : bookingType === 'SHARED' ? (
                  `You are booking player positions in a shared session. Up to ${getMaxPlayersAllowed()} slot(s) currently open.`
                ) : (
                  `You are reserving the entire ${selectedDevice?.name} exclusively.`
                )}
              </p>

              <div className="flex items-center gap-2 pt-2">
                {Array.from(
                  { length: Math.max(1, getMaxPlayersAllowed() - getMinPlayersAllowed() + 1) },
                  (_, i) => getMinPlayersAllowed() + i
                ).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumberOfPlayers(num)}
                    className={`w-12 h-12 rounded-xl font-bold font-mono text-base transition-all ${
                      numberOfPlayers === num
                        ? 'bg-[#851B2B] text-[#FFF4E8] font-heading shadow-md shadow-[#851B2B]/20'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Slot Occupancy Visualization */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Station Player Allocation:
                </span>
                <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                  {selectedSlot?.playerSlots?.map((s, idx) => {
                    const isNewSlot =
                      idx >= selectedSlot.occupiedPlayers &&
                      idx < selectedSlot.occupiedPlayers + numberOfPlayers;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-center ${
                          isNewSlot
                            ? 'bg-[#851B2B]/25 border-[#851B2B] text-[#FFF4E8] font-bold'
                            : s.status === 'BOOKED'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">Slot {idx + 1}</div>
                        <div className="text-xs truncate mt-0.5">
                          {isNewSlot ? 'YOU' : s.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Price calculation summary */}
            <div className="booking-quote-summary p-5 rounded-2xl bg-slate-50 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between shadow-sm">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Booking Summary & Official Quote
                </h4>

                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Station:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{selectedDevice?.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Title:</span>
                    <span className="text-[#851B2B] dark:text-[#D7FF00] font-semibold flex items-center gap-1.5">
                      {isVenueSelection ? (
                        <>
                          Select at Venue{' '}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                            Non-Exclusive
                          </span>
                        </>
                      ) : selectedGame ? (
                        <>
                          {selectedGame.name}{' '}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              selectedGame.isExclusive
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {selectedGame.isExclusive ? 'Exclusive' : 'Non-Exclusive'}
                          </span>
                        </>
                      ) : selectedDevice?.deviceType === 'POOL' ? (
                        'Tournament 8-Ball Pool'
                      ) : (
                        'Select at Venue'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Date & Slot:</span>
                    <span className="text-slate-900 dark:text-white font-mono">
                      {bookingDate} ({selectedSlot?.startTime} – {selectedSlot?.endTime})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Duration & Mode:</span>
                    <span className="text-slate-900 dark:text-white">
                      {duration} hour(s) • <span className="text-purple-600 dark:text-purple-400 font-semibold">{bookingType}</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Players:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{numberOfPlayers} Player(s)</span>
                  </div>
                </div>

                {pricingQuote && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-emerald-500/30 text-xs font-mono space-y-1 mt-2 shadow-sm">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                      <span>Rate Model:</span>
                      <span>{pricingQuote.pricingRule?.billingType}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                      <span>Rate per unit:</span>
                      <span>
                        ₹{pricingQuote.pricingRule?.ratePerUnitRupees}/hr
                        {pricingQuote.pricingRule?.billingType === 'PER_PLAYER_HOURLY' ? '/p' : ' (console)'}
                      </span>
                    </div>

                    {membershipBenefit?.applied && (
                      <>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
                          <span>Standard Amount:</span>
                          <span className="line-through text-slate-400 dark:text-slate-500">₹{pricingQuote.standardAmountRupees}</span>
                        </div>
                        {numberOfPlayers > 1 && pricingQuote.pricingRule?.billingType === 'PER_PLAYER_HOURLY' ? (
                          <div className="p-2 my-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] space-y-1 text-slate-700 dark:text-amber-200">
                            <div className="flex justify-between font-medium">
                              <span>• Member (Player 1):</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                ₹{pricingQuote.memberBreakdown?.memberAmountRupees ?? 0} ({membershipBenefit.freeHoursApplied || 1}h free)
                              </span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>• {numberOfPlayers - 1} Extra Player(s):</span>
                              <span className="font-bold">
                                ₹{pricingQuote.memberBreakdown?.additionalPlayersAmountRupees ?? ((numberOfPlayers - 1) * (pricingQuote.pricingRule?.ratePerUnitRupees || 70) * duration)}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-amber-300/70 pt-0.5">
                              *Membership benefit covers 1 eligible player only.
                            </div>
                          </div>
                        ) : duration > 1 ? (
                          <div className="p-2 my-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] space-y-1 text-slate-700 dark:text-amber-200">
                            <div className="flex justify-between font-medium">
                              <span>• First Qualifying Hour:</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹0 (Free)</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>• Additional {duration - 1} Hour(s):</span>
                              <span className="font-bold">₹{pricingQuote.totalAmountRupees}</span>
                            </div>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400 text-[11px]">
                          <span>Membership Benefit ({membershipBenefit.planName}):</span>
                          <span>-₹{membershipBenefit.discountRupees}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base pt-2 border-t border-slate-200 dark:border-slate-800 font-sans">
                      <span>Total Amount:</span>
                      <span className={`font-mono ${isMembershipFullyCovered ? 'text-[#851B2B] dark:text-[#D7FF00]' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        ₹{pricingQuote.totalAmountRupees}
                        {isMembershipFullyCovered && (
                          <span className="ml-2 text-xs font-normal text-emerald-700 dark:text-emerald-400 font-mono">
                            (Free Session)
                          </span>
                        )}
                      </span>
                    </div>

                    {pricingQuote.advanceRequired && (
                      <div className="pt-2 border-t border-amber-300 dark:border-amber-500/30 flex justify-between text-amber-800 dark:text-amber-300 font-bold text-xs">
                        <span>Mandatory Advance Required:</span>
                        <span className="font-mono">₹{pricingQuote.minimumAdvanceRupees} (50%)</span>
                      </div>
                    )}

                    {selectedGame?.isExclusive && (
                      <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-sans">
                        ✓ Exclusive Booking: Entire physical {selectedDevice?.name} console locked. The other PS5 console remains independently available.
                      </div>
                    )}

                    <div className="text-[10px] text-right text-slate-500">
                      ({pricingQuote.totalAmountPaise} integer paise)
                    </div>
                  </div>
                )}
              </div>

                {/* Phase 4 Payment Selection Box */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
                  <span className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block font-heading">
                    Payment Channel
                  </span>

                  {isMembershipFullyCovered ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Crown className="w-4 h-4 text-[#851B2B] dark:text-[#D7FF00]" />
                        <span>100% Covered by Membership</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        Your daily gaming perk covers this session in full. No payment gateway or counter cash needed!
                      </p>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                        Payable Amount: ₹0
                      </div>
                    </div>
                  ) : pricingQuote?.advanceRequired || selectedGame?.isExclusive ? (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Mandatory Online Advance Required</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        GTA 6 exclusive bookings lock the entire physical PS5 console. A 50% advance (₹{pricingQuote?.minimumAdvanceRupees}) must be paid online via Razorpay (UPI, Debit/Credit Cards).
                      </p>
                      <div className="text-[10px] text-amber-800 dark:text-amber-200/80 pt-1 font-mono">
                        Remaining balance of ₹{pricingQuote ? pricingQuote.totalAmountRupees - pricingQuote.minimumAdvanceRupees : 0} payable at front desk.
                      </div>
                    </div>
                  ) : (
                    <>
                      {membershipBenefit?.applied && (
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs flex justify-between items-center">
                          <span>Partial Membership Discount Applied:</span>
                          <span className="font-mono font-bold">-₹{membershipBenefit.discountRupees}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setPaymentChoice('ONLINE')}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            paymentChoice === 'ONLINE'
                              ? 'bg-amber-50/70 dark:bg-[#851B2B]/20 border-[#851B2B] text-slate-900 dark:text-[#FFF4E8] ring-1 ring-[#851B2B]'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Online</span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            Razorpay (UPI / Cards)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentChoice('COUNTER')}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            paymentChoice === 'COUNTER'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold">
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Pay at Counter</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Cash / Reception UPI
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

              {!isAuthenticated && (
                <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                  <span>Sign in required to confirm booking</span>
                  <button onClick={openLoginModal} className="font-bold underline">
                    Sign In
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={submitting || !selectedSlot}
                className={`w-full py-3 rounded-xl font-bold font-heading text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                  isMembershipFullyCovered
                    ? 'bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white shadow-[#851B2B]/20'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {submitting
                  ? 'Confirming with Database...'
                  : isMembershipFullyCovered
                  ? 'Book Now - Covered by Membership'
                  : (pricingQuote?.advanceRequired || selectedGame?.isExclusive)
                  ? `Pay Advance ₹${pricingQuote?.minimumAdvanceRupees} via Razorpay`
                  : paymentChoice === 'ONLINE'
                  ? `Pay ₹${pricingQuote?.totalAmountRupees || 0} via Razorpay`
                  : 'Confirm & Pay at Counter'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-start pt-2">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Slots
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 5: CONFIRMED RESERVATION ---------------- */}
      {step === 5 && confirmedBooking && (
        <div className="py-8 text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Booking Confirmed
            </span>
            <h3 className="text-3xl font-black font-heading text-white">RESERVATION SUCCESSFUL</h3>
            <p className="text-xs text-slate-400">
              Your gaming session has been reserved and your slot occupancy is locked in MongoDB.
            </p>
          </div>

          <div className="max-w-md mx-auto p-5 rounded-2xl bg-slate-900 border border-slate-800 text-left font-mono text-xs space-y-2.5">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Booking Reference:</span>
              <span className="text-[#D7FF00] font-bold">{confirmedBooking.bookingId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Equipment:</span>
              <span className="text-white font-sans font-semibold">{confirmedBooking.device?.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Game / Title:</span>
              <span className="text-[#D7FF00] font-sans font-semibold flex items-center gap-1.5">
                {confirmedBooking.isVenueSelection
                  ? 'Select at Venue'
                  : confirmedBooking.game?.name || confirmedBooking.gameTitle || 'Lounge Play'}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  {confirmedBooking.isVenueSelection
                    ? 'Non-Exclusive'
                    : confirmedBooking.game?.isExclusive
                    ? 'Exclusive'
                    : 'Non-Exclusive'}
                </span>
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Date & Slot:</span>
              <span className="text-white">
                {confirmedBooking.bookingDate} ({confirmedBooking.startTime} - {confirmedBooking.endTime})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Booking Type:</span>
              <span className="text-purple-400 font-bold">{confirmedBooking.bookingType}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Reserved Seats:</span>
              <span className="text-white">{confirmedBooking.numberOfPlayers} Player(s)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Payment Status:</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  confirmedBooking.paymentStatus === 'PAID'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : confirmedBooking.paymentStatus === 'PARTIALLY_PAID'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {confirmedBooking.paymentStatus}
              </span>
            </div>
            <div className="flex justify-between py-1 pt-2 font-sans font-bold text-sm border-b border-slate-800">
              <span className="text-slate-300">Total Price:</span>
              <span className="text-emerald-400 font-mono">₹{confirmedBooking.totalAmount / 100}</span>
            </div>

            {/* Paid / Balance Breakdown */}
            <div className="flex justify-between py-1 text-xs">
              <span className="text-slate-400">Amount Paid:</span>
              <span className="text-emerald-300 font-bold">
                ₹{(confirmedBooking.amountPaid || 0) / 100}
              </span>
            </div>
            {confirmedBooking.balanceRemaining > 0 && (
              <div className="flex justify-between py-1 text-xs">
                <span className="text-slate-400">Balance Due at Counter:</span>
                <span className="text-amber-400 font-bold">
                  ₹{confirmedBooking.balanceRemaining / 100}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 pt-2">
            {(confirmedBooking.paymentStatus === 'PAID' ||
              confirmedBooking.paymentStatus === 'PARTIALLY_PAID' ||
              confirmedPayment) && (
              <button
                onClick={() => setReceiptModalOpen(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#851B2B]/20 hover:bg-[#851B2B]/35 text-[#FFF4E8] text-xs font-bold border border-[#49202C] font-heading uppercase tracking-wider"
              >
                <FileText className="w-4 h-4" /> View Digital Receipt
              </button>
            )}

            <button
              onClick={() => {
                setStep(1);
                setConfirmedBooking(null);
                setConfirmedPayment(null);
                setSelectedSlot(null);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700"
            >
              Book Another Station
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-bold text-xs uppercase tracking-wider font-heading shadow-md shadow-[#851B2B]/20"
              >
                Close & View Lounge
              </button>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Razorpay Checkout Modal (Phase 4) */}
      {razorpayModalOpen && razorpayOrder && (
        <RazorpayModal
          order={razorpayOrder}
          bookingDetails={tempBookingForPayment}
          onSuccess={handlePaymentSuccess}
          onClose={() => setRazorpayModalOpen(false)}
        />
      )}

      {/* Digital Receipt Modal (Phase 4) */}
      {receiptModalOpen && (confirmedPayment || confirmedBooking) && (
        <ReceiptModal
          paymentId={confirmedPayment?.paymentId}
          bookingId={confirmedBooking?._id}
          onClose={() => setReceiptModalOpen(false)}
        />
      )}
    </div>
  );
};
