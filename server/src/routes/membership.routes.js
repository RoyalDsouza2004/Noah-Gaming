import { Router } from 'express';
import {
  getActivePlans,
  getPlanById,
  purchaseMembership,
  verifyMembership,
  recordOfflinePurchase,
  getMySubscriptions,
  getMyUsage,
  renewMySubscription,
  getEligibleUpgrades,
  getUpgradeQuote,
  initiateUpgrade,
  verifyUpgrade,
  offlineUpgrade,
} from '../controllers/membership.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';

const router = Router();

// Public Plans Browsing
router.get('/plans', getActivePlans);
router.get('/plans/:id', getPlanById);

// Protected Customer Routes
router.use(authenticate);

router.post('/purchase', purchaseMembership);
router.post('/create-order', purchaseMembership);
router.post('/verify', verifyMembership);
router.post('/verify-order', verifyMembership);
router.get('/my-subscriptions', getMySubscriptions);
router.get('/my-usage', getMyUsage);
router.post('/:subscriptionId/renew', renewMySubscription);

// Membership Upgrade Routes (Phase 5.1)
router.get('/eligible-upgrades', getEligibleUpgrades);
router.get('/upgrade-quote', getUpgradeQuote);
router.post('/upgrade/initiate', initiateUpgrade);
router.post('/upgrade-order', initiateUpgrade);
router.post('/upgrade/verify', verifyUpgrade);
router.post('/verify-upgrade', verifyUpgrade);
router.post('/upgrade/offline', authorize('admin', 'receptionist'), offlineUpgrade);

// Staff Offline Purchase Desk (Admin & Receptionist)
router.post('/offline-purchase', authorize('admin', 'receptionist'), recordOfflinePurchase);

export default router;
