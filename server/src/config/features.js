/**
 * NOAH GAMING - System Feature Flags & Operational Configuration
 * Central management for payment gateways, online checkout, and membership availability.
 */
export const FEATURES = {
  // Master switch for initiating new customer online payments (Razorpay Orders)
  ENABLE_ONLINE_PAYMENTS: false,

  // Master switch for customer-facing membership pass purchases and online upgrades/renewals
  ENABLE_MEMBERSHIP_PURCHASES: false,
};

export const PAYMENT_MESSAGES = {
  ONLINE_UNAVAILABLE:
    'Online payments are temporarily unavailable. Please contact the lounge or pay at the venue.',
  MEMBERSHIP_UNAVAILABLE:
    'Membership purchases are temporarily unavailable. Please contact the front desk or lounge reception.',
};
