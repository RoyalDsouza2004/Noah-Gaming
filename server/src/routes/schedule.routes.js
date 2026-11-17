import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';
import * as scheduleController from '../controllers/schedule.controller.js';

const router = express.Router();

// Public / Client / Staff routes
router.get('/operating-status', scheduleController.getOperatingStatus);
router.get('/effective-day', scheduleController.getEffectiveDay);

// Protected Admin Routes
router.get('/admin/operating-hours', authenticate, requireAdmin, scheduleController.getAdminWeeklyHours);
router.put('/admin/operating-hours', authenticate, requireAdmin, scheduleController.updateAdminWeeklyHours);

router.get('/admin/holidays', authenticate, requireAdmin, scheduleController.getAdminHolidays);
router.post('/admin/holidays', authenticate, requireAdmin, scheduleController.createAdminHoliday);
router.put('/admin/holidays/:id', authenticate, requireAdmin, scheduleController.updateAdminHoliday);
router.delete('/admin/holidays/:id', authenticate, requireAdmin, scheduleController.deleteAdminHoliday);

router.post('/admin/check-conflicts', authenticate, requireAdmin, scheduleController.checkConflicts);

export default router;
