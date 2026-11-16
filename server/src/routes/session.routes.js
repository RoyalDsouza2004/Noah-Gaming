import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireStaff } from '../middlewares/rbac.js';
import * as sessionController from '../controllers/session.controller.js';

const router = express.Router();

// Require authenticated user for all session endpoints
router.use(authenticate);

// Active sessions list (Customers see their active sessions; Staff see all lounge active sessions)
router.get('/active', sessionController.getActiveSessions);

// Get specific session
router.get('/:id', sessionController.getSessionById);

// Staff actions: Start, Extend, Complete
router.post('/:id/start', requireStaff, sessionController.startSession);
router.post('/:id/extend', requireStaff, sessionController.extendSession);
router.post('/:id/complete', requireStaff, sessionController.completeSession);

export default router;
