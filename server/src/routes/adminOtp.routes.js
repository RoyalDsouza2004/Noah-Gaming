import { Router } from 'express';
import { body } from 'express-validator';
import {
  getPendingOtpRequests,
  approveOtpRequest,
  rejectOtpRequest,
  getOtpHistory,
  getDeliveryLogDetails,
} from '../controllers/adminOtp.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';
import { validate } from '../middlewares/validator.js';

const router = Router();

// Strict security: All routes require active Admin authentication
router.use(authenticate, requireAdmin);

// 1. Get Pending & Recent OTP Verification Requests
router.get('/requests', getPendingOtpRequests);

// 2. Approve OTP Request with Admin Password Re-Authentication
router.post(
  '/requests/:challengeId/approve',
  [
    body('adminPassword')
      .trim()
      .notEmpty()
      .withMessage('Administrator password is required to approve identity verification'),
  ],
  validate,
  approveOtpRequest
);

// 3. Reject OTP Request
router.post(
  '/requests/:challengeId/reject',
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters'),
  ],
  validate,
  rejectOtpRequest
);

// 4. Inspect Email Delivery Details for a specific challenge
router.get('/requests/:challengeId/delivery', getDeliveryLogDetails);

// 5. Get Verification History Audit Log
router.get('/history', getOtpHistory);

export default router;
