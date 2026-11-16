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
import { requireAdmin } from '../middlewares/rbac.js';

const router = Router();

// Strictly Admin-Only Routes
router.use(authenticate, requireAdmin);

// Plans CRUD
router.get('/plans', getAdminPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Subscriptions & Usage Audit
router.get('/subscriptions', getAdminSubscriptions);
router.patch('/subscriptions/:id', updateSubscription);
router.get('/usage', getAdminUsage);

export default router;
