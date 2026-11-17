import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireStaff, requireAdmin } from '../middlewares/rbac.js';
import * as receptionistController from '../controllers/receptionist.controller.js';

const router = express.Router();

// All receptionist endpoints require authentication and Staff role (receptionist or admin)
router.use(authenticate, requireStaff);

// 1. Dashboard
router.get('/dashboard', receptionistController.getDashboardStats);

// 2. Customers
router.get('/customers/search', receptionistController.searchCustomers);
router.post('/customers', receptionistController.registerCustomer);
router.get('/customers/:id', receptionistController.getCustomerDetails);

// 3. Bookings & Walk-ins
router.post('/bookings', receptionistController.createWalkIn);
router.get('/bookings/today', receptionistController.getTodayBookingsHandler);
router.get('/bookings/upcoming', receptionistController.getUpcomingBookingsHandler);
router.get('/bookings/:id', receptionistController.getBookingDetails);
router.post('/bookings/:id/check-in', receptionistController.checkIn);
router.post('/bookings/:id/no-show', receptionistController.markNoShow);

// 4. Live Sessions
router.get('/sessions/active', receptionistController.getActiveSessionsHandler);
router.post('/sessions/:id/start', receptionistController.startSessionHandler);
router.get('/sessions/:id/preview-extension', receptionistController.previewExtensionHandler);
router.post('/sessions/:id/extend', receptionistController.extendSessionHandler);
router.post('/sessions/:id/complete', receptionistController.completeSessionHandler);

// 5. Payments
router.post('/payments/offline', receptionistController.collectOfflinePayment);
router.get('/payments/pending', receptionistController.getPendingPaymentsHandler);

// 6. Activity Logs (Admin Only)
router.get('/activity-logs', requireAdmin, receptionistController.getActivityLogsHandler);

export default router;
