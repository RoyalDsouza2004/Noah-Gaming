import { Router } from 'express';
import {
  getAllGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
} from '../controllers/game.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';

const router = Router();

// Public routes for browsing games
router.get('/', getAllGames);
router.get('/:id', getGameById);

// Admin-only management
router.post('/', authenticate, requireAdmin, createGame);
router.put('/:id', authenticate, requireAdmin, updateGame);
router.delete('/:id', authenticate, requireAdmin, deleteGame);

export default router;
