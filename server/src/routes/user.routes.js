import { Router } from 'express';
import {
  getAllUsers,
  findCustomerByPhone,
  updateUserRoleOrStatus,
  getActivityLogs,
} from '../controllers/user.controller.js';
import {
  getProfile,
  updateProfile,
  changePassword,
  getGamingHistory,
  getPaymentHistory,
  getCustomerDashboard,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/userProfile.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin, requireStaff } from '../middlewares/rbac.js';

const router = Router();

// ---------------- PROTECTED CUSTOMER PROFILE & DASHBOARD ----------------
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.get('/gaming-history', authenticate, getGamingHistory);
router.get('/payment-history', authenticate, getPaymentHistory);
router.get('/payments', authenticate, getPaymentHistory);
router.get('/dashboard', authenticate, getCustomerDashboard);

// In-app Notifications
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/read-all', authenticate, markAllNotificationsRead);
router.patch('/notifications/:id/read', authenticate, markNotificationRead);

// ---------------- STAFF & ADMIN OPERATIONS ----------------
router.get('/', authenticate, requireStaff, getAllUsers);
router.get('/phone/:phone', authenticate, requireStaff, findCustomerByPhone);
router.patch('/:id', authenticate, requireAdmin, updateUserRoleOrStatus);
router.get('/audit/logs', authenticate, requireAdmin, getActivityLogs);

export default router;
