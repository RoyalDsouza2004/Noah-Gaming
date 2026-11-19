import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { bookingApi } from '../../api/booking.js';
import { reportsApi } from '../../api/reports.js';
import {
  Calendar,
  Clock,
  Tv,
  Gamepad2,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Eye,
  FileText,
  DollarSign,
  UserCheck,
  ChevronRight,
  X,
  Download,
  Loader2,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal.jsx';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';

export const AdminBookingsTab = ({ devices, games, onRefreshData }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalBookings: 0, confirmedBookings: 0, totalRevenuePaise: 0 });
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBookings, setTotalBookings] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [exportingBookings, setExportingBookings] = useState(false);

  const handleExportBookings = async (format = 'xlsx') => {
    setExportingBookings(true);
    try {
      const res = await reportsApi.downloadReport('bookings', format, {
        range: selectedDate ? 'custom' : 'all',
        startDate: selectedDate || undefined,
        endDate: selectedDate || undefined,
        status: selectedStatus || undefined,
      });
      showToast.success(`Bookings exported: ${res.fileName}`);
    } catch (err) {
      showToast.error(err.message || 'Failed to export bookings.');
    } finally {
      setExportingBookings(false);
    }
  };

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Walk-in form state
  const todayStr = new Date().toISOString().split('T')[0];
  const [walkinForm, setWalkinForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deviceId: devices[0]?._id || '',
    gameId: '',
    bookingDate: todayStr,
    startTime: '14:00',
    duration: 1,
    numberOfPlayers: 1,
    bookingType: 'SHARED',
    notes: 'Walk-in customer booking at lounge counter',
  });
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);

  // Load Bookings
  const fetchBookings = async (targetPage = page) => {
    setLoading(true);
    setActionError('');
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedDevice) params.append('deviceId', selectedDevice);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedType) params.append('bookingType', selectedType);
      if (selectedDate) params.append('date', selectedDate);
      params.append('page', String(targetPage));
      params.append('limit', String(pageSize));

      const res = await bookingApi.getAdminBookings(params.toString());
      if (res.success && res.data) {
        setBookings(res.data.bookings || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.pages || 1);
          setTotalBookings(res.data.pagination.total || (res.data.bookings || []).length);
        } else {
          setTotalPages(1);
          setTotalBookings((res.data.bookings || []).length);
        }
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchBookings(1);
  }, [selectedDevice, selectedStatus, selectedType, selectedDate]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchBookings(newPage);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBookings();
  };

  const handleCancelBooking = (id, bookingRef) => {
    setBookingToCancel({ id, bookingRef });
  };

  const executeCancelBooking = async (id, bookingRef) => {
    try {
      const res = await bookingApi.updateAdminBooking(id, {
        bookingStatus: 'CANCELLED',
        cancellationReason: 'Cancelled by Lounge Administrator',
      });
      if (res.success) {
        showToast.success(`Booking ${bookingRef} successfully cancelled and capacity released.`);
        setActionSuccess(`Booking ${bookingRef} successfully cancelled and capacity released.`);
        setBookingToCancel(null);
        setDetailModalOpen(false);
        fetchBookings();
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to cancel booking');
      setActionError(err.message || 'Failed to cancel booking');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await bookingApi.updateAdminBooking(id, { bookingStatus: newStatus });
      if (res.success) {
        showToast.success(`Booking status updated to ${newStatus}.`);
        setActionSuccess(`Booking status updated to ${newStatus}.`);
        if (selectedBooking && selectedBooking._id === id) {
          setSelectedBooking({ ...selectedBooking, bookingStatus: newStatus });
        }
        fetchBookings();
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to update booking status');
      setActionError(err.message || 'Failed to update booking status');
    }
  };

  const handleCreateWalkin = async (e) => {
    e.preventDefault();
    setWalkinSubmitting(true);
    setActionError('');
    try {
      const payload = {
        customerName: walkinForm.customerName,
        customerPhone: walkinForm.customerPhone,
        customerEmail: walkinForm.customerEmail || undefined,
        deviceId: walkinForm.deviceId,
        gameId: walkinForm.gameId || undefined,
        bookingDate: walkinForm.bookingDate,
        startTime: walkinForm.startTime,
        duration: Number(walkinForm.duration),
        numberOfPlayers: Number(walkinForm.numberOfPlayers),
        bookingType: walkinForm.bookingType,
        notes: walkinForm.notes,
      };

      const res = await bookingApi.createAdminBooking(payload);
      if (res.success) {
        showToast.success(`Walk-in booking created! ID: ${res.data.booking.bookingId}`);
        setActionSuccess(`Walk-in booking created successfully! ID: ${res.data.booking.bookingId}`);
        setWalkinModalOpen(false);
        setWalkinForm({
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          deviceId: devices[0]?._id || '',
          gameId: '',
          bookingDate: todayStr,
          startTime: '14:00',
          duration: 1,
          numberOfPlayers: 1,
          bookingType: 'SHARED',
          notes: 'Walk-in customer booking at lounge counter',
        });
        fetchBookings();
        if (onRefreshData) onRefreshData();
        setTimeout(() => setActionSuccess(''), 5000);
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to create walk-in booking');
      setActionError(err.message || 'Failed to create walk-in booking');
    } finally {
      setWalkinSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-[#851B2B]/20 text-[#D7FF00] border border-[#49202C]">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type) => {
    if (type === 'PRIVATE') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
          Private Station
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#851B2B]/20 text-[#FFF4E8] border border-[#49202C]">
        Shared Session
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Walk-in Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#D7FF00]" /> Booking Management & Walk-in Desk
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time session reservations, capacity tracking, walk-in creation, and cancellation management.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => handleExportBookings('xlsx')}
            disabled={exportingBookings}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold font-heading uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Export all matching reservations to Excel (.xlsx)"
          >
            {exportingBookings ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D7FF00]" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#D7FF00]" />
            )}
            Export Excel
          </button>
          <button
            onClick={() => handleExportBookings('csv')}
            disabled={exportingBookings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold font-heading uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Export all matching reservations to CSV"
          >
            CSV
          </button>
          <button
            onClick={() => setWalkinModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-bold text-xs uppercase tracking-wider font-heading shadow-md shadow-[#851B2B]/20 transition-all"
          >
            <Plus className="w-4 h-4 text-white" /> <span className="text-white">New Walk-In Booking</span>
          </button>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Aggregate KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Total Bookings Recorded</div>
          <div className="text-2xl font-black font-mono text-white mt-1">{stats.totalBookings || bookings.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across all stations & devices</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Active / Confirmed Sessions</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.confirmedBookings ?? bookings.filter((b) => b.bookingStatus === 'CONFIRMED').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Holding reserved device capacity</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Gross Booking Value</div>
          <div className="text-2xl font-black font-mono text-[#D7FF00] mt-1">
            ₹{((stats.totalRevenuePaise || 0) / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Configured pricing in database</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#171014] border border-slate-800 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Booking ID, customer name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Device Filter */}
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            >
              <option value="">All Devices</option>
              {devices.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            >
              <option value="">All Booking Types</option>
              <option value="SHARED">Shared Session</option>
              <option value="PRIVATE">Private Session</option>
            </select>

            {/* Date Filter */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-bold text-xs uppercase rounded-lg font-heading shadow-md shadow-[#851B2B]/20"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Bookings Table */}
      <div className="rounded-xl border border-slate-800 bg-[#171014] shadow-xl overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="sm:hidden flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="text-[#D7FF00] font-bold">↔</span> Swipe horizontally to view full booking details
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[#D7FF00] text-[9px] font-bold">Scrollable</span>
        </div>
        <div
          className="overflow-x-auto overscroll-x-contain touch-auto w-full table-scrollbar"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
          }}
        >
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Booking ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Device & Game</th>
                <th className="py-3 px-4">Date & Slot (IST)</th>
                <th className="py-3 px-4">Type / Players</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D7FF00]" />
                    Loading bookings database...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    No bookings found matching current filters.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-900/50 transition-colors">
                    {/* Booking ID */}
                    <td className="py-3 px-4 font-mono font-bold text-[#D7FF00]">
                      {b.bookingId}
                      {b.isWalkIn && (
                        <span className="block text-[9px] text-amber-400 font-sans uppercase">Walk-in</span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{b.customer?.name || 'Walk-in Guest'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {b.customer?.phone || b.customer?.email}
                      </div>
                    </td>

                    {/* Device & Game */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-[#D7FF00]" />
                        {b.device?.name || 'Gaming Station'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Gamepad2 className="w-3 h-3 text-purple-400" />
                        {b.game?.name || 'All Compatible Titles'}
                      </div>
                    </td>

                    {/* Date & Slot */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-white flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {b.bookingDate}
                      </div>
                      <div className="text-[11px] text-[#FFF4E8] font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {b.startTime} - {b.endTime} ({b.duration}h)
                      </div>
                    </td>

                    {/* Type / Players */}
                    <td className="py-3 px-4 space-y-1">
                      <div>{getTypeBadge(b.bookingType)}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        {b.numberOfPlayers} {b.numberOfPlayers === 1 ? 'Player' : 'Players'}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white font-mono text-sm">
                        ₹{(b.totalAmount / 100).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {b.paymentStatus === 'PAID' ? (
                          <span className="text-emerald-400 font-semibold">PAID</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">UNPAID</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">{getStatusBadge(b.bookingStatus)}</td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedBooking(b);
                            setDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-[#D7FF00] border border-slate-700 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {b.bookingStatus === 'CONFIRMED' && (
                          <button
                            onClick={() => handleCancelBooking(b._id, b.bookingId)}
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
                            title="Cancel & Release Capacity"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Real Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalBookings}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </div>

      {/* ---------------- MODAL: BOOKING DETAILS ---------------- */}
      {detailModalOpen && selectedBooking && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="m-auto w-full max-w-xl p-6 bg-white dark:bg-[#171014] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#851B2B] dark:text-[#D7FF00] font-bold">Reservation Details</span>
                <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white">{selectedBooking.bookingId}</h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Close dialog"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">Customer Information</span>
                <div className="font-bold text-white text-sm">{selectedBooking.customer?.name}</div>
                <div className="text-slate-400 font-mono">{selectedBooking.customer?.phone}</div>
                <div className="text-slate-400">{selectedBooking.customer?.email}</div>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">Station & Game</span>
                <div className="font-bold text-[#D7FF00] text-sm">{selectedBooking.device?.name}</div>
                <div className="text-white">{selectedBooking.game?.name || 'Open Choice'}</div>
                <div className="text-slate-400 font-mono">Code: {selectedBooking.device?.deviceCode}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase">Date</span>
                <div className="font-bold text-white mt-0.5">{selectedBooking.bookingDate}</div>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase">Slot</span>
                <div className="font-bold text-[#D7FF00] font-mono mt-0.5">
                  {selectedBooking.startTime} - {selectedBooking.endTime}
                </div>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase">Duration</span>
                <div className="font-bold text-white mt-0.5">{selectedBooking.duration} hour(s)</div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Booking Type:</span>
                <span className="font-bold text-white uppercase">{selectedBooking.bookingType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Number of Players:</span>
                <span className="font-bold text-white">{selectedBooking.numberOfPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Charged:</span>
                <span className="font-bold font-mono text-[#D7FF00] text-sm">
                  ₹{(selectedBooking.totalAmount / 100).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Status:</span>
                <span className="font-semibold text-amber-400">{selectedBooking.paymentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Booking Status:</span>
                <div>{getStatusBadge(selectedBooking.bookingStatus)}</div>
              </div>
            </div>

            {selectedBooking.cancellationReason && (
              <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                <strong>Cancellation Reason:</strong> {selectedBooking.cancellationReason}
              </div>
            )}

            {/* Quick Status Modifiers */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Quick Status:</span>
                {selectedBooking.bookingStatus === 'CONFIRMED' && (
                  <button
                    onClick={() => handleStatusChange(selectedBooking._id, 'COMPLETED')}
                    className="px-2.5 py-1 rounded bg-[#851B2B]/20 text-[#FFF4E8] hover:bg-[#851B2B]/40 text-xs font-semibold"
                  >
                    Mark Completed
                  </button>
                )}
                {selectedBooking.bookingStatus === 'PENDING' && (
                  <button
                    onClick={() => handleStatusChange(selectedBooking._id, 'CONFIRMED')}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold"
                  >
                    Confirm Booking
                  </button>
                )}
              </div>

              {selectedBooking.bookingStatus === 'CONFIRMED' && (
                <button
                  onClick={() => handleCancelBooking(selectedBooking._id, selectedBooking.bookingId)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs border border-rose-500/30"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ---------------- MODAL: NEW WALK-IN BOOKING ---------------- */}
      {walkinModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="m-auto w-full max-w-lg p-6 bg-[#171014] border border-slate-700/80 rounded-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400">Front Desk Counter</span>
                <h3 className="text-lg font-bold font-heading text-white">Create Walk-In Reservation</h3>
              </div>
              <button
                onClick={() => setWalkinModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWalkin} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Verma"
                    value={walkinForm.customerName}
                    onChange={(e) => setWalkinForm({ ...walkinForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Customer Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={walkinForm.customerPhone}
                    onChange={(e) => setWalkinForm({ ...walkinForm, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Customer Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={walkinForm.customerEmail}
                  onChange={(e) => setWalkinForm({ ...walkinForm, customerEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Device / Station *</label>
                  <select
                    required
                    value={walkinForm.deviceId}
                    onChange={(e) => setWalkinForm({ ...walkinForm, deviceId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {devices.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.capacity} cap)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Game Title (Optional)</label>
                  <select
                    value={walkinForm.gameId}
                    onChange={(e) => {
                      const selectedGame = games.find((g) => g._id === e.target.value);
                      setWalkinForm({
                        ...walkinForm,
                        gameId: e.target.value,
                        bookingType: selectedGame?.isExclusive ? 'PRIVATE' : walkinForm.bookingType,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Any / General Session</option>
                    {games.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name} {g.isExclusive ? '(Exclusive PS5)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={walkinForm.bookingDate}
                    onChange={(e) => setWalkinForm({ ...walkinForm, bookingDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Start Time (IST) *</label>
                  <select
                    value={walkinForm.startTime}
                    onChange={(e) => setWalkinForm({ ...walkinForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {[
                      '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                      '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Duration (Hours) *</label>
                  <select
                    value={walkinForm.duration}
                    onChange={(e) => setWalkinForm({ ...walkinForm, duration: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="1">1 Hour</option>
                    <option value="2">2 Hours</option>
                    <option value="3">3 Hours</option>
                    <option value="4">4 Hours</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Session Type *</label>
                  <select
                    value={walkinForm.bookingType}
                    onChange={(e) => setWalkinForm({ ...walkinForm, bookingType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="SHARED">Shared (Joinable)</option>
                    <option value="PRIVATE">Private (Full Station Lock)</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Number of Players *</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    required
                    value={walkinForm.numberOfPlayers}
                    onChange={(e) => setWalkinForm({ ...walkinForm, numberOfPlayers: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={walkinForm.notes}
                  onChange={(e) => setWalkinForm({ ...walkinForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setWalkinModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkinSubmitting}
                  className="px-5 py-2 bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white font-bold rounded-lg font-heading shadow-md shadow-[#851B2B]/20 flex items-center gap-1.5"
                >
                  <span className="text-white">{walkinSubmitting ? 'Confirming Slot...' : 'Confirm Walk-In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(bookingToCancel)}
        title="Cancel Booking"
        message={`Are you sure you want to cancel booking ${bookingToCancel?.bookingRef}? This will release the occupied station slots and update booking history.`}
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        isDanger={true}
        onConfirm={() => executeCancelBooking(bookingToCancel.id, bookingToCancel.bookingRef)}
        onClose={() => setBookingToCancel(null)}
      />
    </div>
  );
};
