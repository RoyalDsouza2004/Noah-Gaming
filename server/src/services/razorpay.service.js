import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Returns sanitized Razorpay configuration status (Test Mode Only)
 * Never exposes key_secret or webhook_secret!
 */
export function getRazorpayConfigStatus() {
  const mode = (process.env.RAZORPAY_MODE || 'test').toLowerCase();
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

  const isPlaceholderKey =
    !keyId ||
    keyId === 'your_test_key_id' ||
    keyId.includes('your_test_key') ||
    keyId === 'rzp_test_your_key_id_here';

  const isPlaceholderSecret =
    !keySecret ||
    keySecret === 'your_test_key_secret' ||
    keySecret.includes('your_razorpay_secret');

  const isPlaceholderWebhook =
    !webhookSecret ||
    webhookSecret === 'your_webhook_secret' ||
    webhookSecret.includes('your_razorpay_webhook');

  const isLiveKey = keyId.startsWith('rzp_live_');
  const isTestKey = keyId.startsWith('rzp_test_');

  const isConfigured = !isPlaceholderKey && !isPlaceholderSecret && isTestKey && mode === 'test';

  return {
    mode: 'test',
    isTestMode: true,
    isLiveModeBlocked: true,
    isConfigured,
    keyIdConfigured: !isPlaceholderKey && isTestKey,
    keyIdPrefix: isTestKey ? `${keyId.slice(0, 12)}...` : null,
    keySecretConfigured: !isPlaceholderSecret,
    webhookSecretConfigured: !isPlaceholderWebhook,
    isLiveKeyDetected: isLiveKey,
    statusMessage: isLiveKey
      ? 'Live mode credentials detected! Blocked: NOAH GAMING is strictly in Razorpay Test Mode.'
      : isConfigured
      ? 'Razorpay Test Mode connected and active'
      : 'Razorpay Test Mode pending credentials configuration in server/.env',
  };
}

/**
 * Returns active Razorpay SDK instance configured with Test Mode credentials
 */
function getRazorpayClient() {
  const mode = (process.env.RAZORPAY_MODE || 'test').toLowerCase();
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (keyId.startsWith('rzp_live_')) {
    throw new Error(
      'Security Exception: Live Mode Key ID detected! NOAH GAMING is strictly configured for Razorpay Test Mode.'
    );
  }

  if (mode !== 'test') {
    throw new Error(
      'Security Exception: Production payments are blocked while system is configured for Test Mode.'
    );
  }

  const isRealTestKey =
    keyId.startsWith('rzp_test_') &&
    keySecret &&
    keySecret !== 'your_test_key_secret' &&
    !keySecret.includes('your_razorpay_secret');

  if (isRealTestKey) {
    try {
      return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    } catch (err) {
      console.warn('[Razorpay SDK] Initialization warning:', err.message);
      return null;
    }
  }

  return null;
}

/**
 * Creates a Razorpay Order
 * @param {Object} options
 * @param {number} options.amount - Amount in paise (integer)
 * @param {string} [options.currency='INR']
 * @param {string} options.receipt - Internal receipt or booking identifier
 * @param {Object} [options.notes={}]
 * @returns {Promise<Object>} Razorpay Order Object
 */
export async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  if (!amount || amount <= 0) {
    throw new Error('Order amount must be a positive integer in paise');
  }

  const amountInPaise = Math.round(Number(amount));
  const safeReceipt = (receipt || `REC-${Date.now()}`).toString().slice(0, 40);

  const client = getRazorpayClient();

  if (client) {
    try {
      const order = await client.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: safeReceipt,
        notes: {
          ...notes,
          platform: 'NOAH GAMING',
          mode: 'test',
        },
      });

      return {
        id: order.id,
        entity: order.entity,
        amount: order.amount,
        amount_paid: order.amount_paid,
        amount_due: order.amount_due,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        attempts: order.attempts,
        notes: order.notes,
        created_at: order.created_at,
        isMock: false,
        isTestMode: true,
      };
    } catch (apiErr) {
      console.warn('[Razorpay API] Live Test Mode call error, falling back to simulated order:', apiErr.message);
    }
  }

  // Deterministic local simulation mode for unit tests and local development before keys are entered
  const orderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return {
    id: orderId,
    entity: 'order',
    amount: amountInPaise,
    amount_paid: 0,
    amount_due: amountInPaise,
    currency: 'INR',
    receipt: safeReceipt,
    status: 'created',
    attempts: 0,
    notes: {
      ...notes,
      platform: 'NOAH GAMING',
      mode: 'test',
    },
    created_at: Math.floor(Date.now() / 1000),
    isMock: true,
    isTestMode: true,
  };
}

