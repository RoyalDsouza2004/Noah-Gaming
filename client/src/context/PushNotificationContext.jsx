import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { pushApi } from '../api/push.js';
import { urlBase64ToUint8Array, isPushNotificationSupported, isIosDevice, isStandalonePwa } from '../utils/pushUtils.js';
import { showToast } from '../utils/toast.js';
import { useAuth } from './AuthContext.jsx';
import { navigate } from '../utils/navigation.js';

const PushNotificationContext = createContext(null);

export const PushNotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default'); // 'default', 'granted', 'denied', 'unsupported'
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentDeviceSubscribed, setCurrentDeviceSubscribed] = useState(false);
  const [activeDevicesCount, setActiveDevicesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState(null);

  const isIos = isIosDevice();
  const isStandalone = isStandalonePwa();
  const needsIosInstall = isIos && !isStandalone;

  // Evaluate browser support on mount
  useEffect(() => {
    const supported = isPushNotificationSupported();
    setIsSupported(supported);
    if (!supported) {
      setPermission('unsupported');
    } else {
      setPermission(Notification.permission);
    }
  }, []);

  // Listen to incoming Service Worker messages (e.g. notification clicks while app is open)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_CLICK') {
          const url = event.data?.data?.url;
          if (url) {
            const cleanPath = url.replace(/^#\/?/, '').replace(/^\/+/, '');
            navigate(`/${cleanPath}`);
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  // Refresh current device and user subscription status
  const refreshStatus = useCallback(async () => {
    if (!isPushNotificationSupported()) return;

    try {
      const currentPerm = Notification.permission;
      setPermission(currentPerm);

      const reg = await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();

      if (!user) {
        setCurrentDeviceSubscribed(!!existingSub);
        setIsSubscribed(!!existingSub);
        return;
      }

      const res = await pushApi.getStatus(existingSub?.endpoint || null);
      if (res?.success && res.data) {
        setIsSubscribed(res.data.isSubscribed);
        setActiveDevicesCount(res.data.totalDevices || 0);
        setCurrentDeviceSubscribed(res.data.currentDeviceSubscribed || !!existingSub);
      } else {
        setCurrentDeviceSubscribed(!!existingSub);
      }
    } catch (err) {
      console.warn('[PushNotification] Error refreshing status:', err.message);
    }
  }, [user]);

  // Sync status whenever user logs in or mounts
  useEffect(() => {
    if (user && isSupported) {
      refreshStatus();
    }
  }, [user, isSupported, refreshStatus]);

  // Explicit user action: Enable push notifications
  const enablePushNotifications = async () => {
    if (!isSupported) {
      showToast.error('Web Push notifications are not supported by this browser.');
      return false;
    }

    if (needsIosInstall) {
      showToast.error(
        'On iOS / iPadOS, please add NOAH GAMING to your Home Screen first to enable push notifications.'
      );
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Request user permission explicitly
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission === 'denied') {
        setError('Notification permission was blocked in browser settings.');
        showToast.error('Notification permission blocked. Please allow notifications in site settings.');
        setIsLoading(false);
        return false;
      }

      if (requestedPermission !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // 2. Fetch VAPID Public Key from backend
      const keyRes = await pushApi.getVapidPublicKey();
      const vapidPublicKey = keyRes?.data?.publicKey;

      if (!vapidPublicKey) {
        throw new Error('VAPID public key is not configured on the server.');
      }

      // 3. Obtain Service Worker Registration
      const reg = await navigator.serviceWorker.ready;

      // 4. Check for existing subscription or create a new one
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 5. Register subscription with backend
      const subJson = sub.toJSON();
      await pushApi.subscribe(subJson, navigator.userAgent);

      setCurrentDeviceSubscribed(true);
      setIsSubscribed(true);
      setActiveDevicesCount((prev) => Math.max(1, prev + 1));
      showToast.success('Web Push Notifications enabled successfully! 🎮');
      return true;
    } catch (err) {
      console.error('[PushNotification] Subscription error:', err);
      const msg = err.message || 'Failed to enable push notifications.';
      setError(msg);
      showToast.error(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit user action: Disable push notifications for current device
  const disablePushNotifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        if (user) {
          await pushApi.unsubscribe(endpoint);
        }
      }

      setCurrentDeviceSubscribed(false);
      await refreshStatus();
      showToast.success('Push notifications disabled for this device.');
      return true;
    } catch (err) {
      console.error('[PushNotification] Unsubscribe error:', err);
      const msg = err.message || 'Failed to disable push notifications.';
      setError(msg);
      showToast.error(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit user action: Unsubscribe all devices for this account
  const unsubscribeAllDevices = async () => {
    if (!user) return false;
    setIsLoading(true);

    try {
      // Unsubscribe locally first if subscribed
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }

      // Backend unsubscribe all
      await pushApi.unsubscribeAll();
      setCurrentDeviceSubscribed(false);
      setIsSubscribed(false);
      setActiveDevicesCount(0);
      showToast.success('All registered devices have been unsubscribed.');
      return true;
    } catch (err) {
      console.error('[PushNotification] Unsubscribe all error:', err);
      showToast.error(err.message || 'Failed to unsubscribe all devices.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit user action: Send test notification
  const sendTestNotification = async () => {
    if (!currentDeviceSubscribed && !isSubscribed) {
      showToast.error('Please enable push notifications on this device first.');
      return false;
    }

    setIsTesting(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint || null;

      const res = await pushApi.sendTestPush(endpoint);
      if (res?.success) {
        showToast.success('Test notification dispatched! Check your device notifications.');
        return true;
      } else {
        throw new Error(res?.message || 'Failed to dispatch test notification.');
      }
    } catch (err) {
      console.error('[PushNotification] Test push error:', err);
      showToast.error(err.message || 'Error sending test notification.');
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <PushNotificationContext.Provider
      value={{
        isSupported,
        permission,
        isSubscribed,
        currentDeviceSubscribed,
        activeDevicesCount,
        isLoading,
        isTesting,
        error,
        isIos,
        isStandalone,
        needsIosInstall,
        refreshStatus,
        enablePushNotifications,
        disablePushNotifications,
        unsubscribeAllDevices,
        sendTestNotification,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
};

export const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
};
