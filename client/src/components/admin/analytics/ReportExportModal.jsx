import React, { useState } from 'react';
import { reportsApi } from '../../../api/reports.js';
import { showToast } from '../../../utils/toast.js';
import {
  FileText,
  Download,
  Calendar,
  X,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

const REPORT_CATALOG = [
  { id: 'master', name: '⭐ Master Business Report (Multi-Sheet)', desc: 'Comprehensive multi-sheet workbook covering all business, operational & financial domains' },
  { id: 'revenue', name: '1. Daily / Period Revenue Report', desc: 'Gross collections, refunds, and net collections over time' },
  { id: 'bookings', name: '2. Gaming Session & Bookings Report', desc: 'Detailed log of all online and counter walk-in sessions' },
  { id: 'devices', name: '3. Device Utilization & Capacity Report', desc: 'Operating hours, booked hours, and maintenance downtime' },
  { id: 'games', name: '4. Game Performance & Popularity Report', desc: 'Titles played, exclusive games, and GTA 6 hardware attribution' },
  { id: 'customers', name: '5. Customer Spending & Retention Report', desc: 'Active customers, lifetime spend, and membership tier' },
  { id: 'memberships', name: '6. Monthly Pass & Membership Report', desc: 'Subscriptions, renewals, upgrades, and pass revenue' },
  { id: 'payments', name: '7. Financial Transactions & Audit Report', desc: 'Paid, pending, refunded payments with receipts and methods' },
  { id: 'receptionists', name: '8. Staff & Receptionist Activity Report', desc: 'Walk-ins handled, check-ins, and counter cash collected' },
  { id: 'maintenance', name: '9. Hardware Maintenance & Downtime Report', desc: 'Incident logs, downtime hours, and maintenance history' },
];

export const ReportExportModal = ({ isOpen, onClose }) => {
  const [selectedReport, setSelectedReport] = useState('master');
  const [selectedFormat, setSelectedFormat] = useState('xlsx'); // xlsx, csv, pdf
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { range: dateRange };
      if (dateRange === 'custom') {
        if (!customStart || !customEnd) {
          showToast.error('Please specify both start and end date for custom range.');
          setExporting(false);
          return;
        }
        params.startDate = customStart;
        params.endDate = customEnd;
      }

      const res = await reportsApi.downloadReport(selectedReport, selectedFormat, params);
      showToast.success(`Report downloaded successfully: ${res.fileName}`);
      onClose();
    } catch (err) {
      showToast.error(err.message || 'Report export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#260D17] border border-[#49202C] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#49202C] bg-[#171014]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#851B2B]/20 border border-[#851B2B] text-[#D7FF00]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#FFF4E8] font-heading">
                Export Business Intelligence Reports
              </h3>
              <p className="text-xs text-[#C7A5A8]">
                Generate real database exports in formatted Excel (.xlsx), PDF, or CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* 1. Report Selector */}
          <div>
            <label className="block text-xs uppercase font-bold text-[#FFF4E8] tracking-wider mb-2 font-heading">
              Select Report Dataset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {REPORT_CATALOG.map((rep) => {
                const isSelected = selectedReport === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReport(rep.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#851B2B]/25 border-[#D7FF00] text-white shadow-md ring-1 ring-[#D7FF00]/40'
                        : 'bg-[#171014] border-[#49202C] text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold font-heading flex items-center justify-between">
                      <span className="truncate">{rep.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#D7FF00] shrink-0 ml-1" />}
                    </div>
                    <div className="text-[11px] text-[#C7A5A8] mt-1 line-clamp-1">{rep.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Format Selector */}
          <div>
            <label className="block text-xs uppercase font-bold text-[#FFF4E8] tracking-wider mb-2 font-heading">
              Export File Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'xlsx', label: 'Microsoft Excel', ext: '.xlsx', icon: FileSpreadsheet, desc: 'ExcelJS Styled (.xlsx)' },
                { id: 'pdf', label: 'Executive PDF', ext: '.pdf', icon: Printer, desc: 'PDFKit Vector Layout' },
                { id: 'csv', label: 'CSV Spreadsheet', ext: '.csv', icon: FileSpreadsheet, desc: 'RFC-4180 UTF-8 BOM' },
              ].map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#851B2B]/25 border-[#D7FF00] text-[#FFF4E8] ring-1 ring-[#D7FF00]'
                        : 'bg-[#171014] border-[#49202C] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-[#D7FF00]" />
                    <span className="text-xs font-bold font-heading">{fmt.label}</span>
                    <span className="text-[10px] text-[#C7A5A8]">{fmt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Date Range Filter */}
          <div>
            <label className="block text-xs uppercase font-bold text-[#FFF4E8] tracking-wider mb-2 font-heading">
              Filter Time Period (Indian Standard Time)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: '6m', label: 'Last 6 Months' },
                { id: '1y', label: 'Last 1 Year' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom Range' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDateRange(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dateRange === r.id
                      ? 'bg-[#D7FF00] text-[#171014] font-bold shadow-md'
                      : 'bg-[#171014] border border-[#49202C] text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {dateRange === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Start Date</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">End Date</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-[#49202C] bg-[#171014] flex items-center justify-between">
          <div className="text-[11px] text-[#C7A5A8]">
            Format: <span className="font-bold uppercase text-[#D7FF00]">{selectedFormat}</span> • Period: <span className="font-bold text-white">{dateRange}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D7FF00] to-[#b8db00] text-[#171014] font-bold text-xs uppercase tracking-wider font-heading shadow-md shadow-[#D7FF00]/20 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
