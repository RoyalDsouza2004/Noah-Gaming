import { Router } from 'express';
import {
  getAdminPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getAdminSubscriptions,
  updateSubscription,
  getAdminUsage,
} from '../controllers/adminMembership.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin, requireStaff } from '../middlewares/rbac.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Plans Browsing - Allowed for Staff (Admin & Receptionist) for customer desk operations
router.get('/plans', requireStaff, getAdminPlans);

// Plans Creation, Modification, Deletion - Strictly Admin-Only
router.post('/plans', requireAdmin, createPlan);
router.put('/plans/:id', requireAdmin, updatePlan);
router.delete('/plans/:id', requireAdmin, deletePlan);

// Subscriptions & Usage Audit - Accessible by Staff (Admin & Receptionist)
router.get('/subscriptions', requireStaff, getAdminSubscriptions);
router.patch('/subscriptions/:id', requireStaff, updateSubscription);
router.get('/usage', requireStaff, getAdminUsage);

export default router;
