import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { paymentApi } from '../../api/payment.js';
import { loadRazorpayScript, launchRazorpayCheckout } from '../../utils/razorpay.js';
import { showToast } from '../../utils/toast.js';
import {
  CreditCard,
  Smartphone,
  Building,
  ShieldCheck,
  Lock,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  FlaskConical,
} from 'lucide-react';

export const RazorpayModal = ({
  order,
  bookingDetails,
  onSuccess,
  onClose,
}) => {
  const [selectedMethod, setSelectedMethod] = useState('UPI'); // UPI, CARD, NETBANKING
  const [upiId, setUpiId] = useState('customer@okhdfcbank');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Pre-load official Razorpay checkout script on mount
    loadRazorpayScript().then((loaded) => setScriptLoaded(loaded));
  }, []);

  // Lock body scroll while modal is visible
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handlePay = async () => {
    setError('');
    setProcessing(true);
    setStatusMessage('Initiating secure checkout session...');

    try {
      const effectiveKey = (import.meta.env.VITE_RAZORPAY_KEY_ID || order?.keyId || '').trim();
      const isRealTestKey =
        effectiveKey &&
        (effectiveKey.startsWith('rzp_test_') || effectiveKey.startsWith('rzp_live_')) &&
        effectiveKey !== 'rzp_test_NOAH_SIMULATION';

      // 1. If official Razorpay checkout script is loaded and configured with real test key, launch official popup
      if (scriptLoaded && isRealTestKey && !order?.isMock) {
        setStatusMessage('Opening Razorpay Test Mode Checkout...');

        const opened = await launchRazorpayCheckout({
          order: { ...order, keyId: effectiveKey },
          prefill: {
            name: bookingDetails?.customerName || 'NOAH Gamer',
            email: bookingDetails?.customerEmail || 'customer@gaminglounge.com',
            phone: bookingDetails?.customerPhone || '',
          },
          description: `Booking ${bookingDetails?.bookingId || order.orderId} (${order.paymentPurpose || 'Full Payment'})`,
          onSuccess: async ({ orderId, paymentId, signature }) => {
            setStatusMessage('Verifying HMAC-SHA256 signature with NOAH backend...');
            const toastId = showToast.loading('Verifying payment signature with server...');
            try {
              const verifyRes = await paymentApi.verifyPayment({
                orderId,
                paymentId,
                signature,
              });

              showToast.dismiss(toastId);
              if (verifyRes.success) {
                showToast.success('Payment verified! Reservation confirmed.');
                onSuccess(verifyRes.data.payment, verifyRes.data.booking);
              } else {
                throw new Error(verifyRes.message || 'Signature verification rejected');
              }
            } catch (vErr) {
              showToast.dismiss(toastId);
              setError(vErr.message || 'Verification rejected by backend');
              showToast.error(vErr.message || 'Verification rejected by backend');
            } finally {
              setProcessing(false);
            }
          },
          onError: (err) => {
            setError(`Payment rejected: ${err?.description || 'Transaction declined'}`);
            setProcessing(false);
          },
          onDismiss: () => {
            setProcessing(false);
          },
        });

        if (opened) return;
      }

      // 2. Deterministic Sandbox Test Mode Flow (used before test keys are entered in .env or offline testing)
      setStatusMessage('Connecting to Razorpay Test Mode Sandbox...');
      await new Promise((r) => setTimeout(r, 600));

      setStatusMessage('Simulating test payment authorization...');
      await new Promise((r) => setTimeout(r, 500));

      setStatusMessage('Generating authentic HMAC-SHA256 signature...');
      const sigRes = await paymentApi.getTestSignature(order.orderId);
      if (!sigRes.success || !sigRes.data?.signature) {
        throw new Error('Failed to generate test gateway signature');
      }

      setStatusMessage('Verifying signature & confirming reservation...');
      const verifyRes = await paymentApi.verifyPayment({
        orderId: order.orderId,
        paymentId: sigRes.data.paymentId,
        signature: sigRes.data.signature,
      });

      if (verifyRes.success) {
        setStatusMessage('Payment verified! Confirming reservation...');
        showToast.success('Test payment verified! Reservation confirmed.');
        await new Promise((r) => setTimeout(r, 400));
        onSuccess(verifyRes.data.payment, verifyRes.data.booking);
      } else {
        throw new Error(verifyRes.message || 'Payment signature verification failed');
      }
    } catch (err) {
      setError(err.message || 'Payment processing failed');
      showToast.error(err.message || 'Payment failed');
      setProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md my-auto max-h-[92vh] overflow-y-auto bg-[#171014] border border-[#851B2B]/40 rounded-3xl shadow-2xl text-[#FFF4E8]">
        {/* Top Header */}
        <div className="p-5 bg-gradient-to-r from-[#260D17] via-[#171014] to-[#260D17] border-b border-[#49202C] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#851B2B]/20 text-[#D7FF00] border border-[#851B2B]/40 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-[#D7FF00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest uppercase text-white font-heading">
                  RAZORPAY
                </span>
                {/* Prominent Test Mode Pill */}
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#D7FF00]/15 text-[#D7FF00] font-mono font-bold border border-[#D7FF00]/40">
                  <FlaskConical className="w-2.5 h-2.5" />
                  TEST MODE
                </span>
              </div>
              <p className="text-[11px] text-[#C7A5A8]">NOAH GAMING Secure Gateway</p>
            </div>
          </div>

          {!processing && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Order Amount Banner */}
        <div className="p-4 bg-[#260D17]/60 border-b border-[#49202C] flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#C7A5A8] block font-mono">
              Payable Amount ({order.purpose || order.paymentPurpose || 'RESERVATION'})
            </span>
            <span className="text-2xl font-black font-heading text-white">
              ₹{order.amountInRupees || (order.amount ? order.amount / 100 : 0)}
            </span>
          </div>

          <div className="text-right text-[10px] font-mono text-[#C7A5A8]">
            <div>Order: {order.orderId?.slice(0, 16)}...</div>
            <div className="text-[#D7FF00] font-semibold">Test Sandbox • No Real Charge</div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {processing ? (
            <div className="py-10 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#D7FF00]" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">{statusMessage}</p>
                <p className="text-xs text-slate-400 font-mono">
                  Please do not refresh or close this browser window.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wider text-[#C7A5A8] font-bold block">
                  Select Test Payment Method
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('UPI')}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      selectedMethod === 'UPI'
                        ? 'bg-[#851B2B]/30 border-[#A51F35] text-[#FFF4E8] shadow-md shadow-[#851B2B]/20'
                        : 'bg-[#260D17]/40 border-[#49202C] text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-[#D7FF00]" />
                    <span className="text-xs font-bold font-mono">UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('CARD')}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      selectedMethod === 'CARD'
                        ? 'bg-[#851B2B]/30 border-[#A51F35] text-[#FFF4E8] shadow-md shadow-[#851B2B]/20'
                        : 'bg-[#260D17]/40 border-[#49202C] text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-[#D7FF00]" />
                    <span className="text-xs font-bold font-mono">Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('NETBANKING')}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      selectedMethod === 'NETBANKING'
                        ? 'bg-[#851B2B]/30 border-[#A51F35] text-[#FFF4E8] shadow-md shadow-[#851B2B]/20'
                        : 'bg-[#260D17]/40 border-[#49202C] text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    <Building className="w-5 h-5 text-[#D7FF00]" />
                    <span className="text-xs font-bold font-mono">Net Banking</span>
                  </button>
                </div>
              </div>

              {/* Method Details */}
              {selectedMethod === 'UPI' && (
                <div className="p-3.5 rounded-xl bg-[#260D17]/50 border border-[#49202C] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#C7A5A8]">
                    <span>Test UPI ID</span>
                    <span className="text-[10px] text-[#F5B942] font-mono">Google Pay • PhonePe • Paytm</span>
                  </div>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="player@upi"
                    className="w-full px-3 py-2 bg-[#171014] border border-[#49202C] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#851B2B]"
                  />
                  <p className="text-[10px] text-slate-400 font-mono">
                    Use any test UPI ID (e.g., success@razorpay) for instant simulation.
                  </p>
                </div>
              )}

              {selectedMethod === 'CARD' && (
                <div className="p-3.5 rounded-xl bg-[#260D17]/50 border border-[#49202C] space-y-2 text-xs font-mono">
                  <div className="text-[#C7A5A8] flex justify-between">
                    <span>Razorpay Test Card</span>
                    <span className="text-[#F5B942]">Visa • Mastercard • RuPay</span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value="4111 1111 1111 1111"
                    className="w-full px-3 py-2 bg-[#171014] border border-[#49202C] rounded-lg text-slate-300 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      readOnly
                      value="12/28"
                      className="px-3 py-1.5 bg-[#171014] border border-[#49202C] rounded-lg text-slate-300 text-xs text-center"
                    />
                    <input
                      type="password"
                      readOnly
                      value="123"
                      className="px-3 py-1.5 bg-[#171014] border border-[#49202C] rounded-lg text-slate-300 text-xs text-center"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Standard Razorpay Test Card prefilled. OTP for test card is any 6-digit number.
                  </p>
                </div>
              )}

              {selectedMethod === 'NETBANKING' && (
                <div className="p-3.5 rounded-xl bg-[#260D17]/50 border border-[#49202C] space-y-2 text-xs">
                  <span className="text-[#C7A5A8] block">Simulated Banks</span>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="p-2 rounded bg-[#171014] border border-[#851B2B]/60 text-[#FFF4E8] text-center font-bold">
                      HDFC Bank
                    </div>
                    <div className="p-2 rounded bg-[#171014] border border-[#49202C] text-slate-300 text-center">
                      State Bank of India
                    </div>
                    <div className="p-2 rounded bg-[#171014] border border-[#49202C] text-slate-300 text-center">
                      ICICI Bank
                    </div>
                    <div className="p-2 rounded bg-[#171014] border border-[#49202C] text-slate-300 text-center">
                      Axis Bank
                    </div>
                  </div>
                </div>
              )}

              {/* Pay Now Button */}
              <button
                type="button"
                onClick={handlePay}
                disabled={processing}
                className="w-full py-3.5 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-black font-heading text-sm uppercase tracking-wider shadow-lg shadow-[#851B2B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Lock className="w-4 h-4 text-white" />
                <span className="text-white">Pay ₹{order.amountInRupees || (order.amount ? order.amount / 100 : 0)} (Test Mode)</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D7FF00]" />
                <span>256-bit TLS Encryption • Official Razorpay Test Integration</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
