import { Router } from 'express';
import {
  getAllGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  searchExternalGames,
  getProvidersStatus,
  importGame,
  refreshGameMetadata,
} from '../controllers/game.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';

const router = Router();

// Public routes for browsing games
router.get('/', getAllGames);

// External metadata provider endpoints (Admin only)
router.get('/search-external', authenticate, requireAdmin, searchExternalGames);
router.get('/providers-status', authenticate, requireAdmin, getProvidersStatus);
router.post('/import', authenticate, requireAdmin, importGame);
router.post('/:id/refresh', authenticate, requireAdmin, refreshGameMetadata);

// Specific game details
router.get('/:id', getGameById);

// Admin-only management
router.post('/', authenticate, requireAdmin, createGame);
router.put('/:id', authenticate, requireAdmin, updateGame);
router.delete('/:id', authenticate, requireAdmin, deleteGame);

export default router;
