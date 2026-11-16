export const ROLES = {
  CUSTOMER: 'customer',
  RECEPTIONIST: 'receptionist',
  ADMIN: 'admin',
};

export const DEVICE_CATEGORIES = {
  PS5: 'ps5',
  POOL: 'pool',
  EXCLUSIVE: 'exclusive',
};

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

export const PAYMENT_STATUS = {
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  UNPAID: 'unpaid',
  REFUNDED: 'refunded',
};

export const PAYMENT_METHODS = {
  RAZORPAY: 'razorpay',
  UPI: 'upi',
  CASH: 'cash',
  MEMBERSHIP_CREDIT: 'membership_credit',
};

export const TIMEZONE = 'Asia/Kolkata';

export const DEFAULT_CONFIG = {
  PS5_HOURLY_RATE: 60,
  PS5_MAX_CAPACITY: 4,
  POOL_HOURLY_RATE: 160,
  POOL_MAX_CAPACITY: 2,
  GTA6_HOURLY_RATE: 150,
  GTA6_ACTIVE: false,
  ADVANCE_PAYMENT_MIN_PCT: 50,
  AUTO_RELEASE_UNPAID_MINUTES: 10,
  REMINDER_15_MIN: true,
  REMINDER_5_MIN: true,
};
