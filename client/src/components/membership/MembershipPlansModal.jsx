import React, { useState, useEffect } from 'react';
import { membershipApi } from '../../api/membership.js';
import { paymentApi } from '../../api/payment.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { MembershipUpgradeModal } from './MembershipUpgradeModal.jsx';
import { showToast } from '../../utils/toast.js';
import { launchRazorpayCheckout } from '../../utils/razorpay.js';
import {
  Crown,
  Check,
  X,
  Sparkles,
  Zap,
  Flame,
  Clock,
  Tv,
  Users,
  ShieldCheck,
  CreditCard,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export const MembershipPlansModal = ({ onClose, onPurchaseSuccess, initialPlanId }) => {
  const { user, isAuthenticated, openLoginModal, refreshUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      try {
        const res = await membershipApi.getPlans();
        if (res.success && res.data?.plans) {
          setPlans(res.data.plans);
          if (initialPlanId) {
            const matched = res.data.plans.find(
              (p) => String(p._id) === String(initialPlanId) || String(p.id) === String(initialPlanId)
            );
            if (matched) setSelectedPlan(matched);
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch membership plans');
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [initialPlanId]);

  useEffect(() => {
    if (initialPlanId && plans.length > 0) {
      const matched = plans.find(
        (p) => String(p._id) === String(initialPlanId) || String(p.id) === String(initialPlanId)
      );
      if (matched) setSelectedPlan(matched);
    }
  }, [initialPlanId, plans]);

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setError('');
  };

  const handleStartPurchase = async (plan) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    // If customer already has an active pass and this is a higher tier, prompt upgrade!
    if (user?.membership?.status === 'ACTIVE' && plan.price > (user.membership.planPrice || 0)) {
      setSelectedPlan(plan);
      setUpgradeModalOpen(true);
      return;
    }

    setError('');
    setProcessing(true);
    try {
      const res = await membershipApi.purchaseMembership({ planId: plan._id });
      if (res.success && res.data) {
        setOrderData(res.data);
        setCheckoutModalOpen(true);
      } else {
        throw new Error(res.message || 'Failed to initiate purchase');
      }
    } catch (err) {
      setError(err.message || 'Unable to initiate membership order');
      showToast.error(err.message || 'Unable to initiate membership order');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!orderData) return;
    setProcessing(true);
    setError('');

    const isRealTestKey =
      orderData.keyId &&
      orderData.keyId.startsWith('rzp_test_') &&
      orderData.keyId !== 'rzp_test_NOAH_SIMULATION';

    if (isRealTestKey) {
      const opened = await launchRazorpayCheckout({
        order: orderData,
        prefill: {
          name: user?.name || 'NOAH Gamer',
          email: user?.email || '',
          phone: user?.phone || '',
        },
        description: `Membership: ${selectedPlan?.name || orderData.plan?.name}`,
        onSuccess: async ({ orderId, paymentId, signature }) => {
          const toastId = showToast.loading('Verifying membership payment with server...');
          try {
            const verifyRes = await membershipApi.verifyMembership({
              orderId,
              paymentId,
              signature,
              planId: selectedPlan?._id || orderData.plan?.id,
            });
            showToast.dismiss(toastId);
            if (verifyRes.success) {
              showToast.success(`Membership Activated! Welcome to ${selectedPlan?.name || 'NOAH GAMING Membership'}.`);
              setCheckoutModalOpen(false);
              if (refreshUser) await refreshUser();
              if (onPurchaseSuccess) onPurchaseSuccess(verifyRes.data.subscription);
            } else {
              throw new Error(verifyRes.message || 'Signature verification rejected');
            }
          } catch (vErr) {
            showToast.dismiss(toastId);
            setError(vErr.message || 'Verification rejected');
            showToast.error(vErr.message || 'Verification rejected');
          } finally {
            setProcessing(false);
          }
        },
        onError: (err) => {
          setError(err?.description || 'Payment rejected');
          setProcessing(false);
        },
        onDismiss: () => {
          setProcessing(false);
        },
      });

      if (opened) return;
    }

    // Fallback simulation for local sandbox tests
    const toastId = showToast.loading('Processing test membership activation...');
    try {
      // Obtain test signature or launch Razorpay SDK
      const sigRes = await paymentApi.getTestSignature(orderData.orderId);
      if (!sigRes.success || !sigRes.data?.signature) {
        throw new Error('Failed to generate secure checkout signature');
      }

      const verifyRes = await membershipApi.verifyMembership({
        orderId: orderData.orderId,
        paymentId: sigRes.data.paymentId,
        signature: sigRes.data.signature,
        planId: selectedPlan?._id || orderData.plan?.id,
      });

      showToast.dismiss(toastId);

      if (verifyRes.success) {
        showToast.success(`Membership Activated! Welcome to ${selectedPlan?.name || 'NOAH GAMING Membership'}.`);
        setCheckoutModalOpen(false);
        if (refreshUser) await refreshUser();
        if (onPurchaseSuccess) onPurchaseSuccess(verifyRes.data.subscription);
      } else {
        throw new Error(verifyRes.message || 'Payment signature verification failed');
      }
    } catch (err) {
      showToast.dismiss(toastId);
      setError(err.message || 'Payment processing failed');
      showToast.error(err.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 md:left-64 z-40 flex items-center justify-center p-3 sm:p-4 md:p-6 pb-28 md:pb-6 bg-black/50 dark:bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div id="membership-plans-modal" className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] rounded-2xl sm:rounded-3xl shadow-2xl text-slate-900 dark:text-[#FFF4E8] m-auto overflow-hidden">
        {/* Header */}
        <div id="membership-plans-header" className="p-4 sm:p-6 bg-slate-50 dark:bg-gradient-to-r dark:from-[#260D17] dark:via-[#171014] dark:to-[#260D17] border-b border-slate-200 dark:border-[#49202C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#851B2B] to-[#A51F35] text-white flex items-center justify-center font-bold shadow-lg shadow-[#851B2B]/20">
              <Crown className="w-5 h-5 text-[#D7FF00]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#851B2B] dark:text-[#F5B942] font-bold">
                NOAH Club Passes
              </span>
              <h2 className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white">
                MONTHLY MEMBERSHIP PLANS
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {user?.membership?.status === 'ACTIVE' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white block text-sm">Active Membership Detected</span>
                  <span className="text-slate-400">Want to upgrade to a higher tier? Unused days will be credited against the new plan price!</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-heading uppercase text-xs tracking-wider shrink-0 shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <TrendingUp className="w-4 h-4" /> Upgrade with Credit
              </button>
            </div>
          )}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#D7FF00]" />
              <p className="text-xs font-mono">Loading active lounge memberships...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isSelected = selectedPlan?._id === plan._id;
                const isVIP = plan.includesExclusiveGames;
                const isUnlim = plan.isUnlimited;

                return (
                  <div
                    key={plan._id}
                    onClick={() => handleSelectPlan(plan)}
                    className={`membership-plan-card p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                      isVIP
                        ? 'bg-gradient-to-b from-amber-50 to-orange-50/50 dark:from-[#851B2B]/30 dark:via-[#260D17] dark:to-[#171014] border-amber-300 dark:border-[#851B2B] hover:border-amber-500 dark:hover:border-[#A51F35] shadow-md shadow-amber-500/10 dark:shadow-[#851B2B]/20'
                        : isUnlim
                        ? 'bg-white dark:bg-gradient-to-b dark:from-[#851B2B]/20 dark:via-[#260D17] dark:to-[#171014] border-slate-200 dark:border-[#851B2B]/40 hover:border-[#851B2B] shadow-sm shadow-slate-900/5 dark:shadow-[#851B2B]/10'
                        : 'bg-white dark:bg-[#260D17]/50 border-slate-200 dark:border-[#49202C] hover:border-[#851B2B]'
                    } ${isSelected ? 'ring-2 ring-[#851B2B] dark:ring-[#D7FF00] border-[#851B2B] dark:border-[#D7FF00]' : ''}`}
                  >
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isVIP
                            ? 'bg-amber-100 dark:bg-[#851B2B]/30 text-amber-900 dark:text-[#FFF4E8] border border-amber-300 dark:border-[#851B2B]'
                            : isUnlim
                            ? 'bg-[#851B2B]/10 dark:bg-[#851B2B]/20 text-[#851B2B] dark:text-[#D7FF00] border border-[#851B2B]/20 dark:border-[#851B2B]/40'
                            : 'bg-slate-100 dark:bg-[#171014] text-slate-700 dark:text-[#C7A5A8] border border-slate-200 dark:border-[#49202C]'
                        }`}
                      >
                        {isVIP ? 'GTA 6 INCLUDED' : isUnlim ? 'UNLIMITED PASS' : 'STANDARD'}
                      </span>

                      {plan.isUnlimited && (
                        <Zap className="w-4 h-4 text-[#851B2B] dark:text-[#D7FF00]" />
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{plan.description}</p>

                      {/* Pricing */}
                      <div className="pt-2">
                        <span className="text-2xl font-black font-heading text-slate-900 dark:text-white">
                          ₹{plan.price / 100}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          /{plan.validityDuration} {plan.validityUnit?.toLowerCase()}
                        </span>
                      </div>

                      {/* Feature Bullet points */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2 text-xs text-slate-700 dark:text-slate-300 font-mono">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {plan.dailyUsageLimit
                              ? `${plan.dailyUsageLimit / 60}h Daily Gaming Allowance`
                              : 'Unlimited Daily Hours'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {plan.maximumBookingsPerDay} Booking(s) Per Day
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {plan.advanceBookingLimit} Days Advance Booking
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>PS5 Consoles & Pool Table</span>
                        </div>

                        {plan.includesExclusiveGames ? (
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold">
                            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>GTA 6 Exclusive Sessions</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-[11px]">
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span>GTA 6 requires separate booking</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan);
                          handleStartPurchase(plan);
                        }}
                        disabled={processing}
                        className="w-full py-2.5 rounded-xl font-bold font-heading text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white shadow-md shadow-[#851B2B]/20"
                      >
                        {processing && selectedPlan?._id === plan._id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <span className="text-white">Get Membership</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Checkout Modal */}
        {checkoutModalOpen && orderData && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#171014] border border-[#49202C] rounded-3xl p-6 shadow-2xl text-[#FFF4E8] space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-[#49202C]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#D7FF00]" />
                  <h3 className="text-base font-bold font-heading text-white">
                    Razorpay Checkout
                  </h3>
                </div>
                <button
                  onClick={() => setCheckoutModalOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#260D17]/60 border border-[#49202C] space-y-2 text-xs font-mono">
                <div className="flex justify-between text-[#C7A5A8]">
                  <span>Selected Pass:</span>
                  <span className="font-bold text-white font-sans">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-[#C7A5A8]">
                  <span>Validity Duration:</span>
                  <span className="text-[#D7FF00] font-bold">
                    {selectedPlan.validityDuration} {selectedPlan.validityUnit}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Order Reference:</span>
                  <span className="text-slate-300">{orderData.orderId}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-slate-800 font-sans">
                  <span>Total Payable:</span>
                  <span className="text-emerald-400 font-mono">₹{orderData.amountInRupees}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 font-sans">
                Pay online using any UPI application (GPay, PhonePe, Paytm), Debit/Credit Card, or Net Banking. Membership activates immediately upon signature verification.
              </p>

              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={processing}
                className="w-full py-3.5 rounded-xl bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white font-bold font-heading text-xs uppercase tracking-wider shadow-lg shadow-[#851B2B]/25 transition-all flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying Payment...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Pay ₹{orderData.amountInRupees} & Activate Pass
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Membership Upgrade Modal (Phase 5.1) */}
        {upgradeModalOpen && (
          <MembershipUpgradeModal
            onClose={() => setUpgradeModalOpen(false)}
            onUpgradeSuccess={() => {
              setUpgradeModalOpen(false);
              if (onClose) onClose();
            }}
          />
        )}
      </div>
    </div>
  );
};
