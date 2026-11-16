import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { receptionistApi } from '../../api/receptionist.js';
import { CheckSquare, IndianRupee, AlertCircle, X, Loader2, Clock, Tv, User } from 'lucide-react';

export const CheckoutModal = ({ session, onClose, onSuccess }) => {
  const [collectRemaining, setCollectRemaining] = useState(session?.balanceRemainingPaise > 0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!session) return null;

  const balanceRupees = (session.balanceRemainingPaise || 0) / 100;
  const elapsedMins = session.elapsedMinutes || 0;

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const paymentCollection = collectRemaining && session.balanceRemainingPaise > 0
        ? {
            amountPaise: session.balanceRemainingPaise,
            paymentMethod,
            transactionReference: transactionRef || 'Checkout settlement',
          }
        : null;

      const res = await receptionistApi.completeSession(session._id, {
        paymentCollection,
        notes,
      });

      if (res?.success) {
        toast.success(`Session for ${session.device?.name} completed! Station is now AVAILABLE.`);
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        throw new Error(res?.message || 'Checkout failed');
      }
    } catch (err) {
      const msg = err.message || 'Checkout failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#260D17] border border-[#49202C] rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">Checkout & Free Console</h3>
              <p className="text-xs text-slate-400">
                {session.device?.name} &bull; Booking #{session.bookingId}
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

        <form onSubmit={handleCheckout} className="mt-5 space-y-4">
          {/* Active Session Info */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Customer</span>
              <p className="font-semibold text-white mt-0.5">{session.customer?.name}</p>
            </div>
            <div>
              <span className="text-slate-400">Station & Game</span>
              <p className="font-semibold text-white mt-0.5">
                {session.device?.name} &bull; {session.game?.name || 'Open Title'}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Scheduled Time</span>
              <p className="font-mono text-slate-300 mt-0.5">{session.startTime} - {session.endTime}</p>
            </div>
            <div>
              <span className="text-slate-400">Approx. Played Time</span>
              <p className="font-semibold text-[#D7FF00] mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {elapsedMins} mins
              </p>
            </div>
          </div>

          {/* Settle Balance Section */}
          {balanceRupees > 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-300">Final Outstanding Balance</span>
                  <p className="text-[11px] text-amber-400/80">Settle balance before releasing station</p>
                </div>
                <span className="text-lg font-black text-amber-300 font-mono">
                  ₹{balanceRupees}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer pt-2 border-t border-amber-500/20">
                <input
                  type="checkbox"
                  checked={collectRemaining}
                  onChange={(e) => setCollectRemaining(e.target.checked)}
                  className="w-4 h-4 rounded text-[#D7FF00] bg-slate-800 border-slate-700 focus:ring-[#851B2B]"
                />
                <span>Collect ₹{balanceRupees} settlement payment now</span>
              </label>

              {collectRemaining && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        paymentMethod === 'CASH'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      💵 Cash Settlement
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('COUNTER_UPI')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        paymentMethod === 'COUNTER_UPI'
                          ? 'bg-[#851B2B]/25 text-[#FFF4E8] border-[#49202C]'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      📱 UPI QR Code
                    </button>
                  </div>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Ref / Receipt Note"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              ✓ All fees for this session have been settled. No pending balance.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Checkout Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Session concluded smoothly, controller returned"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-300 hover:to-indigo-400 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Completing...
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5" /> End Session & Release Station
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
