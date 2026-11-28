import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { equipmentApi } from '../api/equipment.js';
import { membershipApi } from '../api/membership.js';
import { scheduleApi } from '../api/schedule.js';
import { CustomerMembershipSection } from '../components/membership/CustomerMembershipSection.jsx';
import { navigate } from '../utils/navigation.js';
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
  Calendar,
  ExternalLink,
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
  const [pricingRules, setPricingRules] = useState([]);
  const [plans, setPlans] = useState([]);
  const [operatingStatus, setOperatingStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch dynamic equipment, pricing, membership plans, and operating hours from backend
  const fetchLoungeData = async () => {
    try {
      setLoading(true);
      const [devRes, prRes, planRes, schedRes] = await Promise.all([
        equipmentApi.getDevices(),
        equipmentApi.getPricing(),
        membershipApi.getPlans().catch(() => ({ success: false })),
        scheduleApi.getOperatingStatus().catch(() => ({ success: false })),
      ]);
      if (devRes?.success) setDevices(devRes.data.devices);
      if (prRes?.success) setPricingRules(prRes.data.pricingPlans);
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

  // Centralized dynamic rates from backend pricing rules (Fallbacks: PS5 Non-Exclusive ₹70, Exclusive ₹150, Pool ₹150)
  const ps5Pricing = pricingRules.find((p) => p.deviceType === 'PS5' && !p.game);
  const ps5RateRupees = ps5Pricing ? Math.round(ps5Pricing.amount / 100) : 70;

  const exclusivePricing = pricingRules.find(
    (p) =>
      p.deviceType === 'EXCLUSIVE' ||
      p.name?.toLowerCase().includes('exclusive') ||
      p.name?.toLowerCase().includes('gta')
  );
  const exclusiveRateRupees = exclusivePricing ? Math.round(exclusivePricing.amount / 100) : 150;

  const poolPricing = pricingRules.find((p) => p.deviceType === 'POOL');
  const poolRateRupees = poolPricing ? Math.round(poolPricing.amount / 100) : 150;

  // Station references
  const ps5Station1 = devices.find((d) => d.deviceCode === 'PS5-01' || d.name?.includes('1')) || devices.find((d) => d.deviceType === 'PS5');
  const poolDevice = devices.find((d) => d.deviceType === 'POOL');

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION WITH GAMING POSTER & TRANSPARENT DARK OVERLAY            */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] border border-[#851B2B]/40 shadow-2xl">
        {/* Background Gaming Poster Imagery with 75% Dark Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop')`,
          }}
        />
        {/* Dark Burgundy + Charcoal 75% Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#171014]/95 via-[#260D17]/85 to-[#171014]/95 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(133,27,43,0.35),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-28 text-center space-y-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-[#851B2B]/40 border border-[#851B2B] text-[#FFF4E8] shadow-lg shadow-[#851B2B]/20">
            <span className="w-2 h-2 rounded-full bg-[#D7FF00] animate-pulse" />
            NOAH GAMING • BAJAGOLI ESPORTS LOUNGE
          </div>

          {/* Valorant-Inspired Geometric Headline */}
          <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black font-heading uppercase tracking-wider text-white leading-tight">
            PLAY • CHILL <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D7FF00] via-[#FFF4E8] to-[#F5B942]">• CONNECT</span>
          </h1>

          <p className="text-sm sm:text-lg text-[#C7A5A8] max-w-2xl mx-auto leading-relaxed font-sans">
            Experience next-generation 4K 120Hz PlayStation 5 console arenas, competitive 8-ball billiards, and seamless venue bookings in Bajagoli.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={() => onOpenBooking && onOpenBooking(null)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#851B2B] to-[#A51F35] hover:from-[#A51F35] hover:to-[#851B2B] text-white font-black font-heading text-sm uppercase tracking-widest transition-all shadow-xl shadow-[#851B2B]/40 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-2.5 border border-[#851B2B]/50"
            >
              <Gamepad2 className="w-5 h-5 text-[#D7FF00]" />
              <span>BOOK YOUR SESSION</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                navigate('/pricing');
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-[#260D17]/80 hover:bg-[#381322] text-[#FFF4E8] font-bold font-heading text-sm uppercase tracking-wider border border-[#49202C] transition-all hover:scale-[1.02]"
            >
              View Rates & Pricing
            </button>
          </div>

          {/* Key Amenities Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 max-w-3xl mx-auto text-xs text-[#C7A5A8]">
            <div className="p-3 rounded-xl bg-[#171014]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-[#D7FF00]" />
              <span className="font-semibold text-[#FFF4E8]">4K 120Hz HDR</span>
            </div>
            <div className="p-3 rounded-xl bg-[#171014]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <Users className="w-4 h-4 text-[#F5B942]" />
              <span className="font-semibold text-[#FFF4E8]">Up to 4-P Co-op</span>
            </div>
            <div className="p-3 rounded-xl bg-[#171014]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <Headphones className="w-4 h-4 text-[#45C987]" />
              <span className="font-semibold text-[#FFF4E8]">3D Spatial Audio</span>
            </div>
            <div className="p-3 rounded-xl bg-[#171014]/80 border border-[#49202C] flex items-center justify-center gap-2">
              <CircleDot className="w-4 h-4 text-[#D7FF00]" />
              <span className="font-semibold text-[#FFF4E8]">Pro 8-Ball Billiards</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PRICING SECTION (SINGLE CONSOLIDATED PRICING SECTION)                  */}
      {/* ========================================================================= */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold font-heading text-[#D7FF00] uppercase tracking-widest">
            <Coins className="w-4 h-4" /> Transparent Lounge Rates
          </div>
          <h2 className="text-2xl sm:text-4xl font-black font-heading uppercase text-white tracking-wider">
            CONSOLE & TABLE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D7FF00] to-[#F5B942]">PRICING</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#C7A5A8]">
            Direct pricing configured from central lounge management. Pay at the counter upon arrival.
          </p>
        </div>

        {/* 3 Authoritative Pricing Cards: PS5 Non-Exclusive, PS5 Exclusive, Pool Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: PS5 NON-EXCLUSIVE */}
          <div className="relative p-6 sm:p-7 rounded-3xl bg-[#260D17] border border-[#49202C] hover:border-[#851B2B] shadow-xl flex flex-col justify-between transition-all hover:scale-[1.02] group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-lg text-xs font-black font-heading uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  NON-EXCLUSIVE
                </span>
                <Gamepad2 className="w-6 h-6 text-[#851B2B] group-hover:text-[#D7FF00] transition-colors" />
              </div>

              <div>
                <h3 className="text-xl font-black font-heading text-white uppercase tracking-wider">
                  PS5 Standard Gaming
                </h3>
                <p className="text-xs text-[#C7A5A8] mt-1 leading-relaxed">
                  Ideal for casual sessions, tournament rivalries, and co-op matches. Title selected upon arrival.
                </p>
              </div>

              <div className="py-3 border-y border-[#49202C]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black font-heading text-[#FFF4E8]">
                    ₹{ps5RateRupees}
                  </span>
                  <span className="text-xs text-[#C7A5A8] font-mono">/ player / hour</span>
                </div>
                <span className="text-[11px] text-[#8F7275] block mt-1">Configured Central PS5 Rate</span>
              </div>

              <ul className="space-y-2.5 text-xs text-[#C7A5A8]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Sony PS5 Console with DualSense Wireless</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Full Standard Library (FC 25, Tekken 8, GT7)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>1 to 4 Players Couch Multiplayer Support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Shared or Private Seat Reservations</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onOpenBooking && onOpenBooking(ps5Station1)}
              className="mt-6 w-full py-3.5 rounded-xl bg-[#851B2B] hover:bg-[#A51F35] text-white font-black font-heading text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#851B2B]/20 flex items-center justify-center gap-2"
            >
              <span>BOOK NON-EXCLUSIVE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: PS5 EXCLUSIVE */}
          <div className="relative p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-[#30121E] to-[#260D17] border-2 border-[#851B2B] shadow-2xl flex flex-col justify-between transition-all hover:scale-[1.02] group">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#D7FF00] text-[#171014] text-[10px] font-black font-heading tracking-widest uppercase shadow-md">
              PREMIUM EXPERIENCE
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-lg text-xs font-black font-heading uppercase tracking-wider bg-amber-500/20 text-[#F5B942] border border-amber-500/40">
                  EXCLUSIVE
                </span>
                <Flame className="w-6 h-6 text-[#F5B942]" />
              </div>

              <div>
                <h3 className="text-xl font-black font-heading text-white uppercase tracking-wider">
                  PS5 Exclusive Titles
                </h3>
                <p className="text-xs text-[#C7A5A8] mt-1 leading-relaxed">
                  Dedicated console allocation and high-performance calibration for flagship releases (such as GTA 6).
                </p>
              </div>

              <div className="py-3 border-y border-[#49202C]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black font-heading text-[#FFF4E8]">
                    ₹{exclusiveRateRupees}
                  </span>
                  <span className="text-xs text-[#C7A5A8] font-mono">/ player / hour</span>
                </div>
                <span className="text-[11px] text-[#8F7275] block mt-1">Dedicated Station Reservation</span>
              </div>

              <ul className="space-y-2.5 text-xs text-[#C7A5A8]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#D7FF00] shrink-0" />
                  <span>Dedicated Physical PS5 Console Hardware Lock</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#D7FF00] shrink-0" />
                  <span>Optimized for Day-One & Exclusive Titles</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#D7FF00] shrink-0" />
                  <span>Priority Station Allocation & Low-Latency Displays</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#D7FF00] shrink-0" />
                  <span>Counter Payment Upon Lounge Arrival</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onOpenBooking && onOpenBooking(ps5Station1)}
              className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D7FF00] to-[#F5B942] hover:brightness-110 text-[#171014] font-black font-heading text-xs uppercase tracking-wider transition-all shadow-xl shadow-[#D7FF00]/20 flex items-center justify-center gap-2"
            >
              <span>BOOK EXCLUSIVE</span>
              <ArrowRight className="w-4 h-4 text-[#171014]" />
            </button>
          </div>

          {/* Card 3: 8-BALL POOL TABLE */}
          <div className="relative p-6 sm:p-7 rounded-3xl bg-[#260D17] border border-[#49202C] hover:border-[#851B2B] shadow-xl flex flex-col justify-between transition-all hover:scale-[1.02] group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-lg text-xs font-black font-heading uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  BILLIARDS ARENA
                </span>
                <CircleDot className="w-6 h-6 text-purple-400" />
              </div>

              <div>
                <h3 className="text-xl font-black font-heading text-white uppercase tracking-wider">
                  8-Ball Pool Table
                </h3>
                <p className="text-xs text-[#C7A5A8] mt-1 leading-relaxed">
                  Championship grade slate table, precision cue sticks, and dedicated lounge seating for friend matches.
                </p>
              </div>

              <div className="py-3 border-y border-[#49202C]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black font-heading text-[#FFF4E8]">
                    ₹{poolRateRupees}
                  </span>
                  <span className="text-xs text-[#C7A5A8] font-mono">/ hour</span>
                </div>
                <span className="text-[11px] text-[#8F7275] block mt-1">Configured Table Rate</span>
              </div>

              <ul className="space-y-2.5 text-xs text-[#C7A5A8]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Regulation 8-Ball Slate Tournament Table</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Standard Cue Sticks & Triangle Chalk Included</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Up to 4 Players Match Gameplay</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#45C987] shrink-0" />
                  <span>Instant Booking & Walk-in Slot Confirmation</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onOpenBooking && onOpenBooking(poolDevice)}
              className="mt-6 w-full py-3.5 rounded-xl bg-[#260D17] hover:bg-[#381322] border border-[#851B2B] text-white font-black font-heading text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <span>BOOK POOL TABLE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MEMBERSHIP SECTION (PRESERVED PLANS & PRICING)                         */}
      {/* ========================================================================= */}
      <section id="passes" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CustomerMembershipSection
          plans={plans}
          onSelectPlan={(plan) => {
            if (onOpenMembershipPlans) {
              onOpenMembershipPlans(plan);
            }
          }}
        />
      </section>

      {/* ========================================================================= */}
      {/* 4. LOCATION & VENUE DETAILS (CONFIGURED BAJAGOLI VENUE)                  */}
      {/* ========================================================================= */}
      <section id="location" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#260D17] border border-[#49202C] shadow-2xl">
          {/* Subtle lounge backdrop overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1511882150382-421056c89033?q=80&w=2070&auto=format&fit=crop')`,
            }}
          />

          <div className="relative z-10 p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Address */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40 flex items-center justify-center text-[#D7FF00]">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold font-heading text-white uppercase tracking-wider">
                Lounge Location
              </h3>
              <p className="text-xs sm:text-sm text-[#C7A5A8] leading-relaxed">
                NOAH GAMING & Esports Lounge<br />
                Bajagoli, Karkala Taluk<br />
                Udupi District, Karnataka – 574122
              </p>
              <a
                href="https://maps.google.com/?q=Bajagoli+Karkala"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D7FF00] hover:underline pt-1"
              >
                <span>Get Directions on Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Operating Timings */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40 flex items-center justify-center text-[#F5B942]">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold font-heading text-white uppercase tracking-wider">
                Operating Timings
              </h3>
              <p className="text-xs sm:text-sm text-[#C7A5A8] leading-relaxed">
                Open Daily: 10:00 AM – 11:00 PM IST<br />
                Monday through Sunday<br />
                <span className="text-[#45C987] font-semibold">Live Stations & Walk-in Ready</span>
              </p>
            </div>

            {/* Front Desk & Contact */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40 flex items-center justify-center text-[#45C987]">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold font-heading text-white uppercase tracking-wider">
                Front Desk Inquiries
              </h3>
              <p className="text-xs sm:text-sm text-[#C7A5A8] leading-relaxed">
                Counter Phone & WhatsApp Support<br />
                Tournament & Group Bookings<br />
                <span className="font-mono text-white">+91 94819 74347</span>
              </p>
              <span className="text-xs text-[#8F7275] block">support@noahclubs.in</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
