/**
 * NOAH GAMING - System Feature Flags & Operational Configuration
 * Central database-backed management for payment gateways, online checkout, and membership availability.
 */
import Setting from '../models/Setting.js';

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

/**
 * Fetch feature flags from MongoDB Setting collection and update memory cache
 */
export async function getSystemFeatures() {
  try {
    const setting = await Setting.findOne({ key: 'system_feature_flags' });
    if (setting && setting.value) {
      if (typeof setting.value.enableOnlinePayments === 'boolean') {
        FEATURES.ENABLE_ONLINE_PAYMENTS = setting.value.enableOnlinePayments;
      }
      if (typeof setting.value.enableMembershipPurchases === 'boolean') {
        FEATURES.ENABLE_MEMBERSHIP_PURCHASES = setting.value.enableMembershipPurchases;
      }
    }
  } catch (err) {
    console.warn('[Feature Flags] Failed to load from database, using cached memory defaults:', err.message);
  }

  return {
    enableOnlinePayments: FEATURES.ENABLE_ONLINE_PAYMENTS,
    enableMembershipPurchases: FEATURES.ENABLE_MEMBERSHIP_PURCHASES,
  };
}

/**
 * Update feature flags in MongoDB and memory cache (Admin only action)
 */
export async function updateSystemFeatures({ enableOnlinePayments, enableMembershipPurchases }, updatedBy = null) {
  const nextOnline =
    typeof enableOnlinePayments === 'boolean'
      ? enableOnlinePayments
      : FEATURES.ENABLE_ONLINE_PAYMENTS;
  const nextMembership =
    typeof enableMembershipPurchases === 'boolean'
      ? enableMembershipPurchases
      : FEATURES.ENABLE_MEMBERSHIP_PURCHASES;

  const setting = await Setting.findOneAndUpdate(
    { key: 'system_feature_flags' },
    {
      value: {
        enableOnlinePayments: nextOnline,
        enableMembershipPurchases: nextMembership,
      },
      category: 'INTEGRATIONS',
      description: 'Master switches for customer online payments (Razorpay) and membership purchases',
      updatedBy,
    },
    { upsert: true, new: true }
  );

  FEATURES.ENABLE_ONLINE_PAYMENTS = nextOnline;
  FEATURES.ENABLE_MEMBERSHIP_PURCHASES = nextMembership;

  return {
    enableOnlinePayments: nextOnline,
    enableMembershipPurchases: nextMembership,
    updatedAt: setting?.updatedAt || new Date(),
  };
}
