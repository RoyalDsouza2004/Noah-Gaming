import express from 'express';
import {
  getAdminPayments,
  getRevenueReports,
  getFinancialReconciliation,
  issueRefund,
  getRefundsList,
  getPaymentSettings,
} from '../controllers/adminPayment.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';

const router = express.Router();

router.use(authenticate);

// Transactions List (Admin and Receptionist can view transactions)
router.get('/payments', authorize('admin', 'receptionist'), getAdminPayments);

// Razorpay Test Mode Gateway Settings (Admin Only)
router.get('/payments/settings', authorize('admin'), getPaymentSettings);

// Revenue Reports & Analytics (Admin Only)
router.get('/payments/reports', authorize('admin'), getRevenueReports);

// Financial Reconciliation Audit Trail (Admin and Receptionist can view)
router.get('/payments/reconciliation', authorize('admin', 'receptionist'), getFinancialReconciliation);

// Refund Operations (Admin Only)
router.post('/payments/:paymentId/refund', authorize('admin'), issueRefund);
router.get('/refunds', authorize('admin'), getRefundsList);
router.get('/payments/refunds/list', authorize('admin'), getRefundsList);

export default router;
