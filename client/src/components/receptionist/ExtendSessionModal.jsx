import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { receptionistApi } from '../../api/receptionist.js';
import { Clock, Plus, IndianRupee, AlertTriangle, X, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';

export const ExtendSessionModal = ({ session, onClose, onSuccess }) => {
  const [extendedHours, setExtendedHours] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [collectPaymentNow, setCollectPaymentNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!session) return null;

  // Rate estimation (₹60/hr PS5 shared, ₹150/hr GTA 6 exclusive, ₹160/hr pool)
  const isExclusive = session.bookingType === 'PRIVATE' || session.game?.isExclusive;
  const isPool = session.device?.deviceType === 'POOL';
  const hourlyRateRupees = isExclusive ? 150 : isPool ? 160 : 60;
  const playersCount = isExclusive ? 1 : session.numberOfPlayers || 1;
  const estimatedAdditionalRupees = hourlyRateRupees * extendedHours * playersCount;

  // Calculate new end time display
  const currentEnd = new Date(session.endAt);
  const newEnd = new Date(currentEnd.getTime() + extendedHours * 3600 * 1000);
  const newEndTimeDisplay = newEnd.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const handleExtend = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const paymentAmountPaise = collectPaymentNow ? Math.round(estimatedAdditionalRupees * 100) : 0;

      const res = await receptionistApi.extendSession(session._id, {
        extendedDurationHours: extendedHours,
        paymentMethod,
        paymentAmountPaise,
        transactionReference: `Counter Extension (+${extendedHours}h)`,
        notes,
      });

      if (res?.success) {
        toast.success(`Session extended successfully by +${extendedHours}h!`);
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to extend session.');
      }
    } catch (err) {
      const msg = err.message || 'Error extending session';
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
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/15 border border-[#49202C] flex items-center justify-center text-[#D7FF00]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">Extend Gaming Session</h3>
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
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleExtend} className="mt-5 space-y-4">
          {/* Current & New End Times */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Current End</span>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">{session.endTime}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#D7FF00] font-bold">New End Time</span>
              <p className="text-sm font-bold text-[#FFF4E8] mt-0.5">{newEndTimeDisplay}</p>
            </div>
          </div>

          {/* Extension Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Additional Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0.5, 1, 1.5, 2].map((hrs) => (
                <button
                  type="button"
                  key={hrs}
                  onClick={() => setExtendedHours(hrs)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    extendedHours === hrs
                      ? 'bg-[#851B2B] text-[#FFF4E8] border-[#851B2B] shadow-md shadow-[#851B2B]/30'
                      : 'bg-[#171014] text-slate-300 border-[#49202C] hover:border-slate-700'
                  }`}
                >
                  +{hrs} Hour{hrs > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Calculated Additional Fee */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#851B2B]/20 to-[#260D17] border border-[#49202C] flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-300">Additional Extension Fee</span>
              <p className="text-[11px] text-slate-400">
                {isExclusive ? 'GTA 6 Exclusive Rate (₹150/hr)' : `Standard Rate (${playersCount} Player${playersCount > 1 ? 's' : ''})`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-white font-mono flex items-center justify-end">
                <IndianRupee className="w-4 h-4 text-[#D7FF00]" />
                {estimatedAdditionalRupees}
              </span>
            </div>
          </div>

          {/* Collect Payment Now Toggle */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-slate-300">Collect payment right now at desk</span>
              <input
                type="checkbox"
                checked={collectPaymentNow}
                onChange={(e) => setCollectPaymentNow(e.target.checked)}
                className="w-4 h-4 rounded text-[#D7FF00] bg-slate-800 border-slate-700 focus:ring-[#851B2B]"
              />
            </label>

            {collectPaymentNow && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-850 text-slate-400 border-slate-800'
                  }`}
                >
                  💵 Cash at Counter
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COUNTER_UPI')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    paymentMethod === 'COUNTER_UPI'
                      ? 'bg-[#851B2B]/25 text-[#FFF4E8] border-[#49202C]'
                      : 'bg-slate-850 text-slate-400 border-slate-800'
                  }`}
                >
                  📱 Counter QR / UPI
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Receptionist Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer requested extra time"
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] transition-all shadow-lg shadow-[#851B2B]/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extending...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Confirm Extension (+{extendedHours}h)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
