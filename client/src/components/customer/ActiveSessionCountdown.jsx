import React, { useState, useEffect } from 'react';
import { sessionsApi } from '../../api/sessions.js';
import { format12HourTime, format12HourRange } from '../../utils/timeFormat.js';
import {
  Gamepad2,
  Clock,
  Tv,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Users,
  CreditCard,
  Sparkles,
  Calendar,
  ArrowRight,
  Info,
} from 'lucide-react';

export const ActiveSessionCountdown = ({
  customerUser,
  upcomingBookings = [],
  onOpenBooking,
}) => {
  const [activeSession, setActiveSession] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  // Poll backend for active sessions
  const fetchActiveSession = async () => {
    try {
      const params = customerUser?._id ? { customerId: customerUser._id } : {};
      const res = await sessionsApi.getActiveSessions(params);
      if (res.success && res.data.sessions?.length > 0) {
        // Customer's verified active session
        const session = res.data.sessions[0];
        const endMs = new Date(session.scheduledEndAt).getTime();
        const now = Date.now();
        const diffSec = Math.max(0, Math.floor((endMs - now) / 1000));

        // If time has already expired, do not keep it as a running active session
        if (diffSec <= 0 && session.status !== 'EXTENDED') {
          setActiveSession(null);
          setRemainingSeconds(0);
        } else {
          setActiveSession(session);
          setRemainingSeconds(diffSec);
        }
      } else {
        // Session ended, completed, or no active session
        setActiveSession(null);
        setRemainingSeconds(0);
      }
    } catch (err) {
      console.warn('[ActiveSessionCountdown] poll error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSession();
    // 4-second polling interval for real-time synchronization
    const syncInterval = setInterval(fetchActiveSession, 4000);

    // Cross-tab and window event listener for immediate reactive synchronization
    const handleSync = () => fetchActiveSession();
    window.addEventListener('session_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('session_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [customerUser?._id || customerUser?.id]);

  // Local 1-second ticker using authoritative scheduledEndAt
  useEffect(() => {
    if (!activeSession || !activeSession.scheduledEndAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const endMs = new Date(activeSession.scheduledEndAt).getTime();
      const diffSec = Math.max(0, Math.floor((endMs - now) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec === 0) {
        fetchActiveSession();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession?.scheduledEndAt, activeSession?.id || activeSession?._id, activeSession?.status]);

  if (loading) return null;

  // Format HH:MM:SS
  const formatTime = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------------------------------------
  // CASE A: NO ACTIVE SESSION EXISTS
  // -------------------------------------------------------------------------
  if (!activeSession) {
    const firstUpcoming = upcomingBookings && upcomingBookings.length > 0 ? upcomingBookings[0] : null;

    return (
      <div className="p-5 rounded-2xl border bg-white dark:bg-[#260D17] border-slate-200 dark:border-[#49202C] shadow-md dark:shadow-xl mb-6 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#851B2B]/15 border border-slate-200 dark:border-[#49202C] text-slate-500 dark:text-slate-400 shrink-0">
              <Gamepad2 className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  No Active Session
                </span>
                {firstUpcoming && (
                  <span className="text-xs text-[#851B2B] dark:text-[#D7FF00] font-mono font-bold">
                    Upcoming: {firstUpcoming.bookingId}
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading mt-1">
                {firstUpcoming ? 'Session Awaiting Venue Check-in' : 'No Gaming Session Running'}
              </h3>

              {firstUpcoming ? (
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {firstUpcoming.device?.name || 'Gaming Station'}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" />
                      {firstUpcoming.bookingDate}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" />
                      {format12HourRange(firstUpcoming.startTime, firstUpcoming.endTime)} ({firstUpcoming.duration}h)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#C7A5A8]">
                    Your session timer will begin automatically when front desk staff checks you in upon arrival.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-[#C7A5A8] mt-1">
                  You do not have a live gaming session running right now. Reserve a PlayStation 5 console or 8-Ball Pool table to play.
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-start md:justify-end">
            {firstUpcoming ? (
              <span className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-[#F5B942] border border-amber-200 dark:border-amber-500/30">
                {firstUpcoming.paymentStatus === 'PAID' ? 'Confirmed & Reserved' : 'Payment at Counter'}
              </span>
            ) : onOpenBooking ? (
              <button
                type="button"
                onClick={() => onOpenBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-[#851B2B] hover:bg-[#6e1623] text-white font-bold font-heading text-xs uppercase tracking-wider transition-all shadow-md shadow-[#851B2B]/20 flex items-center gap-1.5"
              >
                <span>Book a Station</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // CASE B: GENUINE LIVE ACTIVE SESSION RUNNING
  // -------------------------------------------------------------------------
  const isExpired = remainingSeconds <= 0 || activeSession.status === 'AWAITING_RECEPTIONIST' || activeSession.status === 'TIME_EXPIRED';
  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 300; // <= 5 min
  const isWarning = remainingSeconds > 300 && remainingSeconds <= 900; // <= 15 min

  const themeBorder = isExpired
    ? 'border-rose-500/60 bg-rose-50 dark:bg-rose-950/20'
    : isUrgent
    ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/20 animate-pulse'
    : isWarning
    ? 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/10'
    : 'border-slate-200 dark:border-[#49202C] bg-white dark:bg-[#260D17]';

  const timerColor = isExpired
    ? 'text-rose-600 dark:text-rose-400'
    : isUrgent
    ? 'text-amber-600 dark:text-amber-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-300'
    : 'text-[#851B2B] dark:text-[#D7FF00]';

  return (
    <div className={`p-5 rounded-2xl border shadow-xl transition-all ${themeBorder} mb-6 animate-fadeIn`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Device & Game Info */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-[#851B2B]/10 dark:bg-[#851B2B]/20 border border-[#851B2B]/30 text-[#851B2B] dark:text-[#D7FF00] shrink-0">
            <Gamepad2 className="w-6 h-6 animate-bounce" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                Live Session Active
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Booking ID: {activeSession.booking?.bookingId}
              </span>
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading mt-1 flex items-center gap-2">
              {activeSession.device?.name || 'Gaming Station'}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                &bull; {activeSession.game?.name || 'Assigned Title'}
              </span>
              {activeSession.game?.isExclusive && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-mono">
                  Exclusive
                </span>
              )}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" />
                {activeSession.booking?.numberOfPlayers || 1} Player(s)
              </span>
              <span>&bull;</span>
              <span>Started: {format12HourTime(activeSession.startedAt)} IST</span>
              <span>&bull;</span>
              <span>Ends: {format12HourTime(activeSession.scheduledEndAt)} IST</span>
            </div>
          </div>
        </div>

        {/* Right: Countdown Clock */}
        <div className="text-left md:text-right p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
            {isExpired ? 'Status' : 'Time Remaining'}
          </span>
          <div className={`text-3xl font-black font-mono tracking-wider ${timerColor}`}>
            {isExpired ? '00:00:00' : formatTime(remainingSeconds)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
            {isExpired
              ? 'Awaiting Receptionist Checkout'
              : `${activeSession.booking?.duration || 1}h total session`}
          </span>
        </div>
      </div>

      {/* Warning Banners */}
      {isExpired && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            Your scheduled gaming session has expired. Please wrap up your game and visit reception for checkout.
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline font-mono">
            Station held until checkout
          </span>
        </div>
      )}

      {isUrgent && !isExpired && (
        <div className="mt-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Only {Math.ceil(remainingSeconds / 60)} minute(s) remaining! Contact the front desk if you wish to extend your session.
          </span>
        </div>
      )}
    </div>
  );
};
