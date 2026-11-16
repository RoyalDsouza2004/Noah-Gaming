import { showToast } from './toast.js';

let scriptLoadingPromise = null;
let isCheckoutActive = false;

/**
 * Dynamically and securely loads the official Razorpay Checkout SDK script
 * @returns {Promise<boolean>}
 */
export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve) => {
      // Check if already injected
      const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existingScript) {
        if (window.Razorpay) return resolve(true);
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error('[Razorpay] Failed to load official checkout script from CDN');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  return scriptLoadingPromise;
}

/**
 * Opens official Razorpay Test Mode Checkout window with guard against multiple instances
 * @param {Object} params
 * @param {Object} params.order - Backend order payload ({ orderId, amount, currency, keyId, ... })
 * @param {Object} [params.prefill] - Customer prefill ({ name, email, phone })
 * @param {string} [params.description] - Booking or membership description
 * @param {Function} params.onSuccess - Callback on verified payment ({ orderId, paymentId, signature })
 * @param {Function} [params.onError] - Callback on payment failure
 * @param {Function} [params.onDismiss] - Callback on user cancel / close
 * @returns {Promise<boolean>} Whether checkout opened successfully
 */
export async function launchRazorpayCheckout({
  order,
  prefill = {},
  description = '',
  onSuccess,
  onError,
  onDismiss,
}) {
  if (isCheckoutActive) {
    showToast.error('A checkout window is already in progress.');
    return false;
  }

  if (!order || !order.orderId || !order.keyId) {
    showToast.error('Invalid payment order configuration received from server.');
    return false;
  }

  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    showToast.error('Unable to initialize Razorpay Checkout script. Check your internet connection.');
    return false;
  }

  try {
    isCheckoutActive = true;

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'NOAH GAMING',
      description: description || `Reservation ${order.bookingId || order.orderId} (Test Mode)`,
      order_id: order.orderId,
      modal: {
        confirm_close: true,
        ondismiss: function () {
          isCheckoutActive = false;
          showToast.info('Payment checkout closed. Your reservation slot is held for 15 minutes.');
          if (onDismiss) onDismiss();
        },
      },
      handler: async function (response) {
        isCheckoutActive = false;
        try {
          if (onSuccess) {
            await onSuccess({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
          }
        } catch (err) {
          showToast.error(err.message || 'Signature verification error');
          if (onError) onError(err);
        }
      },
      prefill: {
        name: prefill.name || 'NOAH Gamer',
        email: prefill.email || '',
        contact: prefill.phone || '',
      },
      theme: {
        color: '#851B2B', // NOAH GAMING Burgundy
        backdrop_color: 'rgba(23, 16, 20, 0.95)',
      },
      notes: {
        platform: 'NOAH GAMING',
        mode: 'test',
      },
    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', function (resp) {
      isCheckoutActive = false;
      const errorMsg =
        resp?.error?.description ||
        resp?.error?.reason ||
        'Payment was declined by payment gateway.';
      showToast.error(`Payment Failed: ${errorMsg}`);
      if (onError) onError(resp.error);
    });

    rzp.open();
    return true;
  } catch (err) {
    isCheckoutActive = false;
    showToast.error(`Could not open payment checkout: ${err.message}`);
    return false;
  }
}
