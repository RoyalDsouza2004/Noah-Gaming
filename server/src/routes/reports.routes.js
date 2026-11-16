import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as reportsController from '../controllers/reports.controller.js';

const router = express.Router();

/**
 * Access Control Middleware for Reports & Exports:
 * - Admin: Full access to all business, financial, and operational reports.
 * - Receptionist: Limited access to operational reports (bookings, payments, devices, receptionists, maintenance).
 * - Customer: Denied (HTTP 403).
 */
const authorizeReportAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || role === 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Customers are not authorized to access business reports.',
    });
  }

  if (role === 'admin') {
    return next();
  }

  if (role === 'receptionist') {
    const requested = (req.params.reportType || req.query.type || req.path.replace(/^\//, '')).toLowerCase();
    const operationalReports = [
      'bookings',
      'booking',
      'receptionists',
      'receptionist',
      'devices',
      'device',
      'device_utilization',
      'maintenance',
      'payments',
      'payment',
    ];

    if (operationalReports.includes(requested)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied: Receptionists may only export operational records.',
    });
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: Insufficient privileges for report export.',
  });
};

// Enforce authentication & RBAC
router.use(authenticate, authorizeReportAccess);

// Comprehensive Master Business Report
router.get('/master', (req, res, next) => {
  req.params.reportType = 'master';
  reportsController.getReportData(req, res, next);
});
router.get('/business_summary', (req, res, next) => {
  req.params.reportType = 'master';
  reportsController.getReportData(req, res, next);
});

// Standard Named Report Routes
router.get('/revenue', (req, res, next) => {
  req.params.reportType = 'revenue';
  reportsController.getReportData(req, res, next);
});

router.get('/bookings', (req, res, next) => {
  req.params.reportType = 'bookings';
  reportsController.getReportData(req, res, next);
});

router.get('/payments', (req, res, next) => {
  req.params.reportType = 'payments';
  reportsController.getReportData(req, res, next);
});

router.get('/customers', (req, res, next) => {
  req.params.reportType = 'customers';
  reportsController.getReportData(req, res, next);
});

router.get('/memberships', (req, res, next) => {
  req.params.reportType = 'memberships';
  reportsController.getReportData(req, res, next);
});

router.get('/devices', (req, res, next) => {
  req.params.reportType = 'devices';
  reportsController.getReportData(req, res, next);
});

router.get('/games', (req, res, next) => {
  req.params.reportType = 'games';
  reportsController.getReportData(req, res, next);
});

router.get('/receptionists', (req, res, next) => {
  req.params.reportType = 'receptionists';
  reportsController.getReportData(req, res, next);
});

router.get('/maintenance', (req, res, next) => {
  req.params.reportType = 'maintenance';
  reportsController.getReportData(req, res, next);
});

// Generic dynamic export routes:
router.get('/export/:reportType', reportsController.exportReportEndpoint);
router.get('/export', reportsController.exportReportEndpoint);
router.get('/:reportType', reportsController.getReportData);

export default router;
