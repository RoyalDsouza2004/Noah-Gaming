import express from 'express';
import {
  createOrder,
  verifyPayment,
  getTestSignature,
  handleWebhook,
  getPaymentById,
  recordOffline,
  getBookingPayments,
  getMyPayments,
  getPaymentReceipt,
  getPublicConfig,
  getPublicFeatures,
} from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';

const router = express.Router();

// Webhook endpoint (Raw body or parsed JSON signature-checked)
router.post('/webhook', handleWebhook);

// Public / Client checkout configuration & feature flags
router.get('/config', getPublicConfig);
router.get('/features', getPublicFeatures);

// Protected Customer & Staff Endpoints
router.use(authenticate);

// Online Payment Operations
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/test-signature', getTestSignature);

// Offline Payment Collections (Admin & Receptionist)
router.post('/offline', authorize('admin', 'receptionist'), recordOffline);

// Payment lookups & history
router.get('/my-payments', getMyPayments);
router.get('/booking/:bookingId', getBookingPayments);
router.get('/:paymentId/receipt', getPaymentReceipt);
router.get('/:paymentId', getPaymentById);

export default router;
