import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { bookingApi } from '../../api/booking.js';
import { paymentApi } from '../../api/payment.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ReceiptModal } from '../payment/ReceiptModal.jsx';
import { RazorpayModal } from '../payment/RazorpayModal.jsx';
import { ConfirmModal } from '../common/ConfirmModal.jsx';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import { PAYMENT_MESSAGES } from '../../utils/featureFlags.js';
import { useFeatureFlags } from '../../hooks/useFeatureFlags.js';
import {
  Calendar,
  Clock,
  Tv,
  Gamepad2,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Lock,
  Banknote,
} from 'lucide-react';
import { format12HourTime } from '../../utils/timeFormat.js';

function formatBookingTimeRange(booking) {
  if (!booking) return '';
  const startStr = booking.startAt
    ? format12HourTime(new Date(booking.startAt))
    : format12HourTime(booking.startTime || '');

  let endStr = '';
  if (booking.endAt) {
    endStr = format12HourTime(new Date(booking.endAt));
  } else if (booking.startTime && booking.duration) {
    const [h, m] = booking.startTime.split(':').map(Number);
    const totalM = h * 60 + m + Math.round(booking.duration * 60);
    const endH = Math.floor(totalM / 60) % 24;
    const endMin = totalM % 60;
    endStr = format12HourTime(`${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`);
  } else {
    endStr = format12HourTime(booking.endTime || '');
  }

  if (booking.startAt && booking.endAt) {
    const startDay = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' }).format(new Date(booking.startAt));
    const endDay = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' }).format(new Date(booking.endAt));
    if (startDay !== endDay) {
      return `${startStr} – ${endStr} (+1 day)`;
    }
  }

  return `${startStr} – ${endStr}`;
}

