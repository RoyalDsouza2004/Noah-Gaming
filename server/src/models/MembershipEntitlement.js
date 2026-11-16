/**
 * MembershipEntitlement — Atomic Daily Free-Hour Entitlement
 *
 * One document per customer per membership-day per entitlement type.
 * The unique index on `entitlementKey` enforces atomicity:
 * only one reservation or consumption can win a concurrent race.
 *
 * States:
 *   RESERVED  — atomically claimed for an in-progress booking
 *   CONSUMED  — booking confirmed and entitlement permanently used
 *   RELEASED  — reservation abandoned (payment failed / booking cancelled)
 */
import mongoose from 'mongoose';

const membershipEntitlementSchema = new mongoose.Schema(
  {
    /**
     * Composite key: `${customerId}_${subscriptionId}_${bookingDateIST}_DAILY_FREE_HOUR`
     * Unique index enforces one entitlement per customer per day per subscription.
     */
    entitlementKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipSubscription',
      required: true,
      index: true,
    },

    // The IST calendar date string (YYYY-MM-DD) this entitlement applies to
    membershipDate: {
      type: String,
      required: true,
      index: true,
    },

    entitlementType: {
      type: String,
      enum: ['DAILY_FREE_HOUR'],
      default: 'DAILY_FREE_HOUR',
      index: true,
    },

    // RESERVED → CONSUMED (confirmed booking) or RELEASED (failure/cancel)
    state: {
      type: String,
      enum: ['RESERVED', 'CONSUMED', 'RELEASED'],
      default: 'RESERVED',
      index: true,
    },

    // Booking that reserved/consumed this entitlement
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },

    // Idempotency key from the booking request that created this reservation
    idempotencyKey: {
      type: String,
      default: null,
    },

    // When RESERVED state expires — allows recovery of abandoned reservations
    reservationExpiresAt: {
      type: Date,
      default: null,
    },

    // When the entitlement was consumed or released
    finalizedAt: {
      type: Date,
      default: null,
    },

    releaseReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast per-customer per-day lookups
membershipEntitlementSchema.index({ customer: 1, membershipDate: 1, entitlementType: 1 });
membershipEntitlementSchema.index({ booking: 1 });
membershipEntitlementSchema.index({ state: 1, reservationExpiresAt: 1 });

// TTL index: MongoDB automatically deletes RELEASED documents after 7 days (cleanup)
// Note: TTL only fires on `createdAt`, so we use a manual cleanup strategy in `state` field
// This index is for auto-expiry of truly stale docs
membershipEntitlementSchema.index(
  { finalizedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 7, // 7 days after finalization
    partialFilterExpression: { state: 'RELEASED' },
  }
);

const MembershipEntitlement = mongoose.model(
  'MembershipEntitlement',
  membershipEntitlementSchema
);

export default MembershipEntitlement;
