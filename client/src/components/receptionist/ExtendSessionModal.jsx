import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { receptionistApi } from '../../api/receptionist.js';
import {
  Clock,
  Plus,
  IndianRupee,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Tv,
  Gamepad2,
  Users,
  Sparkles,
} from 'lucide-react';

export const ExtendSessionModal = ({ session, onClose, onSuccess }) => {
  const [extendedHours, setExtendedHours] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [collectPaymentNow, setCollectPaymentNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [useMembershipFreeHours, setUseMembershipFreeHours] = useState(false);

  // Dynamic preview state from server
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  if (!session) return null;

  // Fallback calculations in case preview is pending
  const isExclusive = session.isGTA6 || session.game?.isExclusive || session.isExclusiveGame;
  const isPool = session.device?.deviceType === 'POOL';
  const defaultRate = isExclusive ? 150 : isPool ? 150 : 70;
  const playersCount = isPool ? 1 : session.numberOfPlayers || 1;
  const fallbackAdditionalRupees = defaultRate * extendedHours * playersCount;

  // Fetch authoritative preview from server
  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      setError('');
      try {
        const res = await receptionistApi.previewExtension(
          session._id,
          extendedHours,
          useMembershipFreeHours
        );
        if (isMounted && res?.success && res.data) {
          setPreview(res.data);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Preview extension error:', err.message);
        }
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [session._id, extendedHours, useMembershipFreeHours]);

  const activeFeeRupees = preview ? preview.additionalAmountRupees : fallbackAdditionalRupees;
  const currentEndDisplay = session.endTime || (session.endAt ? new Date(session.endAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--');
  const newEndTimeDisplay = preview?.newEndTime || (() => {
    const currentEnd = new Date(session.endAt || new Date());
    const newEnd = new Date(currentEnd.getTime() + extendedHours * 3600 * 1000);
    return newEnd.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  })();

  const handleExtend = async (e) => {
    e.preventDefault();
    if (preview && !preview.canExtend) {
      toast.error(preview.warning || 'Cannot extend session at this time.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const paymentAmountPaise = collectPaymentNow ? Math.round(activeFeeRupees * 100) : 0;

      const res = await receptionistApi.extendSession(session._id, {
        extendedDurationHours: extendedHours,
        paymentMethod,
        paymentAmountPaise,
        transactionReference: `Counter Extension (+${extendedHours}h)`,
        notes,
        useMembershipFreeHours: Boolean(useMembershipFreeHours),
      });

      if (res?.success) {
        toast.success(`Session extended successfully by +${extendedHours}h!`);
        try {
          localStorage.setItem('noah_session_sync', Date.now().toString());
          window.dispatchEvent(new Event('session_updated'));
        } catch {}
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

  const gameTitle = preview?.gameName || session.gameName || (session.isVenueSelection ? 'Select Game at Venue' : session.game?.name || session.gameTitle || 'Game Not Selected');
  const bookingMode = preview?.bookingModeDisplay || (session.bookingType === 'PRIVATE' ? 'Private Session' : 'Shared Session');
  const billablePlayers = preview?.billableUnits ?? (isPool ? 1 : session.numberOfPlayers || 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#260D17] border border-[#49202C] rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 border border-[#851B2B] flex items-center justify-center text-[#D7FF00]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">Extend Gaming Session</h3>
              <p className="text-xs text-slate-400">
                {session.device?.name || preview?.deviceName} &bull; Booking #{session.bookingId}
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

        {/* Warning / Conflict Alert from Server Preview */}
        {preview?.warning && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
              preview.canExtend
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold'
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{preview.warning}</span>
          </div>
        )}

        <form onSubmit={handleExtend} className="mt-4 space-y-4">
          {/* Active Session Info Pills */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Game</span>
              <span className="font-semibold text-white truncate block mt-0.5" title={gameTitle}>
                {gameTitle}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Mode</span>
              <span className="font-semibold text-[#D7FF00] block mt-0.5">
                {bookingMode}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Billable Players</span>
              <span className="font-semibold text-slate-200 block mt-0.5">
                {billablePlayers} {billablePlayers > 1 ? 'Players' : 'Player/Table'}
              </span>
            </div>
          </div>

          {/* Current & New End Times */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Current End Time</span>
              <p className="text-sm font-semibold text-slate-200 mt-0.5 font-mono">{currentEndDisplay}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#D7FF00] font-bold">New End Time</span>
              <p className="text-sm font-bold text-[#FFF4E8] mt-0.5 font-mono flex items-center gap-1.5">
                {previewLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D7FF00]" />
                ) : (
                  newEndTimeDisplay
                )}
              </p>
            </div>
          </div>

          {/* Customer Membership & Daily Free-Hour Quota Visibility */}
          {preview?.quota?.isMember && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {preview.quota.planName}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                  {preview.quota.isExpired ? 'EXPIRED' : 'ACTIVE MEMBER'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-amber-500/20 text-[11px] font-mono text-center">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Daily Limit</span>
                  <span className="text-white font-bold">{preview.quota.dailyAllowanceHours}h</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Used Today</span>
                  <span className="text-slate-300 font-bold">{preview.quota.usedTodayHours}h</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Remaining</span>
                  <span className={`font-bold ${preview.quota.remainingHours > 0 ? 'text-[#D7FF00]' : 'text-slate-400'}`}>
                    {preview.quota.remainingHours}h free
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Explicit Quota & Payment Method Choice (Option A vs Option B) */}
          {preview?.quota?.isEligibleForFreeHours && preview?.quota?.remainingHours > 0 && !isExclusive ? (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-200 block">
                Membership Free-Hour Benefit
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUseMembershipFreeHours(false)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    !useMembershipFreeHours
                      ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-300">
                    💵 Option A: Pay Cash / UPI
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    0 free hours deducted. Keep customer's {preview.quota.remainingHours}h quota untouched.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setUseMembershipFreeHours(true)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    useMembershipFreeHours
                      ? 'bg-[#851B2B]/35 border-[#D7FF00]/60 text-[#FFF4E8] shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-[#D7FF00]">
                    ★ Option B: Use Free Hours
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1">
                    Apply up to {preview.quota.remainingHours}h free quota. Charge balance if needed.
                  </p>
                </button>
              </div>
            </div>
          ) : preview?.quota?.isMember && preview?.quota?.remainingHours <= 0 ? (
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
              Customer has 0 membership free hours remaining today. Standard counter extension rates apply.
            </div>
          ) : null}

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
                  +{hrs} {hrs === 1 ? 'Hour' : 'Hours'}
                </button>
              ))}
            </div>
          </div>

          {/* Calculated Additional Fee & Dynamic Breakdown */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#851B2B]/25 to-[#260D17] border border-[#49202C]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200">Additional Extension Fee</span>
                <p className="text-[11px] text-[#C7A5A8] mt-0.5">
                  {preview?.calculationFormula ? (
                    <span className="font-mono text-[11px] text-[#D7FF00]">
                      {preview.calculationFormula}
                    </span>
                  ) : (
                    <span>
                      Dynamic Rate &bull; {extendedHours}h for {billablePlayers} player{billablePlayers > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-white font-mono flex items-center justify-end">
                  <IndianRupee className="w-4 h-4 text-[#D7FF00]" />
                  {previewLoading ? '...' : activeFeeRupees}
                </span>
                {preview?.hourlyRateRupees && (
                  <span className="text-[10px] text-slate-400 font-mono block">
                    @ ₹{preview.hourlyRateRupees}/hr
                  </span>
                )}
              </div>
            </div>

            {preview?.membershipApplied && (
              <div className="mt-2 pt-2 border-t border-[#49202C]/60 flex items-center justify-between text-[11px] text-emerald-400">
                <span>★ Membership Benefit Applied</span>
                <span className="font-mono font-bold">-₹{preview.membershipDiscountRupees}</span>
              </div>
            )}
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

            {collectPaymentNow ? (
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
            ) : (
              <p className="mt-2 text-[11px] text-amber-400">
                Fee will be added to the customer's balance due upon checkout.
              </p>
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
              disabled={submitting || (preview && !preview.canExtend)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-[#D7FF00] hover:bg-[#c8ee00] transition-all shadow-lg shadow-[#851B2B]/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
