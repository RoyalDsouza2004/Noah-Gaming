import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crown,
  Check,
  Flame,
  Zap,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Lock,
  AlertCircle,
} from 'lucide-react';
import {
  isYearlyPlan,
  isMonthlyPlan,
  selectThreePopularPlans,
  calculateYearlyDiscountPercentage,
} from '../../utils/membershipPlanHelpers.js';
import { FEATURE_FLAGS, PAYMENT_MESSAGES } from '../../utils/featureFlags.js';

export const CustomerMembershipSection = ({
  plans = [],
  onSelectPlan,
}) => {
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'yearly'
  const [showAllTiers, setShowAllTiers] = useState(false);
  const [allTiersFilter, setAllTiersFilter] = useState('all'); // 'all' | 'monthly' | 'yearly'

  // Mobile carousel tracking
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const carouselRef = useRef(null);
  const cardRefs = useRef([]);

  // Calculate verified yearly discount percentage
  const yearlyDiscount = calculateYearlyDiscountPercentage(plans);

  // Filter 3 popular plans for current billing period
  const popularPlans = selectThreePopularPlans(plans, billingPeriod);

  // Handle switching billing period (resets carousel scroll without touching window scroll)
  const handleBillingPeriodChange = (period) => {
    if (period === billingPeriod) return;
    setBillingPeriod(period);
    setActiveMobileIndex(0);
    const container = carouselRef.current;
    if (container) {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Track scroll position on mobile to dynamically elevate the centered card
  const handleCarouselScroll = useCallback(() => {
    const container = carouselRef.current;
    if (!container || popularPlans.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestIdx = 0;
    let minDistance = Infinity;

    cardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const cardRect = el.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(containerCenter - cardCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    });

    if (closestIdx !== activeMobileIndex) {
      setActiveMobileIndex(closestIdx);
    }
  }, [activeMobileIndex, popularPlans.length]);

  // Scroll ONLY the horizontal carousel container without affecting window scroll
  const scrollToMobileCard = (idx) => {
    setActiveMobileIndex(idx);
    const container = carouselRef.current;
    const targetEl = cardRefs.current[idx];
    if (targetEl && container) {
      const targetLeft =
        targetEl.offsetLeft - (container.clientWidth - targetEl.clientWidth) / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  };

  // Filter plans for the "View All Tiers" view
  const allFilteredPlans = plans.filter((p) => {
    if (p.status && p.status !== 'ACTIVE') return false;
    if (allTiersFilter === 'monthly') return isMonthlyPlan(p);
    if (allTiersFilter === 'yearly') return isYearlyPlan(p);
    return true;
  });

  // Render individual card helper
  const renderPlanCard = (plan, { isMiddleElevated = false, isMobile = false, isMobileActive = false }) => {
    if (!plan) return null;
    const isVip = plan.includesExclusiveGames;
    const isUnlimited = plan.isUnlimited;
    const isPopular =
      isMiddleElevated ||
      (plan.description && plan.description.toLowerCase().includes('popular')) ||
      (plan.name && plan.name.toLowerCase().includes('pro'));

    return (
      <article
        className={`membership-plan-card relative flex flex-col justify-between p-6 rounded-3xl transition-all duration-300 ${
          isMiddleElevated
            ? 'bg-[#2E0E1B] dark:bg-[#2E0E1B] border-2 border-[#851B2B] dark:border-[#F5B942]/60 shadow-2xl shadow-[#851B2B]/25 md:-translate-y-3'
            : isMobile && isMobileActive
            ? 'bg-[#2E0E1B] dark:bg-[#2E0E1B] border-2 border-[#851B2B] dark:border-[#F5B942]/60 shadow-2xl shadow-[#851B2B]/25 -translate-y-2 scale-100 opacity-100'
            : isMobile && !isMobileActive
            ? 'bg-[#260D17] dark:bg-[#260D17] border border-[#49202C] shadow-lg translate-y-4 scale-[0.93] opacity-75'
            : 'bg-[#260D17] dark:bg-[#260D17] border border-[#49202C] hover:border-[#851B2B]/60 shadow-lg'
        }`}
      >
        {/* Most Popular Badge on Middle Card */}
        {isPopular && (
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full whitespace-nowrap bg-gradient-to-r from-[#F5B942] to-[#E5A020] text-[#171014] font-heading font-black text-[10px] tracking-widest uppercase shadow-lg shadow-[#F5B942]/30 border border-[#F5B942]/50">
            <Crown className="w-3 h-3 text-[#171014]" />
            MOST POPULAR
          </span>
        )}

        {/* Card Header & Badges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#171014] text-[#C7A5A8] border border-[#49202C]">
              {plan.validityDuration} {plan.validityUnit}
            </span>

            {isVip ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/40 flex items-center gap-1">
                <Flame className="w-3 h-3" /> VIP GTA 6
              </span>
            ) : isUnlimited ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#851B2B]/20 text-[#FFF4E8] border border-[#851B2B]/40 flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#D7FF00]" /> UNLIMITED
              </span>
            ) : null}
          </div>

          <div>
            <h4 className="text-xl font-bold text-[#FFF4E8] font-heading tracking-tight">
              {plan.name}
            </h4>
            <p className="text-xs text-[#C7A5A8] mt-1.5 line-clamp-2 min-h-[32px]">
              {plan.description || 'Exclusive daily gaming access and priority booking perks.'}
            </p>
          </div>

          {/* Pricing Display */}
          <div className="pt-3 pb-1 border-t border-[#49202C]">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black font-heading text-[#FFF4E8]">
                ₹{plan.price / 100}
              </span>
              <span className="text-xs font-medium text-[#C7A5A8] font-sans">
                {billingPeriod === 'yearly' || isYearlyPlan(plan) ? ' / year' : ' / month'}
              </span>
            </div>
            {isYearlyPlan(plan) && (
              <p className="text-[10px] text-[#45C987] font-mono mt-0.5">
                Effective ₹{Math.round(plan.price / 1200)} / month
              </p>
            )}
          </div>

          {/* Feature List */}
          <div className="space-y-2.5 text-xs text-[#C7A5A8] pt-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#45C987]/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#45C987]" />
              </div>
              <span>
                Daily Quota:{' '}
                <strong className="text-[#FFF4E8]">
                  {plan.dailyUsageLimit ? `${plan.dailyUsageLimit / 60}h / day` : 'Unlimited Hours'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#45C987]/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#45C987]" />
              </div>
              <span>
                Max Session:{' '}
                <strong className="text-[#FFF4E8]">
                  {plan.maximumSessionDuration / 60}h continuous
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#45C987]/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#45C987]" />
              </div>
              <span>
                {isVip
                  ? 'Includes Exclusive GTA 6 & Private Stations'
                  : 'Covers PS5 Consoles & 8-Ball Pool'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#45C987]/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#45C987]" />
              </div>
              <span>
                Advance Booking:{' '}
                <strong className="text-[#FFF4E8]">
                  {plan.advanceBookingLimit || 7} days prior
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          disabled={!FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES}
          onClick={() => {
            if (FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES && onSelectPlan) {
              onSelectPlan(plan);
            }
          }}
          aria-disabled={!FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES}
          className={`mt-6 w-full py-3 px-4 rounded-xl font-bold font-heading text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
            !FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES
              ? 'bg-[#1D0C13] text-[#A68F94] border border-[#3E1A25] cursor-not-allowed opacity-80 shadow-none'
              : isPopular
              ? 'bg-gradient-to-r from-[#851B2B] to-[#A51F35] hover:from-[#6E1623] hover:to-[#851B2B] text-white shadow-lg shadow-[#851B2B]/30 border border-[#A51F35]'
              : 'bg-[#851B2B] hover:bg-[#6E1623] text-white border border-[#851B2B] shadow-md shadow-[#851B2B]/20'
          }`}
        >
          {!FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES ? (
            <>
              <Lock className="w-3.5 h-3.5 text-[#F5B942]" />
              <span>Memberships Temporarily Unavailable</span>
            </>
          ) : (
            <>
              <Crown className="w-4 h-4 text-[#F5B942]" />
              <span>Get This Pass</span>
            </>
          )}
        </button>
      </article>
    );
  };

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8"
      aria-label="NOAH Club Passes & Memberships"
    >
      {/* ========================================================= */}
      {/* 1. SECTION HEADER WITH VIEW ALL TOGGLE                    */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5B942] uppercase tracking-wider mb-1">
            <Crown className="w-4 h-4 text-[#F5B942]" /> NOAH Club Passes
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#FFF4E8]">
            {billingPeriod === 'yearly'
              ? 'Annual Memberships & Priority Gaming Quotas'
              : 'Monthly Memberships & Daily Fair-Use Quotas'}
          </h2>
          <p className="text-xs sm:text-sm text-[#C7A5A8] mt-1 max-w-2xl">
            Frequent gamers save big with our membership plans. Enjoy daily included gaming quotas, 100%
            covered sessions, and priority booking slots.
          </p>
        </div>

        {/* View All Membership Tiers Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAllTiers(!showAllTiers)}
          className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#e5aa35] text-[#171014] font-black text-xs uppercase tracking-wider font-heading flex items-center gap-2 shadow-md shadow-[#F5B942]/20 transition-transform active:scale-95"
        >
          <Crown className="w-4 h-4 text-[#171014]" />
          <span>{showAllTiers ? 'Show 3 Popular Plans' : 'View All Membership Tiers'}</span>
        </button>
      </div>

      {/* Temporarily Disabled Notice Banner */}
      {!FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#851B2B]/20 border border-[#851B2B]/40 text-[#FFF4E8]">
          <div className="w-9 h-9 rounded-xl bg-[#851B2B]/40 flex items-center justify-center shrink-0 text-[#F5B942]">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold font-heading text-[#F5B942] uppercase tracking-wider">
              Memberships Temporarily Unavailable
            </p>
            <p className="text-xs text-[#C7A5A8] mt-0.5">
              Online membership purchases are temporarily paused. Existing active memberships and daily quotas remain fully active and valid. For enquiries or assistance, please speak with our front desk.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. BILLING PERIOD SWITCH (MONTHLY / YEARLY)                */}
      {/* ========================================================= */}
      {!showAllTiers && (
        <div className="flex justify-center pt-2">
          <div
            role="tablist"
            aria-label="Billing period"
            className="inline-flex items-center gap-1 p-1 rounded-full bg-[#171014] border border-[#49202C] shadow-inner"
          >
            <button
              type="button"
              role="tab"
              aria-selected={billingPeriod === 'monthly'}
              onClick={() => handleBillingPeriodChange('monthly')}
              className={`px-5 py-2 rounded-full text-xs font-bold font-heading uppercase tracking-wider transition-all duration-200 ${
                billingPeriod === 'monthly'
                  ? 'bg-[#851B2B] text-white shadow-md shadow-[#851B2B]/40'
                  : 'text-[#C7A5A8] hover:text-[#FFF4E8] bg-transparent'
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={billingPeriod === 'yearly'}
              onClick={() => handleBillingPeriodChange('yearly')}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold font-heading uppercase tracking-wider transition-all duration-200 ${
                billingPeriod === 'yearly'
                  ? 'bg-[#851B2B] text-white shadow-md shadow-[#851B2B]/40'
                  : 'text-[#C7A5A8] hover:text-[#FFF4E8] bg-transparent'
              }`}
            >
              <span>Yearly</span>
              {yearlyDiscount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-[9px] tracking-wide">
                  -{yearlyDiscount}%
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. POPULAR 3-PLAN VIEW                                     */}
      {/* ========================================================= */}
      {!showAllTiers && (
        <>
          {popularPlans.length === 0 ? (
            /* Empty state for Yearly if no annual plans are configured in DB */
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#260D17] border border-[#49202C] space-y-4 max-w-2xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-[#851B2B]/20 text-[#F5B942] flex items-center justify-center mx-auto border border-[#851B2B]/40">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold font-heading text-[#FFF4E8]">
                Annual Passes Under Curation
              </h3>
              <p className="text-xs sm:text-sm text-[#C7A5A8] max-w-md mx-auto">
                Our management team is finalizing annual VIP packages with exclusive perks. In the
                meantime, enjoy complete flexibility with our popular monthly passes!
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleBillingPeriodChange('monthly')}
                  className="px-4 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#6E1623] text-white font-bold font-heading text-xs uppercase tracking-wider shadow-md shadow-[#851B2B]/20"
                >
                  Switch to Monthly Passes
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW: Exactly 3 horizontal cards with elevated middle card */}
              <div className="hidden md:grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-center pt-6 pb-4">
                {popularPlans.map((plan, idx) => (
                  <div key={plan._id || idx} className="h-full flex flex-col">
                    {renderPlanCard(plan, { isMiddleElevated: idx === 1 })}
                  </div>
                ))}
              </div>

              {/* MOBILE VIEW: Horizontal Parabolic Carousel with Active Center Elevation */}
              <div className="block md:hidden relative pt-6 pb-2">
                <div
                  ref={carouselRef}
                  onScroll={handleCarouselScroll}
                  className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pt-5 pb-6 px-[calc(50vw-140px)]"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {popularPlans.map((plan, idx) => {
                    const isActive = idx === activeMobileIndex;
                    return (
                      <div
                        key={plan._id || idx}
                        ref={(el) => (cardRefs.current[idx] = el)}
                        className="snap-center shrink-0 w-[280px] transition-all duration-300 flex flex-col"
                      >
                        {renderPlanCard(plan, {
                          isMobile: true,
                          isMobileActive: isActive,
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Pagination Dots */}
                {popularPlans.length > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-2">
                    {popularPlans.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={() => scrollToMobileCard(dotIdx)}
                        aria-label={`Go to plan ${dotIdx + 1}`}
                        className={`transition-all duration-300 rounded-full ${
                          activeMobileIndex === dotIdx
                            ? 'w-6 h-2 bg-[#F5B942]'
                            : 'w-2 h-2 bg-[#49202C] hover:bg-[#851B2B]'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* 4. "VIEW ALL MEMBERSHIP TIERS" COMPLETE GRID VIEW         */}
      {/* ========================================================= */}
      {showAllTiers && (
        <div className="space-y-6 animate-fadeIn">
          {/* Sub-Filter Controls for All Tiers View */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#1F0B13] border border-[#49202C]">
            <div className="flex items-center gap-2 text-xs text-[#C7A5A8]">
              <Layers className="w-4 h-4 text-[#F5B942]" />
              <span>
                Displaying all <strong>{allFilteredPlans.length}</strong> lounge membership passes.
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {['all', 'monthly', 'yearly'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAllTiersFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading uppercase tracking-wider transition-all ${
                    allTiersFilter === tab
                      ? 'bg-[#851B2B] text-white shadow-sm'
                      : 'text-[#C7A5A8] hover:text-[#FFF4E8] bg-[#171014]'
                  }`}
                >
                  {tab === 'all' ? 'All Tiers' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of All Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {allFilteredPlans.map((plan) => (
              <div key={plan._id} className="flex flex-col">
                {renderPlanCard(plan, { isMiddleElevated: false })}
              </div>
            ))}
          </div>

          {/* Back to Popular Plans Button */}
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllTiers(false)}
              className="px-6 py-2.5 rounded-xl bg-[#260D17] hover:bg-[#341220] text-[#FFF4E8] border border-[#49202C] hover:border-[#851B2B] text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
            >
              <Sparkles className="w-4 h-4 text-[#F5B942]" />
              <span>Back to 3 Popular Plans</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
