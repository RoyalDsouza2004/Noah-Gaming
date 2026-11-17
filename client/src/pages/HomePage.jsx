import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { equipmentApi } from '../api/equipment.js';
import { membershipApi } from '../api/membership.js';
import { scheduleApi } from '../api/schedule.js';
import { GameCard } from '../components/games/GameCard.jsx';
import { GameDetailsModal } from '../components/games/GameDetailsModal.jsx';
import {
  Gamepad2,
  Tv,
  CircleDot,
  Flame,
  Shield,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
  Clock,
  Coins,
  Crown,
  Check,
  Zap,
  MapPin,
  Phone,
  Mail,
  Headphones,
  Award,
  Coffee,
  Wifi,
} from 'lucide-react';

export const HomePage = ({
  onOpenBooking,
  onOpenMyBookings,
  onOpenCustomerDashboard,
  onOpenMembershipPlans,
}) => {
  const { isAuthenticated, openLoginModal, openRegisterModal } = useAuth();

  // Dynamic Data fetched from MongoDB backend
  const [devices, setDevices] = useState([]);
  const [games, setGames] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [plans, setPlans] = useState([]);
  const [operatingStatus, setOperatingStatus] = useState(null);
  const [selectedGameCategory, setSelectedGameCategory] = useState('ALL');
  const [selectedGameForDetails, setSelectedGameForDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch dynamic equipment, games, pricing, membership plans, and operating hours from backend
  const fetchLoungeData = async () => {
    try {
      setLoading(true);
      const [devRes, gmRes, prRes, planRes, schedRes] = await Promise.all([
        equipmentApi.getDevices(),
        equipmentApi.getGames(),
        equipmentApi.getPricing(),
        membershipApi.getPlans().catch(() => ({ success: false })),
        scheduleApi.getOperatingStatus().catch(() => ({ success: false })),
      ]);
      if (devRes.success) setDevices(devRes.data.devices);
      if (gmRes.success) setGames(gmRes.data.games);
      if (prRes.success) setPricingRules(prRes.data.pricingPlans);
      if (planRes?.success && planRes.data?.plans) setPlans(planRes.data.plans);
      if (schedRes?.success && schedRes.data) setOperatingStatus(schedRes.data);
    } catch (err) {
      console.warn('Failed to fetch lounge data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoungeData();
  }, []);

  const gta6Game = games.find((g) => g.name === 'GTA 6');

  // Filter games by category
  const categories = ['ALL', ...new Set(games.map((g) => g.category?.name || 'Action'))];
  const filteredGames = selectedGameCategory === 'ALL'
    ? games
    : games.filter((g) => (g.category?.name || 'Action') === selectedGameCategory);

  // Authoritative dynamic rates from backend pricing rules (with correct fallback rates: PS5 ₹70, Pool ₹150, GTA 6 ₹150)
  const ps5Pricing = pricingRules.find((p) => p.deviceType === 'PS5' && !p.game);
  const ps5RateRupees = ps5Pricing ? ps5Pricing.amount / 100 : 70;

  const poolPricing = pricingRules.find((p) => p.deviceType === 'POOL');
  const poolRateRupees = poolPricing ? poolPricing.amount / 100 : 150;

  const gta6Pricing = pricingRules.find((p) => p.game || (p.name && /GTA/i.test(p.name)));
  const gta6RateRupees = gta6Pricing ? gta6Pricing.amount / 100 : 150;

  return (
    <div className="space-y-20">
      {/* ========================================================= */}
      {/* 1. HERO SECTION                                           */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden pt-10 sm:pt-16 pb-12 sm:pb-20 border-b border-[#49202C]/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(133,27,43,0.35),rgba(23,16,20,0))] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#851B2B]/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10 px-4">
          {/* Brand Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#851B2B]/20 border border-[#851B2B]/50 text-[#D7FF00] text-xs font-bold uppercase tracking-widest shadow-md shadow-[#851B2B]/20">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-[#D7FF00]/40 p-0.5 bg-[#171014] shrink-0 flex items-center justify-center">
              <img src="/icons/Noah_gaming_logo.svg" alt="NOAH GAMING" className="w-full h-full object-cover rounded-full" />
            </div>
            <span>NOAH GAMING • PLAY • CHILL • CONNECT</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black font-heading tracking-tight text-[#FFF4E8] leading-tight">
            BAJAGOLI'S PREMIER <br />
            <span className="gaming-gradient-text">GAMING LOUNGE</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-[#C7A5A8] max-w-2xl mx-auto leading-relaxed">
            Experience next-generation PlayStation 5 multiplayer battles, tournament 8-Ball pool, and exclusive private GTA 6 suites. Ultra-low latency, 4K 120Hz displays, and instant online reservations.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={() => onOpenBooking && onOpenBooking(null)}
              className="px-7 py-3.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-black font-heading text-sm shadow-xl shadow-[#D7FF00]/25 transition-all flex items-center gap-2 hover:scale-[1.03] active:scale-[0.98]"
            >
              <Gamepad2 className="w-5 h-5 text-[#171014]" />
              Book a Gaming Session <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenMembershipPlans && onOpenMembershipPlans()}
              className="px-6 py-3.5 rounded-xl bg-[#851B2B]/30 hover:bg-[#851B2B]/50 text-[#FFF4E8] font-bold font-heading text-sm border border-[#851B2B] shadow-lg shadow-[#851B2B]/20 transition-all flex items-center gap-2 hover:scale-[1.02]"
            >
              <Crown className="w-4 h-4 text-[#F5B942]" />
              Club Passes & Memberships
            </button>

            <a
              href="#overview"
              className="px-5 py-3.5 rounded-xl bg-[#260D17] hover:bg-[#381322] text-[#C7A5A8] hover:text-[#FFF4E8] font-semibold text-sm border border-[#49202C] transition-colors"
            >
              Explore Equipment & Rates
            </a>
          </div>

          {/* Key Amenities Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 max-w-3xl mx-auto text-xs text-[#C7A5A8]">
            <div className="p-3 rounded-xl bg-[#260D17]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-[#D7FF00]" />
              <span className="font-semibold text-[#FFF4E8]">4K 120Hz HDR Displays</span>
            </div>
            <div className="p-3 rounded-xl bg-[#260D17]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <Users className="w-4 h-4 text-[#F5B942]" />
              <span className="font-semibold text-[#FFF4E8]">Up to 4-Player Co-op</span>
            </div>
            <div className="p-3 rounded-xl bg-[#260D17]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <CircleDot className="w-4 h-4 text-[#45C987]" />
              <span className="font-semibold text-[#FFF4E8]">Tournament 8-Ball Pool</span>
            </div>
            <div className="p-3 rounded-xl bg-[#260D17]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <Flame className="w-4 h-4 text-[#F06A76]" />
              <span className="font-semibold text-[#FFF4E8]">GTA 6 VIP Suites</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. LOUNGE EXPERIENCE & AMENITIES                           */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F5B942] uppercase tracking-wider">
            <Award className="w-4 h-4 text-[#F5B942]" /> The NOAH Experience
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold font-heading text-[#FFF4E8]">
            Engineered For Serious Gamers & Social Chillouts
          </h2>
          <p className="text-xs sm:text-sm text-[#C7A5A8] leading-relaxed">
            Whether you want intense competitive FIFA tournaments with friends, relaxed 8-ball pool matches, or deep private campaign sessions, NOAH GAMING delivers the premier gaming atmosphere in Bajagoli.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-4 hover:border-[#851B2B]/60 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#851B2B]/25 text-[#D7FF00] flex items-center justify-center border border-[#851B2B]/40">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">Flagship PlayStation 5 Hardware</h3>
            <p className="text-xs text-[#C7A5A8] leading-relaxed">
              Equipped with Sony DualSense wireless controllers, immersive haptic feedback, 3D spatial audio, and an extensive library of top-tier AAA multiplayer and sports titles.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-4 hover:border-[#851B2B]/60 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#851B2B]/25 text-[#F5B942] flex items-center justify-center border border-[#851B2B]/40">
              <CircleDot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">Tournament 8-Ball Pool Table</h3>
            <p className="text-xs text-[#C7A5A8] leading-relaxed">
              Professional-grade slate bed pool table with Simonis tournament cloth, premium weighted cues, Aramith tournament balls, and dedicated spectator seating.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-4 hover:border-[#851B2B]/60 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#851B2B]/25 text-[#45C987] flex items-center justify-center border border-[#851B2B]/40">
              <Coffee className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">Café Lounge & Refreshments</h3>
            <p className="text-xs text-[#C7A5A8] leading-relaxed">
              Air-conditioned chillout lounge offering chilled beverages, energy drinks, gourmet snacks, and high-speed fiber Wi-Fi to keep your energy high between gaming sessions.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. GAMING STATIONS & HARDWARE (Exact 2 PS5 + 1 Pool Rule)  */}
      {/* ========================================================= */}
      <section id="overview" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D7FF00] uppercase tracking-wider mb-1">
              <Tv className="w-4 h-4" /> Gaming Equipment & Stations
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#FFF4E8]">
              Available Stations & Hardware
            </h2>
            <p className="text-xs sm:text-sm text-[#C7A5A8] mt-1 max-w-2xl">
              Check real-time station availability and reserve your preferred console or tournament table online with instant confirmation.
            </p>
          </div>

          <button
            onClick={() => onOpenBooking && onOpenBooking(null)}
            className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#A51F35] text-[#FFF4E8] font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-2 shadow-md shadow-[#851B2B]/30"
          >
            <Gamepad2 className="w-4 h-4 text-[#D7FF00]" /> Check Slot Availability
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {devices.map((device) => {
            // Find authoritative standard rate for this device (excluding game-specific/exclusive rates like GTA 6)
            const devicePricing =
              pricingRules.find(
                (p) =>
                  (p.device === device._id || p.deviceType === device.deviceType) &&
                  !p.game &&
                  p.billingType === (device.deviceType === 'POOL' ? 'PER_DEVICE_HOURLY' : 'PER_PLAYER_HOURLY')
              ) ||
              pricingRules.find((p) => (p.device === device._id || p.deviceType === device.deviceType) && !p.game);
            const rateRupees = devicePricing ? devicePricing.amount / 100 : device.deviceType === 'POOL' ? 150 : 70;

            return (
              <div
                key={device._id}
                className="gaming-card p-6 rounded-2xl flex flex-col justify-between border-[#49202C] relative overflow-hidden group bg-[#260D17]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-[#851B2B]/20 text-[#FFF4E8] border border-[#851B2B]/40">
                      {device.deviceType === 'POOL' ? (
                        <CircleDot className="w-6 h-6 text-[#F5B942]" />
                      ) : (
                        <Gamepad2 className="w-6 h-6 text-[#D7FF00]" />
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        device.status === 'ACTIVE'
                          ? 'bg-[#45C987]/15 text-[#45C987] border border-[#45C987]/30'
                          : device.status === 'MAINTENANCE'
                          ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30'
                          : 'bg-[#851B2B]/20 text-[#C7A5A8] border border-[#49202C]'
                      }`}
                    >
                      {device.status === 'ACTIVE' ? 'Available' : device.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-[#D7FF00] font-bold">{device.deviceCode}</span>
                    <h3 className="text-xl font-bold font-heading text-[#FFF4E8]">{device.name}</h3>
                    <p className="text-xs text-[#C7A5A8] mt-1 leading-relaxed">{device.description}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#49202C] text-xs text-[#C7A5A8]">
                    <div className="flex justify-between py-1 border-b border-[#49202C]/60">
                      <span className="text-[#C7A5A8]">Max Capacity:</span>
                      <span className="font-semibold text-[#D7FF00]">{device.capacity} Players</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#49202C]/60">
                      <span className="text-[#C7A5A8]">Standard Rate:</span>
                      <span className="font-bold text-[#FFF4E8] font-mono">
                        ₹{rateRupees} / hour {device.deviceType === 'POOL' ? '(Table Rate)' : '(per player)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#C7A5A8]">Games Library:</span>
                      <span className="text-[#FFF4E8] font-medium">{device.supportedGames?.length || 0} Titles Available</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#49202C] space-y-3">
                  {device.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => onOpenBooking && onOpenBooking(device)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#851B2B] hover:bg-[#A51F35] text-[#FFF4E8] border border-[#851B2B] text-xs font-bold font-heading uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#851B2B]/25"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 text-[#D7FF00]" /> Reserve This Station
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 px-3 rounded-xl bg-[#171014] text-[#D0B9BC] text-xs font-semibold cursor-not-allowed uppercase border border-[#49202C]"
                    >
                      Station Under Maintenance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. EXCLUSIVE GTA 6 PRIVATE SUITE SHOWCASE                 */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div id="gta6-showcase-banner" className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#260D17] via-[#171014] to-[#260D17] border border-[#851B2B]/60 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#851B2B]/15 blur-3xl pointer-events-none rounded-full" />

          <div className="space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F5B942] uppercase tracking-wider">
              <Flame className="w-4 h-4 text-[#F5B942]" /> Marquee Exclusive Title • PS5 Console Experience
            </div>
            <h3 className="text-2xl sm:text-3xl font-black font-heading text-[#FFF4E8]">
              Grand Theft Auto VI (GTA 6)
            </h3>
            <p className="text-xs sm:text-sm text-[#C7A5A8] max-w-2xl leading-relaxed">
              Step into Vice City in next-gen 4K. Reserving GTA 6 locks the entire physical PlayStation 5 console exclusively for your private party at <strong>₹{gta6RateRupees}/hour</strong> with mandatory advance booking.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#C7A5A8] pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-[#171014] border border-[#49202C] text-[#FFF4E8]">
                Rate: <strong className="text-[#D7FF00]">₹{gta6RateRupees} / hr</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#171014] border border-[#49202C] text-[#FFF4E8]">
                Platform: <strong className="text-[#D7FF00]">PS5 Station 1 or 2</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#171014] border border-[#49202C] text-[#FFF4E8]">
                Console Lock: <strong className="text-[#F5B942]">Full Private Access</strong>
              </span>
            </div>
          </div>

          <div className="shrink-0 relative z-10 w-full sm:w-auto">
            {gta6Game?.status === 'ACTIVE' ? (
              <button
                onClick={() => onOpenBooking && onOpenBooking(devices[0])}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#851B2B] hover:bg-[#A51F35] text-[#FFF4E8] font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-[#851B2B]/30 transition-all flex items-center justify-center gap-2 border border-[#851B2B]"
              >
                <Flame className="w-4 h-4 text-[#F5B942]" /> Book GTA 6 Suite
              </button>
            ) : (
              <div className="px-5 py-3 rounded-xl bg-[#171014] border border-[#49202C] text-xs font-semibold text-[#C7A5A8] uppercase tracking-wider text-center">
                Reservations Opening Soon
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. AVAILABLE GAMES CATALOGUE                               */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5B942] uppercase tracking-wider mb-1">
              <Gamepad2 className="w-4 h-4 text-[#F5B942]" /> Game Library
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#FFF4E8]">Popular Titles</h2>
            <p className="text-xs sm:text-sm text-[#C7A5A8] mt-1">
              All PlayStation 5 consoles come pre-installed with top competitive sports, action, and multiplayer hits.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedGameCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedGameCategory === cat
                    ? 'bg-[#851B2B] text-[#FFF4E8] shadow-sm'
                    : 'bg-[#260D17] text-[#C7A5A8] hover:text-[#FFF4E8] border border-[#49202C]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredGames.map((game) => (
            <GameCard
              key={game._id}
              game={game}
              onViewDetails={(g) => setSelectedGameForDetails(g)}
              onBook={(g) => onOpenBooking && onOpenBooking(null, g)}
            />
          ))}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 6. TRANSPARENT PRICING & HOUSE RULES                       */}
      {/* ========================================================= */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D7FF00] uppercase tracking-wider">
            <Coins className="w-4 h-4 text-[#D7FF00]" /> Straightforward Rates
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold font-heading text-[#FFF4E8]">
            Lounge Pricing & Transparent Billing
          </h2>
          <p className="text-xs sm:text-sm text-[#C7A5A8] leading-relaxed">
            No hidden charges or surprise deductions. Pay securely online via UPI/Card, or cash/UPI at the reception counter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PS5 Standard */}
          <div className="p-6 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#851B2B]/20 text-[#D7FF00] text-[11px] font-bold">
                PlayStation 5 Standard
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-heading text-[#FFF4E8]">₹{ps5RateRupees}</span>
                <span className="text-xs text-[#C7A5A8]">/ player / hour</span>
              </div>
              <p className="text-xs text-[#C7A5A8] leading-relaxed">
                Standard hourly rate for FIFA, Call of Duty, Tekken, and all catalog multiplayer games on PS5 Station 1 or 2.
              </p>
              <ul className="space-y-2 text-xs text-[#C7A5A8] pt-2">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Full access to standard games catalog</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Up to 4 players per console</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Shared or private group booking</li>
              </ul>
            </div>
            <button
              onClick={() => onOpenBooking && onOpenBooking(devices[0])}
              className="w-full py-2.5 rounded-xl bg-[#851B2B]/25 hover:bg-[#851B2B]/40 text-[#FFF4E8] font-bold text-xs uppercase tracking-wider border border-[#851B2B]"
            >
              Book PS5 Session
            </button>
          </div>

          {/* Tournament 8-Ball Pool */}
          <div className="p-6 rounded-2xl bg-[#260D17] border border-[#49202C] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5B942]/20 text-[#F5B942] text-[11px] font-bold">
                Tournament 8-Ball Pool
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-heading text-[#FFF4E8]">₹{poolRateRupees}</span>
                <span className="text-xs text-[#C7A5A8]">/ player / hour</span>
              </div>
              <p className="text-xs text-[#C7A5A8] leading-relaxed">
                Professional slate bed tournament pool table with Simonis cloth, weighted cues, and spectator seating.
              </p>
              <ul className="space-y-2 text-xs text-[#C7A5A8] pt-2">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Tournament balls & weighted cues</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Up to 4 players per table</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Real-time countdown timer</li>
              </ul>
            </div>
            <button
              onClick={() => onOpenBooking && onOpenBooking(devices.find((d) => d.deviceType === 'POOL'))}
              className="w-full py-2.5 rounded-xl bg-[#851B2B]/25 hover:bg-[#851B2B]/40 text-[#FFF4E8] font-bold text-xs uppercase tracking-wider border border-[#851B2B]"
            >
              Book Pool Table
            </button>
          </div>

          {/* GTA 6 Exclusive */}
          <div className="p-6 rounded-2xl bg-[#260D17] border border-[#851B2B] space-y-4 flex flex-col justify-between shadow-xl shadow-[#851B2B]/20">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#851B2B] text-[#D7FF00] text-[11px] font-bold">
                Exclusive Title: GTA 6 Suite
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-heading text-[#FFF4E8]">₹{gta6RateRupees}</span>
                <span className="text-xs text-[#C7A5A8]">/ hour (entire console)</span>
              </div>
              <p className="text-xs text-[#C7A5A8] leading-relaxed">
                Reserving GTA 6 locks the full PS5 console exclusively for your private party with mandatory advance reservation.
              </p>
              <ul className="space-y-2 text-xs text-[#C7A5A8] pt-2">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Full private console lock</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Mandatory ₹{Math.round(gta6RateRupees / 2)} advance deposit</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#45C987]" /> Covered by VIP GTA 6 Club Pass</li>
              </ul>
            </div>
            <button
              onClick={() => onOpenBooking && onOpenBooking(devices[0])}
              className="w-full py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-black text-xs uppercase tracking-wider font-heading shadow-md shadow-[#D7FF00]/20"
            >
              Reserve GTA 6 Suite
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. CLUB PASSES & MONTHLY MEMBERSHIPS                       */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5B942] uppercase tracking-wider mb-1">
              <Crown className="w-4 h-4 text-[#F5B942]" /> NOAH Club Passes
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#FFF4E8]">
              Monthly Memberships & Daily Fair-Use Quotas
            </h2>
            <p className="text-xs sm:text-sm text-[#C7A5A8] mt-1 max-w-2xl">
              Frequent gamers save big with our monthly memberships. Enjoy daily included gaming quotas, 100% covered sessions, and priority booking slots.
            </p>
          </div>

          <button
            onClick={() => onOpenMembershipPlans && onOpenMembershipPlans()}
            className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#e5aa35] text-[#171014] font-black text-xs uppercase tracking-wider font-heading flex items-center gap-2 shadow-md shadow-[#F5B942]/20"
          >
            <Crown className="w-4 h-4" /> View All Membership Tiers
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const isVip = plan.includesExclusiveGames;
            return (
              <div
                key={plan._id}
                className={`membership-plan-card p-5 rounded-2xl bg-[#260D17] border transition-all flex flex-col justify-between ${
                  isVip
                    ? 'border-[#F5B942]/60 shadow-xl shadow-[#F5B942]/10'
                    : 'border-[#49202C] hover:border-[#851B2B]/60'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#171014] text-[#C7A5A8] border border-[#49202C]">
                      {plan.validityDuration} {plan.validityUnit}
                    </span>
                    {isVip && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/40 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> VIP GTA 6
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-[#FFF4E8] font-heading">{plan.name}</h4>
                    <p className="text-xs text-[#C7A5A8] mt-1 line-clamp-2">{plan.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[#49202C]">
                    <div className="text-2xl font-black font-heading text-[#FFF4E8]">
                      ₹{plan.price / 100}
                      <span className="text-xs font-normal text-[#C7A5A8] font-sans"> / month</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-[#C7A5A8]">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#45C987] shrink-0" />
                      <span>Daily Quota: <strong className="text-[#FFF4E8]">{plan.dailyUsageLimit / 60}h / day</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#45C987] shrink-0" />
                      <span>Max Session: <strong className="text-[#FFF4E8]">{plan.maximumSessionDuration / 60}h</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#45C987] shrink-0" />
                      <span>{isVip ? 'Includes Exclusive GTA 6' : 'Covers PS5 & Pool Standard'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onOpenMembershipPlans && onOpenMembershipPlans()}
                  className={`mt-6 w-full py-2.5 px-3 rounded-xl font-bold font-heading text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    isVip
                      ? 'bg-[#F5B942] hover:bg-[#e5aa35] text-[#171014] shadow-md shadow-[#F5B942]/20 font-black'
                      : 'bg-[#851B2B] hover:bg-[#A51F35] text-[#FFF4E8] border border-[#851B2B]'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" /> Get This Pass
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 8. LOUNGE LOCATION, OPENING HOURS & CONTACT               */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-[#260D17] border border-[#49202C] grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 text-[#D7FF00] flex items-center justify-center border border-[#851B2B]/40">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">Operating Hours</h3>
            <div className="text-xs text-[#C7A5A8] space-y-1">
              {(() => {
                const format12h = (timeStr) => {
                  if (!timeStr) return '';
                  const [h, m] = timeStr.split(':').map(Number);
                  const period = h >= 12 ? 'PM' : 'AM';
                  const hour12 = h % 12 === 0 ? 12 : h % 12;
                  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
                };
                const todayHours = operatingStatus?.todaySchedule || operatingStatus?.today;
                const hoursFormatted = todayHours?.openTime && todayHours?.closeTime
                  ? `${format12h(todayHours.openTime)} – ${format12h(todayHours.closeTime)} IST`
                  : '10:00 AM – 11:00 PM IST';
                return (
                  <>
                    <p><strong className="text-[#FFF4E8]">Today's Hours:</strong> {hoursFormatted}</p>
                    <p>{operatingStatus?.statusMessage || 'Walk-ins welcome & online bookings open 24/7'}</p>
                    <p className="text-[#45C987] font-medium pt-1">Open 365 Days a Year</p>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 text-[#F5B942] flex items-center justify-center border border-[#851B2B]/40">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">Lounge Location</h3>
            <div className="text-xs text-[#C7A5A8] space-y-1">
              <p className="text-[#FFF4E8] font-medium">NOAH GAMING Lounge</p>
              <p>Near Noah Gym, Bailur, karkala</p>
              <p>Near Miyar town • Parking Available</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 text-[#45C987] flex items-center justify-center border border-[#851B2B]/40">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">Contact & Support</h3>
            <div className="text-xs text-[#C7A5A8] space-y-1">
              <p>Phone / WhatsApp: <strong className="text-[#FFF4E8]">+91 98765 43210</strong></p>
              <p>Email: <strong className="text-[#FFF4E8]">support@noahgaming.com</strong></p>
              <p className="pt-1">
                <button
                  onClick={() => onOpenBooking && onOpenBooking(null)}
                  className="text-[#D7FF00] hover:underline font-bold"
                >
                  Reserve a Station Now →
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dedicated Game Details Modal */}
      <GameDetailsModal
        game={selectedGameForDetails}
        isOpen={Boolean(selectedGameForDetails)}
        onClose={() => setSelectedGameForDetails(null)}
        onBookGame={(game) => {
          setSelectedGameForDetails(null);
          if (onOpenBooking) onOpenBooking(null, game);
        }}
      />
    </div>
  );
};
