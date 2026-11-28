import React, { useState, useEffect } from 'react';
import { format12HourTime } from '../../utils/timeFormat.js';
import { toast } from 'react-hot-toast';
import { receptionistApi } from '../../api/receptionist.js';
import { equipmentApi } from '../../api/equipment.js';
import { CheckCircle2, IndianRupee, AlertCircle, X, Loader2, User, Tv, Gamepad2, CreditCard } from 'lucide-react';

export const CheckInModal = ({ booking, onClose, onSuccess }) => {
  const [collectBalance, setCollectBalance] = useState(booking?.balanceRemaining > 0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(booking?.game?._id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch active games catalogue for staff assignment
  useEffect(() => {
    if (booking?.device?.deviceType === 'PS5') {
      equipmentApi.getGames('status=ACTIVE').then((res) => {
        if (res?.success) {
          setGames(res.data.games || []);
        }
      }).catch(() => {});
    }
  }, [booking?.device?.deviceType]);

  if (!booking) return null;

  const balanceRemainingRupees = (booking.balanceRemaining || 0) / 100;
  const totalAmountRupees = (booking.totalAmount || 0) / 100;
  const advancePaidRupees = (booking.amountPaid || 0) / 100;

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const paymentCollection = collectBalance && booking.balanceRemaining > 0
        ? {
            amountPaise: booking.balanceRemaining,
            paymentMethod,
            transactionReference: transactionRef || 'Check-in counter',
          }
        : null;

      const res = await receptionistApi.checkInBooking(
        booking._id,
        paymentCollection,
        selectedGameId || null
      );

      if (res?.success) {
        toast.success(`Booking ${booking.bookingId} checked in successfully! Session is now ACTIVE.`);
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        throw new Error(res?.message || 'Check-in failed');
      }
    } catch (err) {
      const msg = err.message || 'Check-in failed';
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
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">Player Check-In</h3>
              <p className="text-xs text-slate-400">Reservation #{booking.bookingId}</p>
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

        <form onSubmit={handleCheckIn} className="mt-5 space-y-4">
          {/* Reservation Summary */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#D7FF00]" /> Customer:
              </span>
              <span className="font-semibold text-white">
                {booking.customer?.name} ({booking.customer?.phone})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-purple-400" /> Station & Game:
              </span>
              <span className="font-semibold text-white">
                {booking.device?.name} &bull; {booking.game?.name || booking.gameTitle || 'Select at Venue'}
              </span>
            </div>

            {booking.device?.deviceType === 'PS5' && games.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-[#D7FF00]" /> Front Desk Title Assignment:
                </label>
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:ring-1 focus:ring-[#851B2B] outline-none"
                >
                  <option value="">-- {booking.gameTitle || 'Select Title at Venue'} --</option>
                  {games.map((g) => {
                    const isExclusiveForbidden = booking.gameClassification === 'NON_EXCLUSIVE' && (g.isExclusive || /GTA/i.test(g.name));
                    return (
                      <option
                        key={g._id}
                        value={g._id}
                        disabled={isExclusiveForbidden}
                      >
                        {g.name} {g.isExclusive ? '(Exclusive)' : ''} {isExclusiveForbidden ? '• Exclusive Upgrade Required' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Slot & Duration:</span>
              <span className="font-semibold text-white">
                {booking.bookingDate} @ {format12HourTime(booking.startTime)} ({booking.duration} hr{booking.duration > 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-slate-400">Total / Advance Paid:</span>
              <span className="text-slate-300 font-mono">
                ₹{totalAmountRupees} / <span className="text-emerald-400 font-bold">₹{advancePaidRupees} Paid</span>
              </span>
            </div>
          </div>

          {/* Outstanding Balance Banner */}
          {balanceRemainingRupees > 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-300">Outstanding Balance Due</span>
                  <p className="text-[11px] text-amber-400/80">Collect remaining amount before or after session</p>
                </div>
                <span className="text-lg font-black text-amber-300 font-mono">
                  ₹{balanceRemainingRupees}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer pt-2 border-t border-amber-500/20">
                <input
                  type="checkbox"
                  checked={collectBalance}
                  onChange={(e) => setCollectBalance(e.target.checked)}
                  className="w-4 h-4 rounded text-[#D7FF00] bg-slate-800 border-slate-700 focus:ring-[#851B2B]"
                />
                <span>Collect ₹{balanceRemainingRupees} now at reception counter</span>
              </label>

              {collectBalance && (
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
                      💵 Cash
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
                      📱 Counter QR / UPI
                    </button>
                  </div>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Ref / Transaction Note (Optional)"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Full session fee is already paid in full. No outstanding balance.</span>
            </div>
          )}

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
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking In...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Check-In & Start Session
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
