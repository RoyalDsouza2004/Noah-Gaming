import React, { useState, useEffect } from 'react';
import { scheduleApi } from '../../api/schedule.js';
import { showToast } from '../../utils/toast.js';
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Info,
  CalendarDays,
  ShieldAlert,
  X,
  ChevronRight,
  Sun,
  Moon,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const AdminOperatingHoursTab = () => {
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [operatingStatus, setOperatingStatus] = useState(null);

  // Weekly Schedule State
  const [weeklySchedule, setWeeklySchedule] = useState({
    monday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
    tuesday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
    wednesday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
    thursday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
    friday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
    saturday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
    sunday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  });

  // Holidays State
  const [holidays, setHolidays] = useState([]);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    closureType: 'FULL_DAY',
    description: '',
    notifyCustomers: true,
    partialClosure: {
      openTime: '12:00',
      closeTime: '20:00',
      closedIntervals: [],
    },
  });

  // Conflict Warning Modal State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState({
    conflicts: [],
    pendingAction: null, // callback to proceed
  });

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, weeklyRes, holidaysRes] = await Promise.all([
        scheduleApi.getOperatingStatus().catch(() => ({ success: false })),
        scheduleApi.getWeeklyHours().catch(() => ({ success: false })),
        scheduleApi.getHolidays().catch(() => ({ success: false })),
      ]);

      if (statusRes.success) {
        setOperatingStatus(statusRes.data);
      }
      if (weeklyRes.success) {
        if (weeklyRes.data?.schedule) {
          setWeeklySchedule(weeklyRes.data.schedule);
        } else if (Array.isArray(weeklyRes.data?.weeklySchedule)) {
          const map = {};
          weeklyRes.data.weeklySchedule.forEach((d) => {
            map[d.dayOfWeek.toLowerCase()] = {
              isOpen: d.isOpen !== false,
              openTime: d.openTime || '10:00',
              closeTime: d.closeTime || '23:00',
            };
          });
          setWeeklySchedule(map);
        }
      }
      if (holidaysRes.success && holidaysRes.data?.holidays) {
        setHolidays(holidaysRes.data.holidays);
      }
    } catch (err) {
      showToast.error('Failed to load schedule data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update a single day's hours or toggle
  const handleDayChange = (day, field, value) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // Copy Monday's hours to all days
  const handleApplyToAllDays = (sourceDay = 'monday') => {
    const source = weeklySchedule[sourceDay];
    if (!source) return;
    const updated = {};
    DAYS_OF_WEEK.forEach((d) => {
      updated[d] = { ...source };
    });
    setWeeklySchedule(updated);
    showToast.success(`Applied ${DAY_LABELS[sourceDay]}'s hours to all days.`);
  };

  // Save Weekly Schedule (with conflict check)
  const handleSaveWeeklySchedule = async (forceProceed = false) => {
    if (!forceProceed) {
      // Check conflicts for the upcoming 7 days
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const conflictRes = await scheduleApi.checkConflicts({
          type: 'WEEKLY_SCHEDULE',
          startDate: todayStr,
          weeklySchedule,
        });

        if (conflictRes.success && conflictRes.data?.conflictCount > 0) {
          setConflictData({
            conflicts: conflictRes.data.conflicts,
            pendingAction: () => handleSaveWeeklySchedule(true),
          });
          setConflictModalOpen(true);
          return;
        }
      } catch (err) {
        console.warn('Conflict check failed, proceeding with caution', err);
      }
    }

    setSavingSchedule(true);
    try {
      // Build canonical array for backend
      const canonicalSchedule = DAYS_OF_WEEK.map((day) => ({
        dayOfWeek: day,
        isOpen: weeklySchedule[day]?.isOpen !== false,
        openTime: weeklySchedule[day]?.openTime || '10:00',
        closeTime: weeklySchedule[day]?.closeTime || '23:00',
      }));

      const res = await scheduleApi.updateWeeklyHours(canonicalSchedule);
      if (res.success) {
        showToast.success('Weekly operating hours updated successfully!');
        setConflictModalOpen(false);
        if (res.data?.schedule) {
          setWeeklySchedule(res.data.schedule);
        } else {
          loadData();
        }
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to update weekly hours.');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Open Holiday Modal
  const openNewHolidayModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    setEditingHoliday(null);
    setHolidayForm({
      name: '',
      startDate: dateStr,
      endDate: dateStr,
      closureType: 'FULL_DAY',
      description: '',
      notifyCustomers: true,
      partialClosure: {
        openTime: '12:00',
        closeTime: '20:00',
        closedIntervals: [],
      },
    });
    setHolidayModalOpen(true);
  };

  const openEditHolidayModal = (h) => {
    setEditingHoliday(h);
    setHolidayForm({
      name: h.name || '',
      startDate: h.startDate || '',
      endDate: h.endDate || '',
      closureType: h.closureType || 'FULL_DAY',
      description: h.description || '',
      notifyCustomers: !!h.notifyCustomers,
      partialClosure: {
        openTime: h.partialClosure?.openTime || '12:00',
        closeTime: h.partialClosure?.closeTime || '20:00',
        closedIntervals: h.partialClosure?.closedIntervals || [],
      },
    });
    setHolidayModalOpen(true);
  };

  // Submit Holiday Form (with conflict check)
  const handleSaveHoliday = async (forceProceed = false) => {
    if (!holidayForm.name.trim()) {
      showToast.error('Please enter a holiday / closure name.');
      return;
    }
    if (!holidayForm.startDate) {
      showToast.error('Please select a start date.');
      return;
    }
    if (!holidayForm.endDate) {
      holidayForm.endDate = holidayForm.startDate;
    }

    if (!forceProceed) {
      try {
        const conflictRes = await scheduleApi.checkConflicts({
          type: 'HOLIDAY',
          startDate: holidayForm.startDate,
          endDate: holidayForm.endDate,
          closureType: holidayForm.closureType,
          partialClosure: holidayForm.partialClosure,
        });

        if (conflictRes.success && conflictRes.data?.conflictCount > 0) {
          setConflictData({
            conflicts: conflictRes.data.conflicts,
            pendingAction: () => handleSaveHoliday(true),
          });
          setConflictModalOpen(true);
          return;
        }
      } catch (err) {
        console.warn('Conflict check error', err);
      }
    }

    try {
      if (editingHoliday) {
        const res = await scheduleApi.updateHoliday(editingHoliday._id, holidayForm);
        if (res.success) {
          showToast.success(`Holiday '${holidayForm.name}' updated.`);
        }
      } else {
        const res = await scheduleApi.createHoliday(holidayForm);
        if (res.success) {
          showToast.success(`Holiday '${holidayForm.name}' added.`);
        }
      }
      setHolidayModalOpen(false);
      setConflictModalOpen(false);
      loadData();
    } catch (err) {
      showToast.error(err.message || 'Failed to save holiday.');
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove '${name}'?`)) return;
    try {
      const res = await scheduleApi.deleteHoliday(id);
      if (res.success) {
        showToast.success(`Holiday '${name}' removed.`);
        loadData();
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to delete holiday.');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Top Banner / Live Lounge Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Live Status Card */}
        <div className="p-5 rounded-2xl bg-[#171014] border border-[#49202C] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#F5B942] font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D7FF00]" /> Live Lounge Status
            </span>
            {operatingStatus?.isCurrentlyOpen ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                OPEN NOW
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                CURRENTLY CLOSED
              </span>
            )}
          </div>
          <div>
            <div className="text-xl font-black text-[#FFF4E8] font-heading mb-1">
              {operatingStatus?.statusMessage || 'Loading status...'}
            </div>
            <p className="text-xs text-[#C7A5A8]">
              {operatingStatus?.todaySchedule?.isClosed
                ? `Closed today (${operatingStatus.todaySchedule.reason || 'Rest Day'})`
                : `Today's Operating Hours: ${operatingStatus?.todaySchedule?.openTime || '10:00'} - ${operatingStatus?.todaySchedule?.closeTime || '23:00'} IST`}
            </p>
          </div>
        </div>

        {/* Timezone & Business Rules */}
        <div className="p-5 rounded-2xl bg-[#171014] border border-[#49202C] shadow-lg flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#F5B942] font-bold flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#D7FF00]" /> Timezone Standard
            </span>
            <div className="text-lg font-bold text-[#FFF4E8] mb-1">
              Asia/Kolkata (IST +05:30)
            </div>
            <p className="text-xs text-[#C7A5A8] leading-relaxed">
              All front-desk bookings, customer calendar slots, countdowns and operating hours strictly synchronize in Indian Standard Time.
            </p>
          </div>
          <div className="text-[11px] font-mono text-[#D7FF00] mt-3">
            Strict Schedule Priority: Holiday Closure &gt; Special Hours &gt; Weekly Schedule
          </div>
        </div>

        {/* Upcoming Holidays Summary */}
        <div className="p-5 rounded-2xl bg-[#171014] border border-[#49202C] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#F5B942] font-bold flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-[#D7FF00]" /> Scheduled Closures
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#851B2B]/40 text-[#FFF4E8] border border-[#851B2B]">
              {holidays.length} Active
            </span>
          </div>
          {holidays.length > 0 ? (
            <div>
              <div className="text-sm font-bold text-[#FFF4E8] truncate">
                Next: {holidays[0].name}
              </div>
              <p className="text-xs text-[#C7A5A8] mt-1">
                {holidays[0].startDate} {holidays[0].startDate !== holidays[0].endDate ? `to ${holidays[0].endDate}` : ''} ({holidays[0].closureType === 'FULL_DAY' ? 'Full Closure' : 'Special Hours'})
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#C7A5A8]">
              No upcoming closures or special holidays scheduled. Lounge runs on regular weekly schedule.
            </p>
          )}
          <button
            type="button"
            onClick={openNewHolidayModal}
            className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#851B2B]/40 hover:bg-[#851B2B] text-xs font-bold text-[#FFF4E8] border border-[#851B2B] transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Holiday / Closure
          </button>
        </div>
      </div>

      {/* SECTION 1: WEEKLY OPERATING HOURS */}
      <div className="p-6 rounded-2xl bg-[#171014] border border-[#49202C] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#260D17]">
          <div>
            <h2 className="text-xl font-black text-[#FFF4E8] font-heading flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#D7FF00]" /> Weekly Operating Hours
            </h2>
            <p className="text-xs text-[#C7A5A8] mt-1">
              Configure normal opening and closing times for each day of the week.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleApplyToAllDays('monday')}
              className="px-3 py-2 rounded-xl bg-[#260D17] hover:bg-[#851B2B]/30 text-xs font-semibold text-[#FFF4E8] border border-[#49202C] transition-all"
              title="Copy Monday's open & close times to all 7 days"
            >
              Copy Monday to All Days
            </button>
            <button
              type="button"
              onClick={() => handleSaveWeeklySchedule(false)}
              disabled={savingSchedule}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#851B2B] to-[#a32235] hover:from-[#9c2033] hover:to-[#b8273c] text-xs font-bold text-[#FFF4E8] border border-[#F5B942]/40 shadow-lg shadow-[#851B2B]/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {savingSchedule ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#D7FF00]" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#D7FF00]" />
              )}
              Save Weekly Hours
            </button>
          </div>
        </div>

        {/* 7-Day Table/Cards */}
        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => {
            const entry = weeklySchedule[day] || { isOpen: true, openTime: '10:00', closeTime: '23:00' };
            const isWeekend = day === 'saturday' || day === 'sunday';

            return (
              <div
                key={day}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  entry.isOpen
                    ? 'bg-[#260D17]/40 border-[#49202C] hover:border-[#851B2B]'
                    : 'bg-[#171014] border-slate-800/80 opacity-70'
                }`}
              >
                {/* Day Name & Toggle */}
                <div className="flex items-center gap-4 min-w-[200px]">
                  <button
                    type="button"
                    onClick={() => handleDayChange(day, 'isOpen', !entry.isOpen)}
                    className="flex items-center gap-2 cursor-pointer focus:outline-none"
                    aria-label={`Toggle ${DAY_LABELS[day]} open state`}
                  >
                    {entry.isOpen ? (
                      <ToggleRight className="w-8 h-8 text-[#D7FF00] shrink-0" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#C7A5A8] shrink-0" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#FFF4E8]">
                        {DAY_LABELS[day]}
                      </span>
                      {isWeekend && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
                          Weekend
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        entry.isOpen ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {entry.isOpen ? 'Open for Bookings' : 'Lounge Closed'}
                    </span>
                  </div>
                </div>

                {/* Open & Close Time Pickers */}
                {entry.isOpen ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-[#F5B942]" />
                      <label className="text-xs text-[#C7A5A8]">Open:</label>
                      <input
                        type="time"
                        value={entry.openTime}
                        onChange={(e) => handleDayChange(day, 'openTime', e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-[#171014] border border-[#49202C] text-xs font-mono text-[#FFF4E8] focus:border-[#D7FF00] focus:outline-none"
                      />
                    </div>
                    <span className="text-[#C7A5A8]">to</span>
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-[#D7FF00]" />
                      <label className="text-xs text-[#C7A5A8]">Close:</label>
                      <input
                        type="time"
                        value={entry.closeTime}
                        onChange={(e) => handleDayChange(day, 'closeTime', e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-[#171014] border border-[#49202C] text-xs font-mono text-[#FFF4E8] focus:border-[#D7FF00] focus:outline-none"
                      />
                    </div>
                    {/* Quick Presets for this day */}
                    <div className="hidden lg:flex items-center gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleDayChange(day, 'openTime', '10:00');
                          handleDayChange(day, 'closeTime', '23:00');
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-[#171014] hover:bg-[#851B2B]/30 text-[#C7A5A8] border border-[#49202C]"
                      >
                        10:00 - 23:00
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDayChange(day, 'openTime', '09:00');
                          handleDayChange(day, 'closeTime', '00:00');
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-[#171014] hover:bg-[#851B2B]/30 text-[#C7A5A8] border border-[#49202C]"
                      >
                        09:00 - 00:00
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#C7A5A8] italic">
                    Lounge will not accept bookings on this day.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: HOLIDAYS & SPECIAL SCHEDULE OVERRIDES */}
      <div className="p-6 rounded-2xl bg-[#171014] border border-[#49202C] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#260D17]">
          <div>
            <h2 className="text-xl font-black text-[#FFF4E8] font-heading flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#D7FF00]" /> Holiday &amp; Schedule Overrides
            </h2>
            <p className="text-xs text-[#C7A5A8] mt-1">
              Add single or multi-day holidays, emergency closures, or special holiday hours that override regular weekly schedules.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewHolidayModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#851B2B] hover:bg-[#9c2033] text-xs font-bold text-[#FFF4E8] border border-[#F5B942]/30 shadow-md transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-[#D7FF00]" /> Add New Holiday
          </button>
        </div>

        {/* Holidays List */}
        {holidays.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#260D17]/20 border border-[#49202C]/50 space-y-2">
            <Calendar className="w-8 h-8 text-[#C7A5A8] mx-auto opacity-50" />
            <div className="text-sm font-bold text-[#FFF4E8]">No Holidays or Schedule Overrides</div>
            <p className="text-xs text-[#C7A5A8] max-w-md mx-auto">
              No special closures are currently scheduled. Use &ldquo;Add New Holiday&rdquo; to block calendar dates for festivals, staff training or maintenance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#49202C] text-[#F5B942] uppercase font-mono tracking-wider">
                  <th className="py-3 px-4">Holiday / Reason</th>
                  <th className="py-3 px-4">Date Range</th>
                  <th className="py-3 px-4">Closure Type</th>
                  <th className="py-3 px-4">Hours / Intervals</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#260D17]">
                {holidays.map((h) => (
                  <tr key={h._id} className="hover:bg-[#260D17]/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#FFF4E8]">{h.name}</div>
                      {h.description && (
                        <div className="text-[11px] text-[#C7A5A8] truncate max-w-xs">
                          {h.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#FFF4E8]">
                      {h.startDate} {h.startDate !== h.endDate ? `to ${h.endDate}` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      {h.closureType === 'FULL_DAY' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Full Day Closure
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Special Hours
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#C7A5A8]">
                      {h.closureType === 'FULL_DAY' ? (
                        <span>Closed All Day</span>
                      ) : (
                        <div>
                          <span>
                            {h.partialClosure?.openTime || '10:00'} - {h.partialClosure?.closeTime || '23:00'}
                          </span>
                          {h.partialClosure?.closedIntervals?.length > 0 && (
                            <span className="block text-[10px] text-amber-300">
                              {h.partialClosure.closedIntervals.length} closed interval(s)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {h.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditHolidayModal(h)}
                        className="p-1.5 rounded-lg bg-[#260D17] hover:bg-[#851B2B]/40 text-[#C7A5A8] hover:text-[#FFF4E8] border border-[#49202C] transition-all"
                        title="Edit Holiday"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(h._id, h.name)}
                        className="p-1.5 rounded-lg bg-[#260D17] hover:bg-rose-900/40 text-rose-400 border border-rose-900/50 transition-all"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT HOLIDAY */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[#171014] border border-[#49202C] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#260D17]">
              <h3 className="text-lg font-bold font-heading text-[#FFF4E8]">
                {editingHoliday ? 'Edit Holiday / Closure' : 'Schedule New Holiday / Closure'}
              </h3>
              <button
                type="button"
                onClick={() => setHolidayModalOpen(false)}
                className="p-1 rounded-lg text-[#C7A5A8] hover:text-[#FFF4E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-[#C7A5A8] mb-1 font-semibold">
                  Holiday / Event Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Festival Closure, Annual System Maintenance"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#260D17] border border-[#49202C] text-[#FFF4E8] focus:border-[#D7FF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-[#C7A5A8] mb-1 font-semibold">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={holidayForm.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setHolidayForm((prev) => ({
                        ...prev,
                        startDate: newStart,
                        endDate: prev.endDate < newStart ? newStart : prev.endDate,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#260D17] border border-[#49202C] text-[#FFF4E8] font-mono focus:border-[#D7FF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-[#C7A5A8] mb-1 font-semibold">
                    End Date (Inclusive) *
                  </label>
                  <input
                    type="date"
                    value={holidayForm.endDate}
                    min={holidayForm.startDate}
                    onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#260D17] border border-[#49202C] text-[#FFF4E8] font-mono focus:border-[#D7FF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-[#C7A5A8] mb-1 font-semibold">
                  Closure Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHolidayForm({ ...holidayForm, closureType: 'FULL_DAY' })}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                      holidayForm.closureType === 'FULL_DAY'
                        ? 'bg-[#851B2B] text-[#FFF4E8] border-[#F5B942]/40 shadow-sm'
                        : 'bg-[#260D17] text-[#C7A5A8] border-[#49202C]'
                    }`}
                  >
                    Full Day Closure
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayForm({ ...holidayForm, closureType: 'PARTIAL' })}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                      holidayForm.closureType === 'PARTIAL'
                        ? 'bg-[#851B2B] text-[#FFF4E8] border-[#F5B942]/40 shadow-sm'
                        : 'bg-[#260D17] text-[#C7A5A8] border-[#49202C]'
                    }`}
                  >
                    Special Hours / Partial
                  </button>
                </div>
              </div>

              {/* If Partial Closure, show custom hours */}
              {holidayForm.closureType === 'PARTIAL' && (
                <div className="p-3.5 rounded-xl bg-[#260D17] border border-[#49202C] space-y-3">
                  <div className="text-xs font-bold text-[#F5B942]">Special Operating Hours</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#C7A5A8] mb-1">Opens At</label>
                      <input
                        type="time"
                        value={holidayForm.partialClosure.openTime}
                        onChange={(e) =>
                          setHolidayForm({
                            ...holidayForm,
                            partialClosure: {
                              ...holidayForm.partialClosure,
                              openTime: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#171014] border border-[#49202C] text-[#FFF4E8] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#C7A5A8] mb-1">Closes At</label>
                      <input
                        type="time"
                        value={holidayForm.partialClosure.closeTime}
                        onChange={(e) =>
                          setHolidayForm({
                            ...holidayForm,
                            partialClosure: {
                              ...holidayForm.partialClosure,
                              closeTime: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#171014] border border-[#49202C] text-[#FFF4E8] font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block uppercase tracking-wider text-[#C7A5A8] mb-1 font-semibold">
                  Description / Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notice visible to staff and customers..."
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#260D17] border border-[#49202C] text-[#FFF4E8] focus:border-[#D7FF00] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="notifyCust"
                  checked={holidayForm.notifyCustomers}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, notifyCustomers: e.target.checked })
                  }
                  className="rounded border-[#49202C] text-[#851B2B] focus:ring-[#851B2B]"
                />
                <label htmlFor="notifyCust" className="text-[#C7A5A8] cursor-pointer">
                  Notify customers on customer booking screen &amp; lounge banner
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#260D17]">
              <button
                type="button"
                onClick={() => setHolidayModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#260D17] hover:bg-[#3d1525] text-xs font-semibold text-[#C7A5A8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveHoliday(false)}
                className="px-5 py-2 rounded-xl bg-[#851B2B] hover:bg-[#9c2033] text-xs font-bold text-[#FFF4E8] border border-[#F5B942]/30 shadow-md"
              >
                {editingHoliday ? 'Save Changes' : 'Create Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFLICT REVIEW & SAFETY WARNING */}
      {conflictModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl p-6 rounded-2xl bg-[#171014] border-2 border-rose-500/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#260D17]">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/40">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-rose-300">
                  Existing Reservations Conflict Detected
                </h3>
                <p className="text-xs text-[#C7A5A8]">
                  The proposed schedule change affects {conflictData.conflicts.length} confirmed customer booking(s).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200">
              <strong className="text-rose-300">Existing Booking Protection Active:</strong> Antigravity safety policy prohibits silent booking cancellations or removals. Please review the affected reservations below.
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-[#49202C] rounded-xl p-2 bg-[#260D17]/40">
              {conflictData.conflicts.map((b) => (
                <div
                  key={b._id}
                  className="p-2.5 rounded-lg bg-[#171014] border border-[#49202C] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-[#F5B942]">{b.bookingId}</span>
                    <span className="mx-2 text-[#C7A5A8]">|</span>
                    <span className="text-[#FFF4E8] font-semibold">{b.customer?.name || 'Customer'}</span>
                    <div className="text-[11px] text-[#C7A5A8] mt-0.5">
                      Station: {b.device?.name || 'Console'} &bull; Slot: {b.bookingDate} ({b.startTime} - {b.endTime})
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {b.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#260D17] gap-3">
              <button
                type="button"
                onClick={() => setConflictModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#260D17] hover:bg-[#3d1525] text-xs font-semibold text-[#FFF4E8]"
              >
                Cancel &amp; Revert Change
              </button>
              <button
                type="button"
                onClick={() => {
                  if (conflictData.pendingAction) {
                    conflictData.pendingAction();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-[#FFF4E8] shadow-md"
              >
                Proceed &amp; Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
