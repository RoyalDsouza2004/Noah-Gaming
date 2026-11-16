import React, { useState, useEffect } from 'react';
import { membershipApi } from '../../api/membership.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showToast } from '../../utils/toast.js';
import {
  Crown,
  Check,
  X,
  ArrowLeft,
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
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const MembershipUpgradeModal = ({ onClose, onUpgradeSuccess }) => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eligiblePlans, setEligiblePlans] = useState([]);
  const [currentPlanInfo, setCurrentPlanInfo] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

  // Fetch upgrade eligibility
  const fetchEligibleUpgrades = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await membershipApi.getEligibleUpgrades();
      if (res.success && res.data) {
        setCurrentPlanInfo(res.data.currentPlan);
        setEligiblePlans(res.data.eligiblePlans || []);
        if (res.data.eligiblePlans?.length > 0) {
          handleSelectPlan(res.data.eligiblePlans[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load eligible upgrade plans.');
      showToast.error(err.message || 'Failed to load eligible upgrades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibleUpgrades();
  }, []);

  // Fetch quote when user picks a plan
  const handleSelectPlan = async (plan) => {
    setSelectedPlan(plan);
    setQuoteLoading(true);
    try {
      const res = await membershipApi.getUpgradeQuote(plan._id);
      if (res.success && res.data) {
        setQuote(res.data);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to calculate upgrade quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  // Execute upgrade checkout
  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;
    setUpgrading(true);

    try {
      const res = await membershipApi.initiateUpgrade({ targetPlanId: selectedPlan._id });
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to initiate upgrade order');
      }

      // If zero amount payable, it completed directly
      if (res.data.order?.amount === 0 || res.data.quote?.financials?.finalAmountPayablePaise === 0) {
        showToast.success('Membership upgraded successfully with your available credit!');
        if (refreshUser) await refreshUser();
        if (onUpgradeSuccess) onUpgradeSuccess();
        if (onClose) onClose();
        return;
      }

      const { order, upgrade } = res.data;

      // Razorpay Checkout
      if (typeof window.Razorpay === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
        });
      }

      const options = {
        key: (import.meta.env.VITE_RAZORPAY_KEY_ID || order.keyId || 'rzp_test_NoahGamingSimKey').trim(),
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'NOAH GAMING',
        description: `Upgrade to ${selectedPlan.name}`,
        order_id: order.id,
        handler: async function (response) {
          const toastId = showToast.loading('Verifying upgrade payment with server...');
          try {
            const verifyRes = await membershipApi.verifyUpgrade({
              upgradeTransactionId: upgrade.upgradeTransactionId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });

            showToast.dismiss(toastId);

            if (verifyRes.success) {
              showToast.success('Membership upgraded successfully!');
              if (refreshUser) await refreshUser();
              if (onUpgradeSuccess) onUpgradeSuccess();
              if (onClose) onClose();
            } else {
              showToast.error(verifyRes.message || 'Payment verification failed');
            }
          } catch (vErr) {
            showToast.dismiss(toastId);
            showToast.error(vErr.message || 'Payment signature verification failed');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#851B2B',
        },
        modal: {
          ondismiss: function () {
            setUpgrading(false);
            showToast.error('Upgrade checkout cancelled. Your existing membership remains active.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        showToast.error(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
        setUpgrading(false);
      });
      rzp.open();
    } catch (err) {
      showToast.error(err.message || 'Upgrade failed');
      setUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#171014] border border-[#49202C] rounded-2xl sm:rounded-3xl shadow-2xl text-[#FFF4E8] m-auto overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-4 border-b border-[#49202C] bg-[#260D17]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#851B2B]/20 text-[#D7FF00] border border-[#851B2B]/40">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-bold font-heading text-white">
                  UPGRADE MEMBERSHIP PASS
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#851B2B]/30 text-[#FFF4E8] border border-[#851B2B] uppercase tracking-wider">
                  Prorated Credit
                </span>
              </div>
              <p className="text-xs text-[#C7A5A8] mt-0.5">
                Switch to a higher gaming tier. Your unused membership days are automatically credited!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D7FF00]" />
              <p className="text-sm font-semibold">Calculating eligible upgrade tiers & credit...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-center space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          ) : eligiblePlans.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Crown className="w-10 h-10 mx-auto text-[#F5B942]" />
              <h3 className="text-base font-bold text-white font-heading">
                You Are On Our Highest Tier!
              </h3>
              <p className="text-xs text-[#C7A5A8] max-w-md mx-auto leading-relaxed">
                You already hold the ultimate membership level available. No higher tier upgrades exist.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-5 py-2.5 bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold font-heading text-xs uppercase tracking-wider rounded-xl"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Current Active Plan Status Bar */}
              {currentPlanInfo && (
                <div className="p-4 rounded-2xl bg-[#260D17]/80 border border-[#49202C] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#C7A5A8] tracking-wider">
                      Current Active Plan
                    </span>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <Crown className="w-4 h-4 text-[#F5B942]" />
                      {currentPlanInfo.name}
                      <span className="font-mono text-[#D7FF00] font-normal">
                        (₹{currentPlanInfo.price / 100}/mo)
                      </span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px]">
                    <div>
                      Expires:{' '}
                      <span className="text-white font-semibold">
                        {new Date(currentPlanInfo.expirationDate).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <div>
                      Remaining:{' '}
                      <span className="text-emerald-400 font-bold">
                        {quote?.financials?.remainingEligibleDays ?? '—'} days
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Select New Upgrade Tier */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7A5A8] mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D7FF00]" />
                  Select Target Tier to Upgrade
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eligiblePlans.map((plan) => {
                    const isSelected = selectedPlan?._id === plan._id;
                    const isVip = plan.includesExclusiveGames;
                    return (
                      <div
                        key={plan._id}
                        onClick={() => handleSelectPlan(plan)}
                        className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#851B2B]/40 to-[#260D17] border-[#851B2B] shadow-xl shadow-[#851B2B]/20'
                            : 'bg-[#260D17]/50 border-[#49202C] hover:border-[#851B2B]'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-800 text-slate-300">
                              {plan.validityDuration} {plan.validityUnit}
                            </span>
                            {isVip && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <Flame className="w-3 h-3" /> VIP GTA 6
                              </span>
                            )}
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-white font-heading">{plan.name}</h4>
                            <p className="text-xs text-[#C7A5A8] mt-1 line-clamp-2">{plan.description}</p>
                          </div>

                          <div className="pt-2 text-xs text-slate-300 space-y-1">
                            <div>
                              Daily Quota:{' '}
                              <strong className="text-[#D7FF00]">
                                {plan.dailyUsageLimit / 60}h / day
                              </strong>
                            </div>
                            <div>
                              Max Session: <strong>{plan.maximumSessionDuration / 60}h continuous</strong>
                            </div>
                            <div className="text-[11px] text-[#C7A5A8]">
                              {isVip ? '✓ Full GTA 6 Console Locks' : '✓ PS5 & Pool Table sessions'}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#49202C] flex items-center justify-between">
                          <span className="text-lg font-black font-heading text-white">
                            ₹{plan.price / 100}
                            <span className="text-xs font-normal text-slate-400 font-sans"> / mo</span>
                          </span>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                              isSelected
                                ? 'bg-[#D7FF00] text-[#171014]'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Choose'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Financial Proration Breakdown Card (Section 3 Requirement) */}
              {quote && selectedPlan && (
                <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] shadow-xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 border-b border-[#49202C]">
                    <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#D7FF00]" />
                      Prorated Upgrade Breakdown
                    </h3>
                    <span className="text-[10px] font-mono text-[#C7A5A8]">
                      Formula: Credit = Old Price × (Remaining Days / Total Days)
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[#49202C]/60">
                      <span className="text-[#C7A5A8]">
                        Current Plan: <strong>{quote.currentSubscription.planName}</strong>
                      </span>
                      <span className="font-mono text-slate-300">
                        ₹{quote.financials.originalAmountRupees.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#49202C]/60 text-[#C7A5A8] text-[11px]">
                      <span>
                        Validity Days Consumed & Remaining:
                      </span>
                      <span className="font-mono text-slate-300">
                        {quote.financials.remainingEligibleDays} days left out of{' '}
                        {quote.financials.totalValidityDays} days
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#49202C]/60">
                      <span className="text-[#C7A5A8]">
                        New Plan: <strong>{quote.targetPlan.name}</strong>
                      </span>
                      <span className="font-mono text-white font-bold">
                        ₹{quote.financials.newPlanPriceRupees.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#49202C]/60 text-emerald-400">
                      <span className="font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Unused Membership Credit (Deducted):
                      </span>
                      <span className="font-mono font-bold text-sm">
                        -₹{quote.financials.unusedCreditRupees.toFixed(2)}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-base">
                      <span className="font-bold font-heading text-white">
                        Final Amount Payable:
                      </span>
                      <span className="text-2xl font-black font-heading text-[#D7FF00] font-mono">
                        ₹{quote.financials.finalAmountPayableRupees.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 pt-3 border-t border-[#49202C] bg-[#260D17] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700"
          >
            Cancel
          </button>

          {selectedPlan && quote && (
            <button
              type="button"
              onClick={handleConfirmUpgrade}
              disabled={upgrading || quoteLoading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black font-heading text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {upgrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Processing Upgrade...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-950" />
                  <span>
                    Pay ₹{quote.financials.finalAmountPayableRupees.toFixed(2)} & Complete Upgrade
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
