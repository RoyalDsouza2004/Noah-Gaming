import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { receptionistApi } from '../../api/receptionist.js';
import { Banknote, IndianRupee, CreditCard, X, Loader2, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export const CollectPaymentModal = ({ booking, onClose, onSuccess, onViewReceipt }) => {
  const defaultAmountRupees = booking ? Math.max(0, (booking.balanceRemaining || 0) / 100) : 0;
  const [amountRupees, setAmountRupees] = useState(defaultAmountRupees);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Lock body scroll while modal is visible
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!booking) return null;

  const totalPaise = booking.totalAmount || 0;
  const balancePaise = booking.balanceRemaining || 0;

  const handleCollect = async (e) => {
    e.preventDefault();
    setError('');

    const numAmount = Number(amountRupees);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    const amountPaise = Math.round(numAmount * 100);
    if (amountPaise > balancePaise) {
      setError(`Amount cannot exceed the remaining balance of ₹${balancePaise / 100}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.collectOfflinePayment({
        bookingId: booking._id,
        amountPaise,
        paymentMethod,
        transactionReference: transactionRef || 'Reception Counter Payment',
        notes,
      });

      if (res?.success) {
        toast.success(`Collected ₹${numAmount} successfully! Receipt generated.`);
        if (onSuccess) onSuccess(res.data);
        if (onViewReceipt && res.data?.payment?.paymentId) {
          onViewReceipt(res.data.payment.paymentId);
        }
        onClose();
      } else {
        throw new Error(res?.message || 'Payment collection failed');
      }
    } catch (err) {
      const msg = err.message || 'Payment collection failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] overflow-y-auto bg-[#260D17] border border-[#49202C] rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">Collect Counter Payment</h3>
              <p className="text-xs text-slate-400">
                Booking #{booking.bookingId} &bull; {booking.customer?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCollect} className="mt-5 space-y-4">
          {/* Due Info */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Total / Paid</span>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">
                ₹{totalPaise / 100} / <span className="text-emerald-400">₹{(booking.amountPaid || 0) / 100}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-amber-400 font-semibold">Remaining Due</span>
              <p className="text-lg font-black text-amber-300 font-mono mt-0.5">
                ₹{balancePaise / 100}
              </p>
            </div>
          </div>

          {/* Amount to Collect */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Payment Amount to Collect (₹)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-[#D7FF00]" />
              <input
                type="number"
                min={1}
                max={balancePaise / 100}
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold text-white font-mono focus:outline-none focus:border-[#851B2B]"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" /> Cash (Counter)
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('COUNTER_UPI')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'COUNTER_UPI'
                    ? 'bg-[#851B2B]/25 text-[#FFF4E8] border-[#49202C] shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> UPI QR / POS
              </button>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Transaction / Reference ID (Optional)
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. UPI Ref / Cash memo"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Record & Generate Receipt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