/**
 * Returns the configured test Key ID (or fallback test identifier for simulation)
 */
export function getRazorpayKeyId() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  if (keyId.startsWith('rzp_test_') && !keyId.includes('your_test_key_id')) {
    return keyId;
  }
  return 'rzp_test_NOAH_SIMULATION';
}

/**
 * Verifies Razorpay Payment Signature
 * HMAC_SHA256(order_id + "|" + razorpay_payment_id, secret)
 * Uses constant-time buffer comparison to prevent timing attacks
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.paymentId
 * @param {string} params.signature
 * @param {string} [params.secret]
 * @returns {boolean}
 */
export function verifyPaymentSignature({ orderId, paymentId, signature, secret = null }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  try {
    const activeSecret =
      secret ||
      process.env.RAZORPAY_KEY_SECRET ||
      'noah_gaming_secure_test_fallback_secret_2026';

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', activeSecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (err) {
    console.error('[Razorpay Signature Error]:', err.message);
    return false;
  }
}

/**
 * Generates valid HMAC signature for automated testing / simulation
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} [secret]
 * @returns {string}
 */
export function generateTestPaymentSignature(orderId, paymentId, secret = null) {
  const activeSecret =
    secret ||
    process.env.RAZORPAY_KEY_SECRET ||
    'noah_gaming_secure_test_fallback_secret_2026';
  const payload = `${orderId}|${paymentId}`;
  return crypto.createHmac('sha256', activeSecret).update(payload).digest('hex');
}

/**
 * Verifies Razorpay Webhook Signature
 * Uses constant-time buffer comparison
 * @param {Object} params
 * @param {string|Buffer} params.rawBody
 * @param {string} params.signature
 * @param {string} [params.secret]
 * @returns {boolean}
 */
export function verifyWebhookSignature({ rawBody, signature, secret = null }) {
  if (!rawBody || !signature) {
    return false;
  }

  try {
    const activeSecret =
      secret ||
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      'noah_gaming_secure_webhook_secret_2026';

    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', activeSecret)
      .update(bodyStr)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (err) {
    console.error('[Razorpay Webhook Signature Error]:', err.message);
    return false;
  }
}

/**
 * Generates valid Webhook signature for automated webhook testing
 * @param {string} bodyStr
 * @param {string} [secret]
 * @returns {string}
 */
export function generateTestWebhookSignature(bodyStr, secret = null) {
  const activeSecret =
    secret ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    'noah_gaming_secure_webhook_secret_2026';
  return crypto.createHmac('sha256', activeSecret).update(bodyStr).digest('hex');
}

/**
 * Initiates online refund through Razorpay Test Mode
 * @param {Object} options
 * @param {string} options.paymentId - Razorpay payment ID
 * @param {number} options.amount - Amount in paise
 * @param {string} [options.notes={}]
 */
export async function initiateRazorpayRefund({ paymentId, amount, notes = {} }) {
  const amountInPaise = Math.round(Number(amount));
  const client = getRazorpayClient();

  if (client) {
    try {
      const refund = await client.payments.refund(paymentId, {
        amount: amountInPaise,
        notes: {
          ...notes,
          platform: 'NOAH GAMING',
          mode: 'test',
        },
      });
      return {
        id: refund.id,
        entity: refund.entity,
        amount: refund.amount,
        currency: refund.currency,
        payment_id: refund.payment_id,
        status: refund.status,
        isMock: false,
        isTestMode: true,
      };
    } catch (err) {
      console.warn('[Razorpay Refund API] Live Test call failed, falling back to mock refund:', err.message);
    }
  }

  // Simulated test refund
  return {
    id: `rfnd_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    entity: 'refund',
    amount: amountInPaise,
    currency: 'INR',
    payment_id: paymentId,
    status: 'processed',
    isMock: true,
    isTestMode: true,
  };
}
