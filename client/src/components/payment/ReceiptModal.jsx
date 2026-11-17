import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { paymentApi } from '../../api/payment.js';
import { showToast } from '../../utils/toast.js';
import {
  FileText,
  Printer,
  Download,
  X,
  CheckCircle2,
  Calendar,
  Clock,
  Tv,
  Gamepad2,
  Users,
  ShieldCheck,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  Loader2,
  Crown,
  Sparkles,
} from 'lucide-react';

export const ReceiptModal = ({ paymentId, bookingId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [availableBookingPayments, setAvailableBookingPayments] = useState([]);
  const [selectedTxPaymentId, setSelectedTxPaymentId] = useState(paymentId || null);

  // Lock body scroll while modal is visible
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // If bookingId provided, load all payments for this booking to allow switching transactions
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        let activePayId = paymentId;

        if (bookingId && !activePayId) {
          const paymentsRes = await paymentApi.getBookingPayments(bookingId);
          if (paymentsRes.success && paymentsRes.data?.payments?.length > 0) {
            const successfulPayments = paymentsRes.data.payments.filter(
              (p) => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIALLY_REFUNDED'
            );
            if (isMounted) {
              setAvailableBookingPayments(successfulPayments);
            }
            if (successfulPayments.length > 0) {
              activePayId = successfulPayments[0].paymentId || successfulPayments[0]._id;
              if (isMounted) {
                setSelectedTxPaymentId(activePayId);
              }
            } else {
              throw new Error('No confirmed payment records found for this reservation.');
            }
          } else {
            throw new Error('No verified payment records found for this reservation.');
          }
        }

        if (activePayId) {
          const res = await paymentApi.getReceipt(activePayId, 'json');
          if (isMounted) {
            if (res?.success && res.data?.receipt) {
              setReceipt(res.data.receipt);
            } else {
              throw new Error(res?.message || 'Unable to load receipt details.');
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to generate receipt');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [paymentId, bookingId]);

  // Handle switching between different transactions on the same booking
  const handleSelectTransaction = async (targetPaymentId) => {
    if (targetPaymentId === selectedTxPaymentId) return;
    setLoading(true);
    setError('');
    setSelectedTxPaymentId(targetPaymentId);
    try {
      const res = await paymentApi.getReceipt(targetPaymentId, 'json');
      if (res?.success && res.data?.receipt) {
        setReceipt(res.data.receipt);
      } else {
        throw new Error(res?.message || 'Failed to load receipt.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load selected transaction receipt.');
    } finally {
      setLoading(false);
    }
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleOpenPrintable = () => {
    const idToPrint = receipt?.payment?.paymentId || selectedTxPaymentId || paymentId;
    if (!idToPrint) return;
    const url = paymentApi.getReceiptHtmlUrl(idToPrint);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadPdf = async () => {
    const idToDownload = receipt?.payment?.paymentId || selectedTxPaymentId || paymentId;
    if (!idToDownload) return;
    setDownloadingPdf(true);
    try {
      const res = await paymentApi.downloadReceiptPdf(idToDownload);
      showToast.success(`Receipt PDF saved: ${res.fileName}`);
    } catch (err) {
      showToast.error(err.message || 'Failed to download receipt PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'CASH':
        return <Banknote className="w-4 h-4 text-emerald-400" />;
      case 'COUNTER_UPI':
      case 'UPI':
        return <Smartphone className="w-4 h-4 text-[#D7FF00]" />;
      default:
        return <CreditCard className="w-4 h-4 text-[#F5B942]" />;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl my-auto bg-[#260D17] border border-[#49202C] rounded-3xl shadow-2xl text-[#FFF4E8] overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Receipt Header Banner */}
        <div className="p-6 bg-gradient-to-r from-[#851B2B]/25 via-[#260D17] to-[#851B2B]/25 border-b border-[#49202C] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/30 text-[#D7FF00] border border-[#851B2B] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D7FF00]">
                Official Digital Receipt
              </span>
              <h3 className="text-xl font-black font-heading text-[#FFF4E8]">
                NOAH GAMING
              </h3>
              <p className="text-[9px] font-bold text-[#F5B942] tracking-widest uppercase">
                PLAY • CHILL • CONNECT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {receipt && (
              <>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#851B2B] to-[#b3243a] hover:from-[#9c2033] hover:to-[#c42840] text-[#FFF4E8] text-xs font-bold font-heading transition-colors shadow-md border border-[#F5B942]/30 disabled:opacity-50"
                  title="Download Official PDF Receipt"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  PDF Receipt
                </button>
                <button
                  onClick={handleOpenPrintable}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] text-xs font-black font-heading transition-colors shadow-md shadow-[#D7FF00]/20"
                  title="Print or Open Printable View"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#171014] hover:bg-[#851B2B]/30 text-[#C7A5A8] hover:text-[#FFF4E8]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Transaction Switcher if multiple payments exist for booking */}
        {availableBookingPayments.length > 1 && (
          <div className="px-6 py-2.5 bg-[#171014] border-b border-[#49202C] flex items-center gap-2 overflow-x-auto text-xs font-mono">
            <span className="text-[10px] uppercase text-[#C7A5A8] whitespace-nowrap">Transactions:</span>
            {availableBookingPayments.map((p, idx) => {
              const pId = p.paymentId || p._id;
              const isSelected = pId === selectedTxPaymentId;
              return (
                <button
                  key={pId}
                  onClick={() => handleSelectTransaction(pId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#851B2B] text-[#FFF4E8] border border-[#F5B942]'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Tx {idx + 1}: ₹{(p.amount / 100).toLocaleString()} ({p.paymentPurpose})
                </button>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#D7FF00]" />
            <p className="text-xs font-mono">Generating verified digital receipt...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <X className="w-6 h-6" />
            </div>
            <p className="text-sm text-rose-300">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        )}

        {/* Receipt Content */}
        {receipt && !loading && (
          <div className="p-6 space-y-6">
            {/* Top Meta info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-[#171014] border border-[#49202C] text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-[#C7A5A8] block">Receipt Number</span>
                <span className="text-[#D7FF00] font-bold text-sm">{receipt.receiptNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#C7A5A8] block">Issue Date (IST)</span>
                <span className="text-slate-300">{receipt.issuedAtIST}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#C7A5A8] block">Customer Details</span>
                <span className="text-white font-sans font-semibold block">{receipt.customer?.name}</span>
                <span className="text-[10px] text-[#D7FF00] block">{receipt.customer?.customerId}</span>
                <span className="text-[10px] text-[#C7A5A8] block truncate">
                  {receipt.customer?.email !== 'N/A' ? receipt.customer?.email : ''} {receipt.customer?.phone !== 'N/A' ? '• ' + receipt.customer?.phone : ''}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#C7A5A8] block">Payment Status</span>
                <span className="inline-flex items-center gap-1 text-[#45C987] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {receipt.payment?.status}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ID: {receipt.payment?.paymentId}
                </span>
              </div>
            </div>

            {/* MEMBERSHIP SPECIFICATION (If membership payment) */}
            {receipt.isMembership || receipt.membership ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5B942] font-heading flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-[#F5B942]" /> Club Membership Specification
                </h4>

                <div className="p-4 rounded-2xl bg-[#171014] border border-[#49202C] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8]">Plan Tier</span>
                    <span className="font-bold text-white font-heading text-sm">
                      {receipt.membership?.planName || receipt.session?.rateScheme}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D7FF00]" /> Validity Duration
                    </span>
                    <span className="font-mono text-white">
                      {receipt.membership?.validityDuration} {receipt.membership?.validityUnit || 'DAYS'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#F5B942]" /> Benefit Scope
                    </span>
                    <span className="font-semibold text-emerald-400">
                      {receipt.membership?.isUnlimited ? 'Unlimited Lounge Gaming Access' : 'Club Member Discounted Hourly Rates'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[#C7A5A8]">
                    <span>Eligible Stations</span>
                    <span className="font-mono text-slate-300">
                      All Lounge PS5 Stations & Pool Tables Included
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* BOOKING SESSION SPECIFICATION */
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#C7A5A8] font-heading">
                  Session Specification
                </h4>

                <div className="p-4 rounded-2xl bg-[#171014] border border-[#49202C] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8] flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-[#F5B942]" /> Station
                    </span>
                    <span className="font-semibold text-white font-mono">
                      {receipt.session?.deviceName} ({receipt.session?.deviceType})
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8] flex items-center gap-1.5">
                      <Gamepad2 className="w-3.5 h-3.5 text-[#D7FF00]" /> Title / Game
                    </span>
                    <span className="font-semibold text-white">
                      {receipt.session?.gameTitle}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#F5B942]" /> Schedule (IST)
                    </span>
                    <span className="font-mono text-slate-300">
                      {receipt.session?.bookingDate} • {receipt.session?.startTime} - {receipt.session?.endTime} ({receipt.session?.durationHours}h)
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#49202C]/60">
                    <span className="text-[#C7A5A8] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#D7FF00]" /> Mode & Players
                    </span>
                    <span className="font-mono text-slate-300">
                      {receipt.session?.bookingType} • {receipt.session?.numberOfPlayers} Player(s)
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[#C7A5A8]">
                    <span>Rate Scheme</span>
                    <span className="font-mono text-slate-300">
                      {receipt.session?.rateScheme} {receipt.session?.ratePerUnitRupees > 0 ? `(₹${receipt.session?.ratePerUnitRupees}/hr)` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#171014] to-[#260D17] border border-[#49202C] space-y-2 text-xs font-mono">
              <div className="flex justify-between text-[#C7A5A8]">
                <span>Total {receipt.isMembership ? 'Plan Fee' : 'Booking Amount'}:</span>
                <span className="text-white font-bold">₹{receipt.financials?.totalBookingAmountRupees?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-white font-bold text-sm py-1.5 border-y border-[#49202C]">
                <span className="flex items-center gap-1.5">
                  {getMethodIcon(receipt.payment?.method)}
                  Amount Paid in This Transaction ({receipt.payment?.purpose}):
                </span>
                <span className="text-[#45C987] text-base">₹{receipt.financials?.amountPaidInThisTxRupees?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-slate-300 pt-1">
                <span>Cumulative Amount Paid to Date:</span>
                <span className="text-[#45C987] font-semibold">₹{receipt.financials?.totalAmountPaidRupees?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Outstanding Balance Remaining:</span>
                <span className={receipt.financials?.balanceRemainingRupees > 0 ? 'text-[#F5B942] font-bold' : 'text-[#45C987] font-semibold'}>
                  ₹{receipt.financials?.balanceRemainingRupees?.toLocaleString()} {receipt.financials?.balanceRemainingRupees > 0 ? '(Pending)' : '(Settled)'}
                </span>
              </div>
            </div>

            {/* Verification & Staff attribution */}
            <div className="p-3 rounded-xl bg-[#171014] border border-[#49202C] text-[11px] font-mono text-[#C7A5A8] flex flex-col sm:flex-row justify-between gap-2">
              <div>
                <span className="text-slate-500 block">Gateway / Ref:</span>
                <span className="text-slate-300 truncate">
                  {receipt.payment?.gatewayPaymentId || receipt.payment?.transactionReference || 'N/A'}
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-slate-500 block">Processed By:</span>
                <span className="text-[#D7FF00]">{receipt.payment?.processedBy || 'System Gateway'}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={handleOpenPrintable}
                className="flex items-center gap-1.5 text-xs text-[#D7FF00] hover:text-[#cbf200] underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Printable Tax Invoice
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
