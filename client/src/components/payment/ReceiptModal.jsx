import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { paymentApi } from '../../api/payment.js';
import { showToast } from '../../utils/toast.js';
import { format12HourRange } from '../../utils/timeFormat.js';
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
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  Loader2,
  Crown,
  Sparkles,
} from 'lucide-react';

/**
 * Generate a standalone, pristine HTML document for native A4 browser printing
 */
const generatePrintHtml = (receipt) => {
  const isMembership = receipt.isMembership || Boolean(receipt.membership);
  const status = (receipt.payment?.status || 'PAID').toUpperCase();
  const isSettled = !receipt.financials?.balanceRemainingRupees || receipt.financials?.balanceRemainingRupees === 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${receipt.receiptNumber || 'NOAH_RECEIPT'} | NOAH GAMING</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #FFFFFF;
      color: #171923;
      line-height: 1.5;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 10px;
    }
    .receipt-container {
      max-width: 680px;
      margin: 0 auto;
      border: 1px solid #E2E5EC;
      border-radius: 12px;
      padding: 28px;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #851B2B;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      color: #851B2B;
      letter-spacing: 1.5px;
    }
    .brand-tagline {
      font-size: 10px;
      font-weight: 800;
      color: #414858;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .brand-sub {
      font-size: 10px;
      color: #718096;
      margin-top: 3px;
    }
    .badge-status {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: #E8F5E9;
      color: #176B3A;
      border: 1px solid #A5D6A7;
    }
    .badge-status.unsettled {
      background: #FFFBEB;
      color: #B45309;
      border-color: #FCD34D;
    }
    .receipt-no {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #851B2B;
      margin-top: 6px;
      text-align: right;
    }
    .issue-date {
      font-size: 10px;
      color: #718096;
      text-align: right;
      margin-top: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #F8F9FC;
      border: 1px solid #E2E5EC;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #414858;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .field-val {
      font-weight: 600;
      color: #171923;
    }
    .field-val-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600;
      color: #171923;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #851B2B;
      margin-bottom: 8px;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E2E5EC;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .spec-table th {
      background: #F8F9FC;
      color: #414858;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 9px 12px;
      text-align: left;
      border-bottom: 1px solid #E2E5EC;
    }
    .spec-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #E2E5EC;
      color: #171923;
    }
    .spec-table tr:last-child td {
      border-bottom: none;
    }
    .fin-box {
      background: #F8F9FC;
      border: 1px solid #E2E5EC;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .fin-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      color: #414858;
      font-size: 12px;
    }
    .fin-row-highlight {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-top: 1px solid #E2E5EC;
      border-bottom: 1px solid #E2E5EC;
      margin: 8px 0;
      font-size: 14px;
      font-weight: 800;
      color: #171923;
    }
    .fin-paid {
      color: #176B3A;
      font-size: 16px;
      font-weight: 800;
    }
    .fin-balance-settled {
      color: #176B3A;
      font-weight: 700;
    }
    .fin-balance-due {
      color: #B45309;
      font-weight: 700;
    }
    .audit-box {
      background: #FFFFFF;
      border: 1px solid #E2E5EC;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #414858;
      margin-bottom: 20px;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #718096;
      border-top: 1px solid #E2E5EC;
      padding-top: 14px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header-bar">
      <div>
        <div class="brand-title">NOAH GAMING</div>
        <div class="brand-tagline">PLAY • CHILL • CONNECT</div>
        <div class="brand-sub">Premium Esports, PS5 Lounges & Pool Tables</div>
      </div>
      <div>
        <div style="text-align: right;">
          <span class="badge-status ${status !== 'PAID' ? 'unsettled' : ''}">${status}</span>
        </div>
        <div class="receipt-no">${receipt.receiptNumber || 'N/A'}</div>
        <div class="issue-date">${receipt.issuedAtIST || ''}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="field-label">Receipt Number</div>
        <div class="field-val-mono" style="color: #851B2B;">${receipt.receiptNumber || 'N/A'}</div>
      </div>
      <div style="text-align: right;">
        <div class="field-label">Issue Date (IST)</div>
        <div class="field-val">${receipt.issuedAtIST || 'N/A'}</div>
      </div>
      <div>
        <div class="field-label">Customer Details</div>
        <div class="field-val" style="font-size: 13px;">${receipt.customer?.name || 'Walk-In Player'}</div>
        <div style="font-size: 10px; color: #851B2B; font-weight: 700;">${receipt.customer?.customerId || ''}</div>
        <div style="font-size: 10px; color: #718096;">
          ${receipt.customer?.email !== 'N/A' ? receipt.customer?.email : ''} ${receipt.customer?.phone !== 'N/A' ? '• ' + receipt.customer?.phone : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div class="field-label">Payment ID</div>
        <div class="field-val-mono" style="font-size: 11px;">${receipt.payment?.paymentId || 'N/A'}</div>
        <div style="font-size: 10px; color: #718096; margin-top: 2px;">Method: ${receipt.payment?.method || 'N/A'} (${receipt.payment?.gateway || 'OFFLINE'})</div>
      </div>
    </div>

    ${isMembership ? `
      <div class="section-title">Club Membership Specification</div>
      <table class="spec-table">
        <tr>
          <th>Plan Tier</th>
          <th>Validity Duration</th>
          <th>Benefit Scope</th>
          <th>Eligible Stations</th>
        </tr>
        <tr>
          <td style="font-weight: 700;">${receipt.membership?.planName || 'Club Membership'}</td>
          <td class="field-val-mono">${receipt.membership?.validityDuration || 30} ${receipt.membership?.validityUnit || 'DAYS'}</td>
          <td style="color: #176B3A; font-weight: 600;">${receipt.membership?.isUnlimited ? 'Unlimited Lounge Gaming Access' : 'Club Member Discounted Hourly Rates'}</td>
          <td style="color: #414858;">All Lounge PS5 Stations & Pool Tables</td>
        </tr>
      </table>
    ` : `
      <div class="section-title">Gaming Session Specification</div>
      <table class="spec-table">
        <tr>
          <th>Station / Console</th>
          <th>Title / Game</th>
          <th>Schedule (IST)</th>
          <th>Mode & Players</th>
        </tr>
        <tr>
          <td style="font-weight: 700;">${receipt.session?.deviceName || 'Station'} (${receipt.session?.deviceType || 'PS5'})</td>
          <td style="font-weight: 600;">${receipt.session?.gameTitle || 'Lounge Gaming'}</td>
          <td class="field-val-mono">${receipt.session?.bookingDate || ''} • ${format12HourRange(receipt.session?.startTime, receipt.session?.endTime)} (${receipt.session?.durationHours || 1}h)</td>
          <td>${receipt.session?.bookingType || 'SHARED'} • ${receipt.session?.numberOfPlayers || 1} Player(s)</td>
        </tr>
      </table>
    `}

    <div class="fin-box">
      <div class="fin-row">
        <span>Total ${isMembership ? 'Plan Fee' : 'Booking Amount'}:</span>
        <span style="color: #171923; font-weight: 700;">₹${Number(receipt.financials?.totalBookingAmountRupees || 0).toLocaleString()}</span>
      </div>

      <div class="fin-row-highlight">
        <span>Amount Paid in This Transaction (${receipt.payment?.purpose || 'PAYMENT'}):</span>
        <span class="fin-paid">₹${Number(receipt.financials?.amountPaidInThisTxRupees || 0).toLocaleString()}</span>
      </div>

      <div class="fin-row">
        <span>Cumulative Amount Paid to Date:</span>
        <span style="color: #176B3A; font-weight: 700;">₹${Number(receipt.financials?.totalAmountPaidRupees || 0).toLocaleString()}</span>
      </div>

      <div class="fin-row" style="margin-bottom: 0;">
        <span>Outstanding Balance Remaining:</span>
        <span class="${isSettled ? 'fin-balance-settled' : 'fin-balance-due'}">
          ₹${Number(receipt.financials?.balanceRemainingRupees || 0).toLocaleString()} ${isSettled ? '(Settled)' : '(Pending)'}
        </span>
      </div>
    </div>

    <div class="audit-box">
      <div>
        <span style="color: #718096; display: block; font-size: 10px;">GATEWAY / TRANSACTION REF:</span>
        <span style="font-weight: 600; color: #171923;">${receipt.payment?.gatewayPaymentId || receipt.payment?.transactionReference || 'N/A'}</span>
      </div>
      <div style="text-align: right;">
        <span style="color: #718096; display: block; font-size: 10px;">PROCESSED BY:</span>
        <span style="font-weight: 700; color: #851B2B;">${receipt.payment?.processedBy || 'System Gateway'}</span>
      </div>
    </div>

    <div class="footer">
      NOAH GAMING ENTERTAINMENT LLP • Official Computer-Generated Tax Invoice • No signature required under IT Act<br>
      Bengaluru, Karnataka, India • support@noahgaming.com
    </div>
  </div>
</body>
</html>`;
};

export const ReceiptModal = ({ paymentId, bookingId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [availableBookingPayments, setAvailableBookingPayments] = useState([]);
  const [selectedTxPaymentId, setSelectedTxPaymentId] = useState(paymentId || null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);

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

  /**
   * Reliable Native Browser Print:
   * Writes the receipt HTML to an isolated invisible iframe, eliminating popup blocker issues,
   * modal backdrops, and navigation chrome, perfectly formatted for A4 printing.
   */
  const handlePrint = () => {
    if (!receipt) return;
    setPrinting(true);

    try {
      const existingIframe = document.getElementById('receipt-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const htmlContent = generatePrintHtml(receipt);
      const frameDoc = iframe.contentWindow || iframe.contentDocument;
      const doc = frameDoc.document || frameDoc;

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (printErr) {
          console.warn('Iframe print error, falling back to window.print():', printErr);
          window.print();
        } finally {
          setPrinting(false);
        }
      }, 300);
    } catch (err) {
      console.error('Failed to trigger native print:', err);
      window.print();
      setPrinting(false);
    }
  };

  /**
   * Open dedicated printable tax invoice URL in new window with fallback to native print
   */
  const handleOpenPrintable = () => {
    const idToPrint = receipt?.payment?.paymentId || selectedTxPaymentId || paymentId;
    if (!idToPrint) return;
    const url = paymentApi.getReceiptHtmlUrl(idToPrint);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Browser popup blocker intervened; immediately trigger native print
      handlePrint();
    }
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
        return <Banknote className="w-4 h-4 text-[#176B3A] dark:text-emerald-400" />;
      case 'COUNTER_UPI':
      case 'UPI':
        return <Smartphone className="w-4 h-4 text-[#851B2B] dark:text-[#D7FF00]" />;
      default:
        return <CreditCard className="w-4 h-4 text-amber-700 dark:text-[#F5B942]" />;
    }
  };

  const isMembership = receipt?.isMembership || Boolean(receipt?.membership);
  const isSettled = !receipt?.financials?.balanceRemainingRupees || receipt?.financials?.balanceRemainingRupees === 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-fadeIn print:hidden">
      {/* Scoped print rules for the document */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt-modal,
          #printable-receipt-modal * {
            visibility: visible !important;
          }
          #printable-receipt-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: 1px solid #E2E5EC !important;
            background: #FFFFFF !important;
            color: #171923 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="printable-receipt-modal"
        className="w-full max-w-xl my-auto bg-white dark:bg-[#260D17] border border-[#E2E5EC] dark:border-[#49202C] rounded-3xl shadow-2xl text-[#171923] dark:text-[#FFF4E8] overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        {/* Receipt Header Banner */}
        <div className="p-6 bg-white dark:bg-gradient-to-r dark:from-[#851B2B]/25 dark:via-[#260D17] dark:to-[#851B2B]/25 border-b border-[#E2E5EC] dark:border-[#49202C] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#851B2B]/30 text-[#851B2B] dark:text-[#D7FF00] border border-[#E2E5EC] dark:border-[#851B2B] flex items-center justify-center font-bold shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#851B2B] dark:text-[#D7FF00] font-bold">
                Official Digital Receipt
              </span>
              <h3 className="text-xl font-black font-heading text-[#171923] dark:text-[#FFF4E8]">
                NOAH GAMING
              </h3>
              <p className="text-[9px] font-bold text-[#851B2B] dark:text-[#F5B942] tracking-widest uppercase">
                PLAY • CHILL • CONNECT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            {receipt && (
              <>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#851B2B] to-[#b3243a] hover:from-[#9c2033] hover:to-[#c42840] text-white text-xs font-bold font-heading transition-colors shadow-md border border-[#F5B942]/30 disabled:opacity-50"
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
                  onClick={handlePrint}
                  disabled={printing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#851B2B] hover:bg-[#6E1623] active:bg-[#5E121E] text-white text-xs font-bold font-heading transition-colors shadow-md shadow-[#851B2B]/20 disabled:opacity-50"
                  title="Print or Save as PDF"
                >
                  {printing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  Print / Save
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#414858] hover:text-[#171923] border border-[#E2E5EC] dark:bg-[#171014] dark:border-transparent dark:hover:bg-[#851B2B]/30 dark:text-[#C7A5A8] dark:hover:text-[#FFF4E8] transition-colors"
              title="Close Receipt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Transaction Switcher if multiple payments exist for booking */}
        {availableBookingPayments.length > 1 && (
          <div className="px-6 py-2.5 bg-[#F8F9FC] dark:bg-[#171014] border-b border-[#E2E5EC] dark:border-[#49202C] flex items-center gap-2 overflow-x-auto text-xs font-mono no-print">
            <span className="text-[10px] uppercase text-[#414858] dark:text-[#C7A5A8] font-bold whitespace-nowrap">Transactions:</span>
            {availableBookingPayments.map((p, idx) => {
              const pId = p.paymentId || p._id;
              const isSelected = pId === selectedTxPaymentId;
              return (
                <button
                  key={pId}
                  onClick={() => handleSelectTransaction(pId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#851B2B] text-white border border-[#851B2B] shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-[#414858] dark:text-slate-400 border border-[#E2E5EC] dark:border-slate-800 hover:text-[#171923] dark:hover:text-white'
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
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#851B2B] dark:text-[#D7FF00]" />
            <p className="text-xs font-mono font-medium">Generating verified digital receipt...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center mx-auto">
              <X className="w-6 h-6" />
            </div>
            <p className="text-sm text-rose-600 dark:text-rose-300 font-medium">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Receipt Content */}
        {receipt && !loading && (
          <div className="p-6 space-y-6">
            {/* Top Meta info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-[#F8F9FC] dark:bg-[#171014] border border-[#E2E5EC] dark:border-[#49202C] text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-[#414858] dark:text-[#C7A5A8] block font-semibold">Receipt Number</span>
                <span className="text-[#851B2B] dark:text-[#D7FF00] font-bold text-sm">{receipt.receiptNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#414858] dark:text-[#C7A5A8] block font-semibold">Issue Date (IST)</span>
                <span className="text-[#171923] dark:text-slate-300 font-medium">{receipt.issuedAtIST}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#414858] dark:text-[#C7A5A8] block font-semibold">Customer Details</span>
                <span className="text-[#171923] dark:text-white font-sans font-bold block">{receipt.customer?.name}</span>
                <span className="text-[10px] text-[#851B2B] dark:text-[#D7FF00] font-bold block">{receipt.customer?.customerId}</span>
                <span className="text-[10px] text-[#414858] dark:text-[#C7A5A8] block truncate font-medium">
                  {receipt.customer?.email !== 'N/A' ? receipt.customer?.email : ''} {receipt.customer?.phone !== 'N/A' ? '• ' + receipt.customer?.phone : ''}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#414858] dark:text-[#C7A5A8] block font-semibold">Payment Status</span>
                <span className="inline-flex items-center gap-1 text-[#176B3A] dark:text-[#45C987] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {receipt.payment?.status}
                </span>
                <span className="text-[10px] text-[#414858] dark:text-slate-400 block mt-0.5">
                  ID: {receipt.payment?.paymentId}
                </span>
              </div>
            </div>

            {/* MEMBERSHIP SPECIFICATION (If membership payment) */}
            {isMembership ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#851B2B] dark:text-[#F5B942] font-heading flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-[#851B2B] dark:text-[#F5B942]" /> Club Membership Specification
                </h4>

                <div className="p-4 rounded-2xl bg-[#F8F9FC] dark:bg-[#171014] border border-[#E2E5EC] dark:border-[#49202C] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium">Plan Tier</span>
                    <span className="font-bold text-[#171923] dark:text-white font-heading text-sm">
                      {receipt.membership?.planName || receipt.session?.rateScheme}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> Validity Duration
                    </span>
                    <span className="font-mono text-[#171923] dark:text-white font-semibold">
                      {receipt.membership?.validityDuration} {receipt.membership?.validityUnit || 'DAYS'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-[#F5B942]" /> Benefit Scope
                    </span>
                    <span className="font-semibold text-[#176B3A] dark:text-emerald-400">
                      {receipt.membership?.isUnlimited ? 'Unlimited Lounge Gaming Access' : 'Club Member Discounted Hourly Rates'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[#414858] dark:text-[#C7A5A8] font-medium">
                    <span>Eligible Stations</span>
                    <span className="font-mono text-[#414858] dark:text-slate-300">
                      All Lounge PS5 Stations & Pool Tables Included
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* BOOKING SESSION SPECIFICATION */
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#414858] dark:text-[#C7A5A8] font-heading">
                  Session Specification
                </h4>

                <div className="p-4 rounded-2xl bg-[#F8F9FC] dark:bg-[#171014] border border-[#E2E5EC] dark:border-[#49202C] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-amber-600 dark:text-[#F5B942]" /> Station
                    </span>
                    <span className="font-semibold text-[#171923] dark:text-white font-mono">
                      {receipt.session?.deviceName} ({receipt.session?.deviceType})
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium flex items-center gap-1.5">
                      <Gamepad2 className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> Title / Game
                    </span>
                    <span className="font-semibold text-[#171923] dark:text-white">
                      {receipt.session?.gameTitle}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-[#F5B942]" /> Schedule (IST)
                    </span>
                    <span className="font-mono text-[#414858] dark:text-slate-300 font-medium">
                      {receipt.session?.bookingDate} • {format12HourRange(receipt.session?.startTime, receipt.session?.endTime)} ({receipt.session?.durationHours}h)
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#E2E5EC] dark:border-[#49202C]/60">
                    <span className="text-[#414858] dark:text-[#C7A5A8] font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#851B2B] dark:text-[#D7FF00]" /> Mode & Players
                    </span>
                    <span className="font-mono text-[#414858] dark:text-slate-300 font-medium">
                      {receipt.session?.bookingType} • {receipt.session?.numberOfPlayers} Player(s)
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[#414858] dark:text-[#C7A5A8] font-medium">
                    <span>Rate Scheme</span>
                    <span className="font-mono text-[#414858] dark:text-slate-300">
                      {receipt.session?.rateScheme} {receipt.session?.ratePerUnitRupees > 0 ? `(₹${receipt.session?.ratePerUnitRupees}/hr)` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Summary Card */}
            <div className="p-4 rounded-2xl bg-[#F8F9FC] dark:bg-gradient-to-br dark:from-[#171014] dark:to-[#260D17] border border-[#E2E5EC] dark:border-[#49202C] space-y-2 text-xs font-mono shadow-sm">
              <div className="flex justify-between text-[#414858] dark:text-[#C7A5A8] font-medium">
                <span>Total {isMembership ? 'Plan Fee' : 'Booking Amount'}:</span>
                <span className="text-[#171923] dark:text-white font-bold">₹{receipt.financials?.totalBookingAmountRupees?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-[#171923] dark:text-white font-bold text-sm py-2 border-y border-[#E2E5EC] dark:border-[#49202C]">
                <span className="flex items-center gap-1.5 text-[#171923] dark:text-white">
                  {getMethodIcon(receipt.payment?.method)}
                  Amount Paid in This Transaction ({receipt.payment?.purpose}):
                </span>
                <span className="text-[#176B3A] dark:text-[#45C987] text-base font-extrabold">₹{receipt.financials?.amountPaidInThisTxRupees?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-[#414858] dark:text-slate-300 pt-1 font-medium">
                <span>Cumulative Amount Paid to Date:</span>
                <span className="text-[#176B3A] dark:text-[#45C987] font-bold">₹{receipt.financials?.totalAmountPaidRupees?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-[#414858] dark:text-slate-300 font-medium">
                <span>Outstanding Balance Remaining:</span>
                <span className={!isSettled ? 'text-amber-700 dark:text-[#F5B942] font-bold' : 'text-[#176B3A] dark:text-[#45C987] font-bold'}>
                  ₹{receipt.financials?.balanceRemainingRupees?.toLocaleString()} {!isSettled ? '(Pending)' : '(Settled)'}
                </span>
              </div>
            </div>

            {/* Verification & Staff attribution */}
            <div className="p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#171014] border border-[#E2E5EC] dark:border-[#49202C] text-[11px] font-mono text-[#414858] dark:text-[#C7A5A8] flex flex-col sm:flex-row justify-between gap-2">
              <div>
                <span className="text-[#414858] dark:text-slate-500 block font-medium">Gateway / Ref:</span>
                <span className="text-[#171923] dark:text-slate-300 font-semibold truncate">
                  {receipt.payment?.gatewayPaymentId || receipt.payment?.transactionReference || 'N/A'}
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[#414858] dark:text-slate-500 block font-medium">Processed By:</span>
                <span className="text-[#851B2B] dark:text-[#D7FF00] font-bold">{receipt.payment?.processedBy || 'System Gateway'}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-2 no-print">
              <button
                onClick={handleOpenPrintable}
                className="flex items-center gap-1.5 text-xs text-[#851B2B] hover:text-[#5e121e] dark:text-[#D7FF00] dark:hover:text-[#cbf200] underline font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Printable Tax Invoice
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
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
