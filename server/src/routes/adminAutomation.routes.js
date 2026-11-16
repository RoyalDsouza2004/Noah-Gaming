import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';
import * as adminAutomationController from '../controllers/adminAutomation.controller.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

// Settings
router.get('/settings', adminAutomationController.getAutomationSettings);
router.put('/settings', adminAutomationController.updateAutomationSettings);

// Logs
router.get('/logs', adminAutomationController.getAutomationLogs);

// Manual trigger
router.post('/trigger', adminAutomationController.triggerAutomationCycle);

export default router;
