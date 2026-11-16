import * as pushService from '../services/pushNotification.service.js';

/**
 * Returns the VAPID Public Key for client-side subscription
 */
export const getVapidPublicKey = async (req, res, next) => {
  try {
    const publicKey = pushService.getVapidPublicKey();
    res.json({
      success: true,
      data: {
        publicKey,
        isConfigured: !!publicKey,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns push subscription status for current authenticated user
 */
export const getSubscriptionStatus = async (req, res, next) => {
  try {
    const currentEndpoint = req.query.endpoint || null;
    const status = await pushService.getSubscriptionStatus({
      user: req.user,
      currentEndpoint,
    });
    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Saves or updates a browser push subscription for authenticated user
 */
export const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: 'Valid push subscription object with endpoint and keys is required.',
      });
    }

    const userAgent = req.body.userAgent || req.headers['user-agent'] || '';
    const result = await pushService.saveSubscription({
      user: req.user,
      subscription,
      userAgent,
    });

    res.json({
      success: true,
      message: 'Push subscription successfully registered for this device.',
      data: {
        id: result._id,
        deviceType: result.deviceType,
        browser: result.browser,
        os: result.os,
        isActive: result.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unsubscribes a single device subscription by endpoint
 */
export const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint is required to unsubscribe.',
      });
    }

    const result = await pushService.unsubscribeDevice({
      user: req.user,
      endpoint,
    });

    res.json({
      success: true,
      message: 'Device unsubscribed from push notifications.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unsubscribes all registered devices for the current user
 */
export const unsubscribeAll = async (req, res, next) => {
  try {
    const result = await pushService.unsubscribeAllDevices({
      user: req.user,
    });

    res.json({
      success: true,
      message: 'All registered devices have been unsubscribed.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Dispatches an immediate test push notification to user's registered devices
 */
export const sendTestPush = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    const result = await pushService.sendTestPush({
      user: req.user,
      endpoint: endpoint || null,
    });

    res.json({
      success: true,
      message: 'Test push notification dispatched successfully!',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
