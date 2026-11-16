import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../api/booking.js';
import {
  Calendar as CalendarIcon,
  Clock,
  Tv,
  Gamepad2,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
  Shield,
  CircleDot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  X,
} from 'lucide-react';

const OPERATING_HOURS = [
  '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
];

export const AdminCalendarTab = ({ devices }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'weekly'
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [error, setError] = useState('');
  const [selectedSlotDetails, setSelectedSlotDetails] = useState(null);

  // Fetch timeline from backend
  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await bookingApi.getCalendarTimeline(`date=${selectedDate}&view=${viewMode}`);
      if (res.success && res.data) {
        setTimelineData(res.data.timeline || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch timeline data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [selectedDate, viewMode]);

  const handleDateShift = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getSlotStateForDevice = (deviceTimeline, hourStr) => {
    const hour = parseInt(hourStr.split(':')[0], 10);
    const endHour = hour + 1;
    const endHourStr = `${endHour < 10 ? '0' : ''}${endHour}:00`;

    // Check device operating status
    if (deviceTimeline.device.status === 'MAINTENANCE') {
      return {
        status: 'MAINTENANCE',
        label: 'MAINTENANCE',
        color: 'bg-amber-950/40 border-amber-600/60 text-amber-300',
        bookings: [],
      };
    }

    // Filter confirmed bookings intersecting this 1-hour interval
    const bookingsInHour = (deviceTimeline.bookings || []).filter((b) => {
      if (b.bookingStatus === 'CANCELLED') return false;
      const bStartHour = parseInt(b.startTime.split(':')[0], 10);
      const bEndHour = parseInt(b.endTime.split(':')[0], 10);
      return hour >= bStartHour && hour < bEndHour;
    });

    if (bookingsInHour.length === 0) {
      return {
        status: 'AVAILABLE',
        label: 'Available',
        color: 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-emerald-500/50 hover:bg-emerald-950/20',
        bookings: [],
        remaining: deviceTimeline.device.capacity,
      };
    }

    // Check if any is PRIVATE
    const privateBooking = bookingsInHour.find((b) => b.bookingType === 'PRIVATE');
    if (privateBooking) {
      return {
        status: 'PRIVATE',
        label: 'PRIVATE LOCK',
        color: 'bg-purple-950/50 border-purple-500/60 text-purple-300 shadow-sm shadow-purple-500/10',
        bookings: bookingsInHour,
        remaining: 0,
      };
    }

    // Calculate sum of players for SHARED sessions
    const totalBookedPlayers = bookingsInHour.reduce((sum, b) => sum + (b.numberOfPlayers || 1), 0);
    const capacity = deviceTimeline.device.capacity || 4;
    const remaining = Math.max(0, capacity - totalBookedPlayers);

    if (remaining === 0) {
      return {
        status: 'FULL',
        label: `FULL (${totalBookedPlayers}/${capacity})`,
        color: 'bg-rose-950/50 border-rose-500/60 text-rose-300 shadow-sm shadow-rose-500/10',
        bookings: bookingsInHour,
        remaining: 0,
      };
    }

    return {
      status: 'PARTIALLY_BOOKED',
      label: `SHARED (${totalBookedPlayers}/${capacity})`,
      color: 'bg-[#851B2B]/20 border-[#49202C] text-[#FFF4E8] shadow-sm shadow-[#851B2B]/20',
      bookings: bookingsInHour,
      remaining,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#171014] border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#D7FF00]" /> Visual Station Booking Calendar
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time visual schedule across PS5 Station 1, PS5 Station 2, and 8-Ball Pool Table.
          </p>
        </div>

        {/* Date Selector & Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateShift(-1)}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#851B2B]"
          />

          <button
            onClick={() => setSelectedDate(todayStr)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-[#D7FF00] border border-slate-700"
          >
            Today
          </button>

          <button
            onClick={() => handleDateShift(1)}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px]">
        <span className="text-slate-400 font-semibold uppercase tracking-wider">Slot Indicators:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 inline-block" />
          <span className="text-slate-300">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#260D17] border border-[#851B2B] inline-block" />
          <span className="text-[#FFF4E8] font-semibold">Partially Booked (Shared)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-950 border border-rose-500 inline-block" />
          <span className="text-rose-300 font-semibold">Full Capacity (4/4)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-950 border border-purple-500 inline-block" />
          <span className="text-purple-300 font-semibold">Private Reservation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-950 border border-amber-500 inline-block" />
          <span className="text-amber-300 font-semibold">Maintenance</span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Timeline Grid (Devices columns, Hours rows) */}
      <div className="rounded-xl border border-slate-800 bg-[#171014] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 w-28 border-r border-slate-800">Time (IST)</th>
                {timelineData.map((t) => (
                  <th key={t.device.id} className="py-3 px-4 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      {t.device.deviceType === 'POOL' ? (
                        <CircleDot className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Gamepad2 className="w-4 h-4 text-[#D7FF00]" />
                      )}
                      <div>
                        <div className="font-bold text-white text-xs">{t.device.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          Max {t.device.capacity} Players • {t.bookingsCount} booking(s)
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {OPERATING_HOURS.map((hourStr) => {
                const hourNum = parseInt(hourStr.split(':')[0], 10);
                const nextHourStr = `${hourNum + 1 < 10 ? '0' : ''}${hourNum + 1}:00`;

                return (
                  <tr key={hourStr} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-semibold border-r border-slate-800 whitespace-nowrap bg-slate-950/40 text-[11px]">
                      {hourStr} - {nextHourStr}
                    </td>

                    {timelineData.map((devTimeline) => {
                      const slotState = getSlotStateForDevice(devTimeline, hourStr);

                      return (
                        <td key={devTimeline.device.id} className="p-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSlotDetails({
                                device: devTimeline.device,
                                timeSlot: `${hourStr} - ${nextHourStr}`,
                                date: selectedDate,
                                slotState,
                              });
                            }}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between min-h-[56px] ${slotState.color}`}
                          >
                            <div className="flex items-center justify-between gap-1 w-full">
                              <span className="font-bold font-sans text-[11px] truncate">{slotState.label}</span>
                              {slotState.status === 'AVAILABLE' && (
                                <span className="text-[9px] text-emerald-400 font-mono">Open</span>
                              )}
                            </div>

                            {/* Bookings snippet */}
                            {slotState.bookings.length > 0 && (
                              <div className="text-[10px] font-sans truncate text-slate-300 mt-1">
                                {slotState.bookings.map((b, i) => (
                                  <span key={b._id || i} className="block truncate">
                                    • {b.customer?.name || 'Guest'} ({b.numberOfPlayers}p)
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- MODAL: SLOT INSPECTOR ---------------- */}
      {selectedSlotDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 bg-[#171014] border border-slate-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#D7FF00]">Timeline Inspector</span>
                <h3 className="text-lg font-bold font-heading text-white">
                  {selectedSlotDetails.device.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSlotDetails(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] font-sans uppercase">Date</span>
                <div className="text-white mt-0.5">{selectedSlotDetails.date}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] font-sans uppercase">Time Slot</span>
                <div className="text-[#D7FF00] mt-0.5">{selectedSlotDetails.timeSlot} (IST)</div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Station Capacity:</span>
                <span className="font-bold text-white">{selectedSlotDetails.device.capacity} Players</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Slot Status:</span>
                <span className="font-bold text-[#D7FF00] uppercase">
                  {selectedSlotDetails.slotState.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confirmed Bookings:</span>
                <span className="font-bold text-white">
                  {selectedSlotDetails.slotState.bookings.length}
                </span>
              </div>
            </div>

            {/* List Bookings occupying this slot */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Bookings in this Slot:
              </h4>
              {selectedSlotDetails.slotState.bookings.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                  No reservations for this hour. Slot is fully available for booking.
                </div>
              ) : (
                selectedSlotDetails.slotState.bookings.map((b) => (
                  <div
                    key={b._id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#D7FF00]" />
                        {b.customer?.name || 'Walk-in Guest'} ({b.numberOfPlayers} player{b.numberOfPlayers > 1 ? 's' : ''})
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        ID: {b.bookingId} • {b.bookingType} • {b.startTime} - {b.endTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white font-mono">
                        ₹{(b.totalAmount / 100).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400">
                        {b.bookingStatus}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedSlotDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
