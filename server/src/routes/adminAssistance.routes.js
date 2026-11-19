import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAssistanceRequests,
  approveAssistanceRequest,
  rejectAssistanceRequest,
  getAssistanceHistory,
} from '../controllers/adminAssistance.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';
import { validate } from '../middlewares/validator.js';

const router = Router();

// Strict security: All routes require active Admin authentication
router.use(authenticate, requireAdmin);

// 1. Get Pending & Recent Admin Assistance Requests
router.get('/requests', getAssistanceRequests);

// 2. Approve Admin Assistance Request with Admin Password Re-Authentication
router.post(
  '/requests/:challengeId/approve',
  [
    body('adminPassword')
      .trim()
      .notEmpty()
      .withMessage('Administrator password is required to approve verification assistance'),
  ],
  validate,
  approveAssistanceRequest
);

// 3. Reject Admin Assistance Request
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
  rejectAssistanceRequest
);

// 4. Get Assistance Request History Audit Log
router.get('/history', getAssistanceHistory);

export default router;
