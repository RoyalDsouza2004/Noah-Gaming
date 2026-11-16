import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = express.Router();

// Enforce authentication & Administrator privileges on all analytics routes
router.use(authenticate, requireAdmin);

// 1. Dashboard
router.get('/dashboard', analyticsController.getDashboardKPIs);

// 2. Revenue
router.get('/revenue', analyticsController.getRevenueAnalytics);
router.get('/revenue/by-device', analyticsController.getRevenueByDevice);
router.get('/revenue/by-game', analyticsController.getRevenueByGame);
router.get('/revenue/by-payment-method', analyticsController.getRevenueByPaymentMethod);

// 3. Bookings
router.get('/bookings', analyticsController.getBookingAnalytics);
router.get('/bookings/trends', analyticsController.getBookingTrends);

// 4. Devices
router.get('/devices/utilization', analyticsController.getDeviceUtilization);

// 5. Games
router.get('/games/performance', analyticsController.getGamePerformance);

// 6. Customers
router.get('/customers', analyticsController.getCustomerAnalytics);

// 7. Memberships
router.get('/memberships', analyticsController.getMembershipAnalytics);

// 8. Receptionists
router.get('/receptionists', analyticsController.getReceptionistPerformance);

// 9. Maintenance
router.get('/maintenance', analyticsController.getMaintenanceAnalytics);

// 10. Financial & Payments
router.get('/payments/financial', analyticsController.getFinancialPaymentReports);

export default router;
