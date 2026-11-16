import { Router } from 'express';
import {
  getUsersList,
  getUserDetails,
  updateUserDetails,
  changeUserRole,
  initiateGuestConversion,
  completeGuestConversion,
  initiatePasswordReset,
  completePasswordReset,
  checkDuplicateUser,
  mergeDuplicateAccounts,
  deleteUser,
} from '../controllers/userManagement.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin, requireStaff } from '../middlewares/rbac.js';

const router = Router();

// Check duplicate before creation (Staff & Admin)
router.get('/check-duplicate', authenticate, requireStaff, checkDuplicateUser);

// User List with search, filters, pagination (Staff & Admin)
router.get('/', authenticate, requireStaff, getUsersList);

// Merge accounts (Strictly Admin only)
router.post('/merge', authenticate, requireAdmin, mergeDuplicateAccounts);

// User Profile Details (Staff & Admin)
router.get('/:id', authenticate, requireStaff, getUserDetails);

// Edit User Profile (Staff & Admin - cannot edit role)
router.put('/:id', authenticate, requireStaff, updateUserDetails);

// Change User Role (Strictly Admin only)
router.patch('/:id/role', authenticate, requireAdmin, changeUserRole);

// Guest-to-Registered Conversion (Staff & Admin)
router.post('/:id/convert/request-otp', authenticate, requireStaff, initiateGuestConversion);
router.post('/:id/convert/complete', authenticate, requireStaff, completeGuestConversion);

// Password Reset (Staff & Admin)
router.post('/:id/reset-password/request-otp', authenticate, requireStaff, initiatePasswordReset);
router.post('/:id/reset-password/complete', authenticate, requireStaff, completePasswordReset);

// Delete User (Strictly Admin only)
router.delete('/:id', authenticate, requireAdmin, deleteUser);

export default router;
