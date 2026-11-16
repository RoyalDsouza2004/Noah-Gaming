import React, { useState, useEffect } from 'react';
import { authApi } from '../api/auth.js';
import { Database, Server, Clock, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Cpu } from 'lucide-react';

export const SystemStatus = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await authApi.getHealth();
      if (response.success && response.data) {
        setHealthData(response.data);
        setError(null);
      } else {
        setError('Unexpected health response structure');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend API');
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString('en-IN'));
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const isDbConnected = healthData?.database?.connected || healthData?.database?.readyState === 1;

  return (
    <div id="system-health" className="p-6 rounded-2xl bg-[#260D17]/80 border border-[#49202C] text-[#FFF4E8] shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#49202C]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#851B2B]/20 text-[#D7FF00] border border-[#851B2B]/40">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-heading text-white flex items-center gap-2">
              SYSTEM ARCHITECTURE & CONNECTIVITY
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                Phase 1 Verified
              </span>
            </h3>
            <p className="text-xs text-[#C7A5A8]">
              Live verification of Frontend ↔ Backend Express API ↔ MongoDB persistence layer
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171014] hover:bg-[#851B2B]/30 text-xs text-[#FFF4E8] border border-[#49202C] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {error ? (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Backend Connection Issue</p>
            <p className="text-xs text-rose-200 mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Node / Express Status */}
          <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-[#C7A5A8] flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#D7FF00]" /> Express Engine
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
              </span>
            </div>
            <p className="text-lg font-bold text-white font-heading">Port 5000 / REST</p>
            <p className="text-xs text-[#C7A5A8] mt-1">
              Uptime: <span className="text-slate-200 font-mono">{healthData?.uptimeSeconds}s</span> | Env: {healthData?.environment}
            </p>
          </div>

          {/* MongoDB Connection Status */}
          <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-[#C7A5A8] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#F5B942]" /> Database Layer
              </span>
              {isDbConnected ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> CONNECTED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> DISCONNECTED
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-white font-heading">
              {healthData?.database?.mode === 'atlas' ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB (Standalone)'}
            </p>
            <p className="text-xs text-[#C7A5A8] mt-1 truncate">
              {healthData?.database?.mode === 'atlas' ? (
                <>Cluster: <span className="text-[#D7FF00] font-mono">{healthData?.database?.name} (Atlas Cloud)</span></>
              ) : (
                <>DB: <span className="text-[#D7FF00] font-mono">{healthData?.database?.name || 'gaming_lounge'}</span></>
              )}
            </p>
          </div>

          {/* Timezone (IST) */}
          <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-[#C7A5A8] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Indian Standard Time
              </span>
              <span className="text-xs font-bold text-[#F5B942] font-mono">IST (UTC+5:30)</span>
            </div>
            <p className="text-xs font-bold text-white truncate font-mono mt-2">
              {healthData?.timestampIST || 'Loading...'}
            </p>
            <p className="text-[11px] text-[#C7A5A8] mt-1">
              Server-authoritative timestamping
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