export const MyBookings = ({ onNewBooking, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const { enableOnlinePayments } = useFeatureFlags();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Lock body scroll and handle Escape key while booking details modal is open
  useEffect(() => {
    if (selectedBooking) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setSelectedBooking(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [selectedBooking]);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Phase 4 Payment Modals state
  const [activeReceiptBookingId, setActiveReceiptBookingId] = useState(null);
  const [balanceOrder, setBalanceOrder] = useState(null);
  const [balanceBooking, setBalanceBooking] = useState(null);
  const [payBalanceModalOpen, setPayBalanceModalOpen] = useState(false);

  const fetchBookings = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const query = statusFilter ? `status=${statusFilter}` : '';
      const res = await bookingApi.getMyBookings(query);
      if (res.success && res.data?.bookings) {
        setBookings(res.data.bookings);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to fetch bookings');
      showToast.error(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchBookings();
  }, [isAuthenticated, statusFilter]);

  const handleCancelBooking = (id, bookingRef) => {
    setBookingToCancel({ id, bookingRef });
  };

  const executeCancelBooking = async (id, bookingRef) => {
    try {
      const res = await bookingApi.cancelBooking(id, 'Cancelled by player');
      if (res.success) {
        showToast.success(`Reservation ${bookingRef} cancelled. Slots released.`);
        setBookingToCancel(null);
        setSelectedBooking(null);
        fetchBookings();
        window.dispatchEvent(new Event('booking_updated'));
      }
    } catch (err) {
      showToast.error(err.message || 'Failed to cancel booking');
    }
  };

  // Initiate Online Balance Payment via Razorpay
  const handlePayRemainingBalance = async (booking) => {
    if (!enableOnlinePayments) {
      showToast.info(PAYMENT_MESSAGES.ONLINE_UNAVAILABLE);
      return;
    }

    setActionError('');
    setActionSuccess('');
    try {
      const orderRes = await paymentApi.createOrder({
        bookingId: booking._id,
        paymentPurpose: 'BOOKING_BALANCE',
      });

      if (orderRes.success && orderRes.data) {
        setBalanceBooking(booking);
        setBalanceOrder(orderRes.data);
        setPayBalanceModalOpen(true);
      } else {
        throw new Error(orderRes.message || 'Unable to create payment order');
      }
    } catch (err) {
      setActionError(err.message || 'Failed to initiate balance payment');
      showToast.error(err.message || 'Failed to initiate balance payment');
    }
  };

  const handleBalancePaymentSuccess = (payment, updatedBooking) => {
    setPayBalanceModalOpen(false);
    showToast.success(`Balance paid! Receipt #${payment.receiptNumber} generated.`);
    fetchBookings();
    setActiveReceiptBookingId(updatedBooking?._id || balanceBooking?._id);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col bg-[#260D17] border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100">
      {/* Top Header & Back Navigation */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition-all text-xs font-semibold shadow-sm group"
        >
          <ArrowLeft className="w-4 h-4 text-[#D7FF00] group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Lounge</span>
        </button>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title Subheader */}
      <div className="py-2 shrink-0">
        <h2 className="text-xl sm:text-2xl font-bold font-heading text-white">MY GAMING RESERVATIONS</h2>
        <p className="text-xs text-slate-400">Track your upcoming sessions, payments, balances, and digital receipts.</p>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Bookings List */}
      <div className="space-y-3">
        {bookings.slice((page - 1) * pageSize, page * pageSize).map((booking) => {
          const hasBalanceDue =
            booking.bookingStatus !== 'CANCELLED' &&
            (booking.paymentStatus === 'PARTIALLY_PAID' ||
              (booking.balanceRemaining && booking.balanceRemaining > 0));

          const hasReceipt =
            booking.paymentStatus === 'PAID' ||
            booking.paymentStatus === 'PARTIALLY_PAID' ||
            booking.amountPaid > 0;

          return (
            <div
              key={booking._id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-[#D7FF00]">{booking.bookingId}</span>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      booking.bookingStatus === 'CONFIRMED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : booking.bookingStatus === 'CANCELLED'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {booking.bookingStatus}
                  </span>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    {booking.bookingType}
                  </span>

                  {/* Payment Status Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      booking.paymentStatus === 'PAID'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : booking.paymentStatus === 'PARTIALLY_PAID'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : booking.paymentStatus === 'REFUNDED'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {booking.paymentStatus === 'PARTIALLY_PAID'
                      ? 'PARTIALLY PAID (50% ADVANCE)'
                      : `PAYMENT: ${booking.paymentStatus}`}
                  </span>
                </div>

                <h4 className="text-base font-bold text-white font-heading">{booking.device?.name}</h4>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#D7FF00]" /> {booking.bookingDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#D7FF00]" /> {formatBookingTimeRange(booking)} ({booking.duration}h)
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#D7FF00]" /> {booking.numberOfPlayers} Player(s)
                  </span>
                </div>

                {/* Financial note if partially paid */}
                {booking.paymentStatus === 'PARTIALLY_PAID' && (
                  <div className="text-[11px] font-mono text-amber-300/90 pt-0.5">
                    Advance Paid: ₹{(booking.amountPaid || 0) / 100} • Balance Due: ₹{(booking.balanceRemaining || 0) / 100}
                  </div>
                )}
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-500 block">Total Amount</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    ₹{booking.totalAmount / 100}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* Pay Remaining Balance Button */}
                  {hasBalanceDue && (
                    <button
                      onClick={() => handlePayRemainingBalance(booking)}
                      disabled={!enableOnlinePayments}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading flex items-center gap-1 transition-all ${
                        !enableOnlinePayments
                          ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-80 shadow-none'
                          : 'bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] shadow-md shadow-[#851B2B]/20'
                      }`}
                      title={
                        !enableOnlinePayments
                          ? 'Online balance payments are temporarily unavailable. Please pay at the counter.'
                          : 'Pay remaining balance online'
                      }
                    >
                      {!enableOnlinePayments ? (
                        <>
                          <Banknote className="w-3 h-3 text-amber-400" /> Pay Due at Counter ₹{(booking.balanceRemaining || 0) / 100}
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3 h-3" /> Pay Due ₹{(booking.balanceRemaining || 0) / 100}
                        </>
                      )}
                    </button>
                  )}

                  {/* Digital Receipt Button */}
                  {hasReceipt && (
                    <button
                      onClick={() => setActiveReceiptBookingId(booking._id)}
                      className="px-3 py-1.5 rounded-lg bg-[#851B2B]/15 hover:bg-[#851B2B]/25 text-[#FFF4E8] text-xs font-semibold border border-[#49202C] flex items-center gap-1"
                      title="View Official Digital Receipt"
                    >
                      <FileText className="w-3 h-3" /> Receipt
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedBooking(booking)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                  >
                    Details
                  </button>

                  {booking.bookingStatus === 'CONFIRMED' && (
                    <button
                      onClick={() => handleCancelBooking(booking._id, booking.bookingId)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {bookings.length === 0 && !loading && (
          <div className="py-12 text-center text-xs text-slate-500 space-y-3">
            <p>No reservations found.</p>
            {onNewBooking && (
              <button
                onClick={onNewBooking}
                className="px-4 py-2 rounded-xl bg-[#851B2B] text-[#FFF4E8] font-bold font-heading text-xs uppercase tracking-wider"
              >
                Book a Session Now
              </button>
            )}
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={Math.ceil(bookings.length / pageSize)}
          totalItems={bookings.length}
          pageSize={pageSize}
          onPageChange={setPage}
          className="mt-4"
        />
      </div>

      {/* Details Modal (Portaled to document.body for reliable viewport centering) */}
      {selectedBooking && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBooking(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md my-auto p-5 sm:p-6 bg-white dark:bg-[#260D17] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl space-y-4 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white">Booking Details</h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Close dialog"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Booking ID:</span>
                <span className="text-[#851B2B] dark:text-[#D7FF00] font-bold">{selectedBooking.bookingId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Status:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedBooking.bookingStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Payment Status:</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">{selectedBooking.paymentStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Station:</span>
                <span className="text-slate-900 dark:text-white font-sans font-medium">{selectedBooking.device?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Date:</span>
                <span className="text-slate-900 dark:text-white">{selectedBooking.bookingDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Time Interval (IST):</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {formatBookingTimeRange(selectedBooking)} ({selectedBooking.duration}h)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Mode:</span>
                <span className="text-purple-600 dark:text-purple-400 font-semibold">{selectedBooking.bookingType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Number of Players:</span>
                <span className="text-slate-900 dark:text-white font-bold">{selectedBooking.numberOfPlayers}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Total Price:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{selectedBooking.totalAmount / 100}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Amount Paid:</span>
                <span className="text-emerald-700 dark:text-emerald-300">₹{(selectedBooking.amountPaid || 0) / 100}</span>
              </div>
              {selectedBooking.balanceRemaining > 0 && (
                <div className="flex justify-between py-1 text-sm font-sans font-bold text-amber-600 dark:text-amber-300">
                  <span>Balance Due:</span>
                  <span className="font-mono">₹{selectedBooking.balanceRemaining / 100}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {(selectedBooking.paymentStatus === 'PAID' ||
                selectedBooking.paymentStatus === 'PARTIALLY_PAID' ||
                selectedBooking.amountPaid > 0) && (
                <button
                  onClick={() => {
                    setActiveReceiptBookingId(selectedBooking._id);
                    setSelectedBooking(null);
                  }}
                  className="px-4 py-2 bg-[#851B2B]/15 hover:bg-[#851B2B]/25 text-[#851B2B] dark:text-[#FFF4E8] rounded-xl text-xs font-semibold border border-[#851B2B]/30 transition-colors"
                >
                  View Receipt
                </button>
              )}
              {selectedBooking.bookingStatus === 'CONFIRMED' && (
                <button
                  onClick={() => handleCancelBooking(selectedBooking._id, selectedBooking.bookingId)}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-500/30 transition-colors"
                >
                  Cancel Booking
                </button>
              )}
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Digital Receipt Modal (Phase 4) */}
      {activeReceiptBookingId && (
        <ReceiptModal
          bookingId={activeReceiptBookingId}
          onClose={() => setActiveReceiptBookingId(null)}
        />
      )}

      {/* Confirmation Modal for Booking Cancellation */}
      <ConfirmModal
        isOpen={Boolean(bookingToCancel)}
        title="Cancel Booking"
        message={`Are you sure you want to cancel reservation ${bookingToCancel?.bookingRef}? This will release the occupied station slots and apply standard cancellation rules.`}
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        isDanger={true}
        onConfirm={() => executeCancelBooking(bookingToCancel.id, bookingToCancel.bookingRef)}
        onClose={() => setBookingToCancel(null)}
      />

      {/* Razorpay Modal for Paying Remaining Balance (Phase 4) */}
      {payBalanceModalOpen && balanceOrder && (
        <RazorpayModal
          order={balanceOrder}
          bookingDetails={balanceBooking}
          onSuccess={handleBalancePaymentSuccess}
          onClose={() => setPayBalanceModalOpen(false)}
        />
      )}
    </div>
  );
};
