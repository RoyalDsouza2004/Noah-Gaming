import { Router } from 'express';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
} from '../controllers/device.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';

const router = Router();

// Public routes for browsing devices
router.get('/', getAllDevices);
router.get('/:id', getDeviceById);

// Admin-only management
router.post('/', authenticate, requireAdmin, createDevice);
router.put('/:id', authenticate, requireAdmin, updateDevice);
router.delete('/:id', authenticate, requireAdmin, deleteDevice);

export default router;
