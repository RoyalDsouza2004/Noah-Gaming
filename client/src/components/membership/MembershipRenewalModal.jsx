import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { membershipApi } from '../../api/membership.js';
import { showToast } from '../../utils/toast.js';
import { launchRazorpayCheckout } from '../../utils/razorpay.js';
import {
  RotateCcw,
  Sparkles,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const MembershipRenewalModal = ({
  subscription,
  onClose,
  onRenewalSuccess,
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [success, setSuccess] = useState(false);

  // Lock body scroll while modal is visible
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!subscription) return null;

  const plan = subscription.membershipPlan || {};
  const planPriceRupees = plan.price ? plan.price / 100 : 0;
  const validityDays = plan.validityDuration || 30;

  // Calculate new expiration date
  const now = new Date();
  const currentExpiry = new Date(subscription.expirationDate);
  const isCurrentlyActive = subscription.status === 'ACTIVE' && currentExpiry > now;
  const baseDate = isCurrentlyActive ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const handleStartRenewal = async () => {
    setError('');
    setProcessing(true);
    try {
      const res = await membershipApi.renewSubscription(subscription._id);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to generate renewal order');
      }

      const order = res.data;
      setOrderData(order);

      // Launch Razorpay checkout
      launchRazorpayCheckout({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        keyId: order.keyId,
        name: 'NOAH GAMING',
        description: `Renewal: ${plan.name || 'Membership'}`,
        prefill: {
          name: order.customerName || '',
          email: order.customerEmail || '',
          contact: order.customerPhone || '',
        },
        handler: async (response) => {
          try {
            const verifyRes = await membershipApi.verifyMembership({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              renewalSubscriptionId: subscription._id,
              planId: plan._id,
            });

            if (verifyRes.success) {
              setSuccess(true);
              showToast.success(`Membership renewed successfully! Valid until ${newExpiry.toLocaleDateString('en-IN')}`);
              if (onRenewalSuccess) {
                onRenewalSuccess(verifyRes.data?.subscription || subscription);
              }
            } else {
              throw new Error(verifyRes.message || 'Payment verification failed');
            }
          } catch (verifyErr) {
            setError(verifyErr.message || 'Payment verification failed');
            showToast.error(verifyErr.message || 'Verification failed');
          } finally {
            setProcessing(false);
          }
        },
        onDismiss: () => {
          setProcessing(false);
          showToast.info('Renewal payment cancelled');
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to initiate membership renewal');
      showToast.error(err.message || 'Renewal initiation failed');
      setProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg my-auto max-h-[92vh] overflow-y-auto bg-[#260D17] border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 text-[#FFF4E8] flex items-center justify-center border border-[#851B2B]/30">
              <RotateCcw className="w-5 h-5 text-[#D7FF00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-heading text-white">RENEW MEMBERSHIP</h3>
              <p className="text-xs text-slate-400">Extend your current pass seamlessly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-xl font-bold font-heading text-white">MEMBERSHIP EXTENDED</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your <span className="text-[#D7FF00] font-semibold">{plan.name}</span> has been renewed.
              </p>
              <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono inline-block text-emerald-400">
                New Expiry: {newExpiry.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' })}
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#D7FF00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Plan Overview Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#D7FF00] font-bold">
                    Current Plan
                  </span>
                  <h4 className="text-lg font-bold text-white font-heading">{plan.name}</h4>
                  <p className="text-xs text-slate-400">{plan.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black font-mono text-[#D7FF00]">
                    ₹{planPriceRupees}
                  </div>
                  <span className="text-[10px] text-slate-400">/{validityDays} days</span>
                </div>
              </div>

              {/* Cumulative Date Extension Preview */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase text-slate-500 font-mono block">Current Expiry</span>
                  <span className="text-slate-300 font-mono font-semibold">
                    {currentExpiry.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                  <span className="text-[9px] text-slate-500 block">
                    {isCurrentlyActive ? 'Active pass' : 'Expired'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40">
                  <span className="text-[10px] uppercase text-[#D7FF00] font-mono block font-bold">
                    New Expiry (+{validityDays}d)
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {newExpiry.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                  <span className="text-[9px] text-slate-400 block">Cumulative extension</span>
                </div>
              </div>
            </div>

            {/* Benefits Included */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-heading flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D7FF00]" /> Included Privileges
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Daily Free Sessions: {Math.round((plan.dailyUsageLimit || 60) / 60)} hr/day
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Advance Booking: {plan.advanceBookingLimit || 3} days ahead
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Station Coverage: {plan.discountPercentage || 100}% off
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Automatic Priority Check-in
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartRenewal}
                disabled={processing}
                className="flex-1 py-3 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-[#D7FF00]/10 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" /> Pay ₹{planPriceRupees} & Extend Pass
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
