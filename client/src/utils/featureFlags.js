import { paymentApi } from '../api/payment.js';

export const FEATURE_FLAGS = {
  ENABLE_ONLINE_PAYMENTS: false,
  ENABLE_MEMBERSHIP_PURCHASES: false,
};

export const PAYMENT_MESSAGES = {
  ONLINE_UNAVAILABLE: 'Online payments are temporarily unavailable. Please contact the lounge or pay at the venue.',
  MEMBERSHIP_UNAVAILABLE: 'Memberships are temporarily unavailable for purchase. Please contact the front desk or lounge reception.',
};

const listeners = new Set();

export function setFeatureFlags(data = {}) {
  let changed = false;
  if (typeof data.enableOnlinePayments === 'boolean' && FEATURE_FLAGS.ENABLE_ONLINE_PAYMENTS !== data.enableOnlinePayments) {
    FEATURE_FLAGS.ENABLE_ONLINE_PAYMENTS = data.enableOnlinePayments;
    changed = true;
  }
  if (typeof data.enableMembershipPurchases === 'boolean' && FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES !== data.enableMembershipPurchases) {
    FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES = data.enableMembershipPurchases;
    changed = true;
  }

  if (changed) {
    listeners.forEach((fn) => {
      try {
        fn({ ...FEATURE_FLAGS });
      } catch (err) {
        console.error('[Feature Flag Listener Error]:', err);
      }
    });
  }
}

export function subscribeFeatureFlags(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function fetchFeatureFlags() {
  try {
    const res = await paymentApi.getFeatures();
    if (res?.success && res?.data) {
      setFeatureFlags(res.data);
      return res.data;
    }
  } catch (err) {
    // Retain defaults silently on network/offline
  }
  return {
    enableOnlinePayments: FEATURE_FLAGS.ENABLE_ONLINE_PAYMENTS,
    enableMembershipPurchases: FEATURE_FLAGS.ENABLE_MEMBERSHIP_PURCHASES,
  };
}
