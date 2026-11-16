import { Router } from 'express';
import { body } from 'express-validator';
import {
  getEmailStatus,
  getEmailLogs,
  triggerTestEmail,
  retryEmailDispatch,
} from '../controllers/adminEmail.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';
import { validate } from '../middlewares/validator.js';

const router = Router();

// Require admin authentication for all email management routes
router.use(authenticate, requireAdmin);

router.get('/status', getEmailStatus);
router.get('/logs', getEmailLogs);

router.post(
  '/test',
  [
    body('recipient')
      .trim()
      .notEmpty()
      .withMessage('Recipient email address is required')
      .isEmail()
      .withMessage('Please provide a valid recipient email address')
      .normalizeEmail(),
  ],
  validate,
  triggerTestEmail
);

router.post('/retry/:id', retryEmailDispatch);

export default router;
