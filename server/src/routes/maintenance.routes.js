import { Router } from 'express';
import {
  getAllMaintenance,
  getMaintenanceByDevice,
  createMaintenance,
  updateMaintenance,
} from '../controllers/maintenance.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin, requireStaff } from '../middlewares/rbac.js';

const router = Router();

// Staff routes to view maintenance
router.get('/', authenticate, requireStaff, getAllMaintenance);
router.get('/device/:deviceId', authenticate, requireStaff, getMaintenanceByDevice);

// Admin-only management
router.post('/', authenticate, requireAdmin, createMaintenance);
router.put('/:id', authenticate, requireAdmin, updateMaintenance);

export default router;
