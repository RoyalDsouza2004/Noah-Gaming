import React, { useState, useEffect } from 'react';
import { automationApi } from '../../api/automation.js';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import {
  Settings,
  Bell,
  Clock,
  MessageSquare,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  Send,
  Calendar,
  Crown,
  Tv,
} from 'lucide-react';

export const AdminAutomationTab = () => {
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Pagination states
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logPageSize] = useState(10);

  // Form states
  const [sessionIntervals, setSessionIntervals] = useState('15, 5, 1');
  const [bookingIntervals, setBookingIntervals] = useState('1440, 60, 15');
  const [membershipIntervals, setMembershipIntervals] = useState('7, 3, 1, 0');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: 'WHATSAPP_BUSINESS_API',
    phoneNumberId: '',
    apiKey: '',
    apiSecret: '',
    senderNumber: '',
  });

  const fetchData = async (targetPage = logPage) => {
    setLoading(true);
    try {
      const [setRes, logsRes] = await Promise.all([
        automationApi.getSettings(),
        automationApi.getLogs({ page: targetPage, limit: logPageSize }),
      ]);

      if (setRes.success && setRes.data) {
        const s = setRes.data;
        setSettings(s);
        setSessionIntervals((s.sessionReminderIntervals || []).join(', '));
        setBookingIntervals((s.bookingReminderIntervals || []).join(', '));
        setMembershipIntervals((s.membershipReminderIntervals || []).join(', '));
        setWhatsappEnabled(s.whatsappEnabled || false);
        setAutomationEnabled(s.automationEnabled !== false);
        if (s.whatsappConfig) setWhatsappConfig(s.whatsappConfig);
      }

      if (logsRes.success && logsRes.data) {
        setLogs(logsRes.data.logs || []);
        if (logsRes.data.pagination) {
          setLogTotalPages(logsRes.data.pagination.pages || 1);
          setLogTotal(logsRes.data.pagination.total || (logsRes.data.logs || []).length);
        } else {
          setLogTotalPages(1);
          setLogTotal((logsRes.data.logs || []).length);
        }
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to load automation configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleLogPageChange = (newPage) => {
    setLogPage(newPage);
    fetchData(newPage);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parseList = (str) =>
        str
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n));

      const payload = {
        sessionReminderIntervals: parseList(sessionIntervals),
        bookingReminderIntervals: parseList(bookingIntervals),
        membershipReminderIntervals: parseList(membershipIntervals),
        whatsappEnabled,
        automationEnabled,
        whatsappConfig,
      };

      const res = await automationApi.updateSettings(payload);
      if (res.success) {
        showToast.success('Automation settings saved to MongoDB successfully');
        setSettings(res.data);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to update automation settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCycle = async () => {
    setTriggering(true);
    try {
      const res = await automationApi.triggerCycle();
      if (res.success) {
        showToast.success('Automation scheduler executed successfully');
        fetchData();
      }
    } catch (err) {
      showToast.error(err.message || 'Manual trigger failed');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-[#D7FF00]">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
        <span className="text-sm font-semibold">Loading Automation Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-[#260D17] border border-[#49202C] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#D7FF00] text-xs font-bold uppercase tracking-widest mb-1">
            <Settings className="w-4 h-4" />
            Background Automation & Scheduler Engine
          </div>
          <h2 className="text-2xl font-black text-white font-heading">
            Automation & Notification Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Server-side interval timers, session alerts, arrival reminders, and WhatsApp integration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerCycle}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D7FF00] text-[#171014] font-bold text-xs shadow-lg shadow-[#851B2B]/20 hover:bg-[#cbf200] transition-all font-heading disabled:opacity-50"
          >
            {triggering ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Automation Cycle Now
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Grid 1: Configurable Interval Reminders */}
        <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#D7FF00]" />
            Configurable Reminder Intervals (Stored in MongoDB)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Session Countdown Thresholds */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <label className="block text-xs font-bold text-white font-heading mb-1">
                Active Session Alerts (Minutes remaining)
              </label>
              <input
                type="text"
                value={sessionIntervals}
                onChange={(e) => setSessionIntervals(e.target.value)}
                placeholder="15, 5, 1"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-[#851B2B]"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Comma-separated minutes (e.g. 15, 5, 1). Default: 15m, 5m, 1m warnings.
              </span>
            </div>

            {/* Upcoming Booking Thresholds */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <label className="block text-xs font-bold text-white font-heading mb-1">
                Upcoming Booking Reminders (Minutes before)
              </label>
              <input
                type="text"
                value={bookingIntervals}
                onChange={(e) => setBookingIntervals(e.target.value)}
                placeholder="1440, 60, 15"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-[#851B2B]"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Minutes before arrival (1440 = 24h, 60 = 1h, 15m).
              </span>
            </div>

            {/* Membership Expiration Thresholds */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <label className="block text-xs font-bold text-white font-heading mb-1">
                Membership Expiration Alerts (Days before)
              </label>
              <input
                type="text"
                value={membershipIntervals}
                onChange={(e) => setMembershipIntervals(e.target.value)}
                placeholder="7, 3, 1, 0"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-[#851B2B]"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Days before expiry (7d, 3d, 1d, 0 = on expiry day).
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#851B2B]/20 border border-[#49202C] text-xs">
            <span className="text-slate-300">
              Master Scheduler Switch: When enabled, background timers evaluate every 10 seconds.
            </span>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-white">
              <input
                type="checkbox"
                checked={automationEnabled}
                onChange={(e) => setAutomationEnabled(e.target.checked)}
                className="w-4 h-4 text-[#D7FF00] rounded bg-slate-950 border-slate-700"
              />
              Automation Engine Active
            </label>
          </div>
        </div>

        {/* Grid 2: WhatsApp Business API Integration */}
        <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              WhatsApp Notification Integration (Optional Business API)
            </h3>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-400 text-xs">
              <input
                type="checkbox"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
                className="w-4 h-4 text-emerald-500 rounded bg-slate-950 border-slate-700"
              />
              Enable WhatsApp Notifications
            </label>
          </div>

          <p className="text-xs text-slate-400">
            When enabled, automated reminders will also dispatch to customer mobile numbers via WhatsApp.
            If credentials are not supplied, the engine runs in simulated sandbox mode without interrupting in-app notifications.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">WhatsApp Provider</span>
              <input
                type="text"
                value={whatsappConfig.provider || ''}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, provider: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#851B2B]"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Phone Number ID</span>
              <input
                type="text"
                placeholder="e.g. 104859283719"
                value={whatsappConfig.phoneNumberId || ''}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#851B2B]"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Sender WhatsApp Number</span>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={whatsappConfig.senderNumber || ''}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, senderNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#851B2B]"
              />
            </div>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D7FF00] text-[#171014] font-bold text-xs shadow-lg shadow-[#D7FF00]/20 hover:bg-[#cbf200] transition-all font-heading disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Automation Settings
          </button>
        </div>
      </form>

      {/* Scheduler Execution Logs */}
      <div className="p-5 rounded-2xl bg-[#260D17] border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
            <History className="w-4 h-4 text-[#D7FF00]" />
            Scheduler Execution Audit Logs (GET /api/admin/automation/logs)
          </h3>
          <span className="text-xs text-slate-400 font-mono">{logs.length} recent cycles</span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No automation cycles recorded yet.
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.status === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-slate-300">{log.summary}</span>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <span>{new Date(log.executedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
                </div>
              </div>
            ))
          )}
        </div>

        <Pagination
          currentPage={logPage}
          totalPages={logTotalPages}
          totalItems={logTotal}
          pageSize={logPageSize}
          onPageChange={handleLogPageChange}
          className="mt-4"
        />
      </div>
    </div>
  );
};
