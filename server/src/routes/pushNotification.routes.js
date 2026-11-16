import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as pushController from '../controllers/pushNotification.controller.js';

const router = express.Router();

// Public / semi-public endpoint to fetch VAPID public key
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Authenticated push management endpoints
router.use(authenticate);

router.get('/status', pushController.getSubscriptionStatus);
router.post('/subscribe', pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);
router.post('/unsubscribe-all', pushController.unsubscribeAll);
router.post('/test', pushController.sendTestPush);

export default router;
