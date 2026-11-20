/**
 * NOAH GAMING - Membership Plan Filtering, Popularity & Pricing Helpers
 * Pure utility functions for the redesigned customer-facing membership cards.
 */

/**
 * Checks whether a plan corresponds to Yearly / Annual billing
 * based on validityUnit ('YEARS'), duration (>= 300 days / >= 12 months),
 * or plan naming conventions.
 */
export const isYearlyPlan = (plan) => {
  if (!plan) return false;
  const unit = (plan.validityUnit || '').toUpperCase();
  const duration = Number(plan.validityDuration) || 0;

  if (unit === 'YEARS' || unit === 'YEAR') return true;
  if (unit === 'DAYS' && duration >= 300) return true;
  if (unit === 'MONTHS' && duration >= 12) return true;

  const name = (plan.name || '').toLowerCase();
  return name.includes('year') || name.includes('annual');
};

/**
 * Checks whether a plan corresponds to Monthly billing
 */
export const isMonthlyPlan = (plan) => {
  return !isYearlyPlan(plan);
};

/**
 * Calculates verified annual discount percentage compared to monthly billing.
 * Returns 0 if there is no verified discount or if no yearly plans exist.
 */
export const calculateYearlyDiscountPercentage = (plans = []) => {
  if (!Array.isArray(plans) || plans.length === 0) return 0;

  const monthly = plans.filter((p) => p.status === 'ACTIVE' && isMonthlyPlan(p));
  const yearly = plans.filter((p) => p.status === 'ACTIVE' && isYearlyPlan(p));

  if (monthly.length === 0 || yearly.length === 0) return 0;

  // Find comparable tiers (e.g. median or standard pro passes)
  const medianMonthly = [...monthly].sort((a, b) => a.price - b.price)[
    Math.floor(monthly.length / 2)
  ];
  const medianYearly = [...yearly].sort((a, b) => a.price - b.price)[
    Math.floor(yearly.length / 2)
  ];

  if (!medianMonthly || !medianYearly || medianMonthly.price <= 0) return 0;

  const annualPriceIfMonthly = medianMonthly.price * 12;
  const actualYearlyPrice = medianYearly.price;

  if (actualYearlyPrice >= annualPriceIfMonthly) return 0;

  const discount = Math.round(
    ((annualPriceIfMonthly - actualYearlyPrice) / annualPriceIfMonthly) * 100
  );

  return discount > 0 && discount < 100 ? discount : 0;
};

/**
 * Selects exactly 3 popular / flagship plans for the chosen billing period:
 * [0: Left (Starter/Casual), 1: Center (Most Popular), 2: Right (VIP / Pro)]
 *
 * Ensures:
 * - Real existing database plan records are used.
 * - Does not invent new plans or mutate prices.
 * - Center card is the dedicated "Most Popular" plan.
 * - Highly resilient to custom admin plans or future database edits.
 */
export const selectThreePopularPlans = (plans = [], billingPeriod = 'monthly') => {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  // Filter for active plans matching the requested billing period
  const activePlans = plans.filter((p) => {
    if (p.status && p.status !== 'ACTIVE') return false;
    return billingPeriod === 'yearly' ? isYearlyPlan(p) : isMonthlyPlan(p);
  });

  if (activePlans.length <= 3) {
    return activePlans;
  }

  // Canonical NOAH GAMING flagship tier definitions
  const canonicalNames = [
    'Basic Gamer Monthly',
    'Standard Pro Pass',
    'Ultimate VIP (Includes GTA 6)',
    'Premium Unlimited Membership',
  ];

  const matchedCanonical = activePlans.filter((p) =>
    canonicalNames.some((cName) => p.name.toLowerCase().includes(cName.toLowerCase()))
  );

  if (matchedCanonical.length >= 3) {
    const sorted = [...matchedCanonical].sort((a, b) => a.price - b.price);
    const starter = sorted[0]; // e.g. Basic Gamer Monthly
    const popular =
      sorted.find(
        (p) =>
          p.name.toLowerCase().includes('standard pro') ||
          (p.description && p.description.toLowerCase().includes('most popular'))
      ) || sorted[1]; // e.g. Standard Pro Pass
    const vip = sorted[sorted.length - 1]; // e.g. Ultimate VIP (GTA 6)

    // Deduplicate in case of duplicate matches
    const tierSet = [starter, popular, vip];
    const unique = Array.from(new Set(tierSet));
    if (unique.length === 3) {
      return [unique[0], unique[1], unique[2]];
    }
  }

  // Fallback for custom administrator tiers / yearly tiers:
  // Sort by price ascending
  const sorted = [...activePlans].sort((a, b) => a.price - b.price);

  const left = sorted[0]; // Lowest price / Starter
  const right = sorted[sorted.length - 1]; // Highest price / VIP

  // Find candidate for Center (Popular): matches "popular", "pro", or median
  const middleCandidates = sorted.slice(1, sorted.length - 1);
  let center = middleCandidates.find(
    (p) =>
      (p.description && p.description.toLowerCase().includes('popular')) ||
      (p.name && p.name.toLowerCase().includes('pro')) ||
      (p.name && p.name.toLowerCase().includes('standard'))
  );

  if (!center && middleCandidates.length > 0) {
    center = middleCandidates[Math.floor(middleCandidates.length / 2)];
  }

  if (!center) {
    center = sorted[1] || sorted[0];
  }

  return [left, center, right];
};
