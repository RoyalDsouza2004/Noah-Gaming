import { Router } from 'express';
import {
  getAllPricing,
  getPricingById,
  createPricing,
  updatePricing,
  deletePricing,
  calculatePrice,
} from '../controllers/pricing.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';

const router = Router();

// Public routes for viewing pricing and calculating quote
router.get('/', getAllPricing);
router.get('/:id', getPricingById);
router.post('/calculate', calculatePrice);

// Admin-only management
router.post('/', authenticate, requireAdmin, createPricing);
router.put('/:id', authenticate, requireAdmin, updatePricing);
router.delete('/:id', authenticate, requireAdmin, deletePricing);

export default router;
