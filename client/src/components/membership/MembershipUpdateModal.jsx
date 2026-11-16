import React, { useState, useEffect } from 'react';
import { membershipApi } from '../../api/membership.js';
import {
  Sparkles,
  Crown,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  TrendingUp,
  ShieldCheck,
  Check,
  Gamepad2,
  Users,
} from 'lucide-react';

export const MembershipUpdateModal = ({
  subscription,
  onClose,
  onOpenRenewal,
  onOpenUpgrade,
}) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await membershipApi.getPlans();
        if (res.success && res.data?.plans) {
          setPlans(res.data.plans);
        }
      } catch (err) {
        console.warn('Failed to load membership plans:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  if (!subscription) return null;

  const plan = subscription.membershipPlan || {};
  const planPriceRupees = plan.price ? plan.price / 100 : 0;
  const now = new Date();
  const expiryDate = new Date(subscription.expirationDate);
  const startDate = new Date(subscription.startDate || subscription.createdAt);
  const remainingMs = expiryDate.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  const isActive = subscription.status === 'ACTIVE' && remainingMs > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#260D17] border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 text-[#FFF4E8] flex items-center justify-center border border-[#851B2B]/30">
              <Crown className="w-5 h-5 text-[#D7FF00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-heading text-white">MEMBERSHIP DETAILS & MANAGEMENT</h3>
              <p className="text-xs text-slate-400">View active benefits, renew, or switch passes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 space-y-5 pr-1 mt-4">
          {/* Active Pass Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {isActive ? 'ACTIVE SUBSCRIPTION' : subscription.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {subscription.subscriptionId}
                  </span>
                </div>
                <h4 className="text-xl font-black font-heading text-white mt-1">{plan.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl font-black font-mono text-[#D7FF00]">
                  ₹{planPriceRupees}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {remainingDays} days remaining
                </span>
              </div>
            </div>

            {/* Timelines */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] uppercase text-slate-500 block">Activated On</span>
                <span className="text-white">
                  {startDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] uppercase text-slate-500 block">Expires On</span>
                <span className="text-emerald-400 font-bold">
                  {expiryDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40">
                <span className="text-[10px] uppercase text-[#D7FF00] block font-bold">Remaining Days</span>
                <span className="text-white font-bold">{remainingDays} Day(s)</span>
              </div>
            </div>

            {/* Configured Plan Privileges */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold font-heading flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#D7FF00]" /> Configured Entitlements
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Daily Free Booking:{' '}
                    <strong className="text-white font-mono">{Math.round((plan.dailyUsageLimit || 60) / 60)} hr/day</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Advance Booking Limit:{' '}
                    <strong className="text-white font-mono">{plan.advanceBookingLimit || 3} days ahead</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Station Rate Discount:{' '}
                    <strong className="text-white font-mono">{plan.discountPercentage || 100}% off</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Booking Mode:{' '}
                    <strong className="text-white">
                      {plan.privateBookingAllowed ? 'Shared & Private' : 'Shared Sessions'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Separate Actions: RENEW vs UPGRADE */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenRenewal) onOpenRenewal(subscription);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#851B2B] hover:bg-[#9e2033] text-[#FFF4E8] font-bold font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-[#851B2B]/20"
              >
                <RotateCcw className="w-4 h-4 text-[#D7FF00]" />
                Renew Existing Plan (+{plan.validityDuration || 30} Days)
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenUpgrade) onOpenUpgrade(subscription);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-[#D7FF00]/10"
              >
                <TrendingUp className="w-4 h-4" />
                Upgrade to Higher Tier (Prorated)
              </button>
            </div>
          </div>

          {/* Catalog of Available Plans */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 font-heading">
              Available Lounge Membership Tiers
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map((p) => {
                const isCurrent = p._id === plan._id;
                const isHigher = p.price > (plan.price || 0);

                return (
                  <div
                    key={p._id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between text-xs transition-all ${
                      isCurrent
                        ? 'bg-[#851B2B]/15 border-[#851B2B]/60'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-white font-heading">{p.name}</span>
                        <span className="font-mono font-bold text-[#D7FF00]">
                          ₹{p.price ? p.price / 100 : 0}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{p.description}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{p.advanceBookingLimit || 3}d advance</span>
                      <span>{Math.round((p.dailyUsageLimit || 60) / 60)}h/day free</span>
                      {isCurrent ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-sans">
                          Current
                        </span>
                      ) : isHigher ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#D7FF00]/20 text-[#D7FF00] font-bold font-sans">
                          Upgrade Tier
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
