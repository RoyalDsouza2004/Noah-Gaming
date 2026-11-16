/**
 * Converts a base64url encoded VAPID public key string into a Uint8Array
 * required by the browser's PushManager.subscribe() method.
 */
export function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error('VAPID public key string is required');
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the current browser environment supports Web Push and Notifications
 */
export function isPushNotificationSupported() {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Detects if the current device is running iOS (iPhone/iPad)
 */
export function isIosDevice() {
  if (typeof window === 'undefined') return false;
  const ua = (window.navigator.userAgent || '').toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !window.MSStream;
}

/**
 * Detects if the web app is running in installed standalone PWA mode
 */
export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}
