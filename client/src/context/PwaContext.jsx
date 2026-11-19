import React, { createContext, useContext, useState, useEffect } from 'react';

const PwaContext = createContext(null);

export const PwaProvider = ({ children }) => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('noah_pwa_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // 1. Check if application is already launched in standalone PWA mode
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };
    checkStandalone();

    // 2. Detect iOS devices (iPhone, iPad, iPod)
    const userAgent = (window.navigator.userAgent || '').toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) &&
      !window.MSStream &&
      !window.matchMedia('(display-mode: standalone)').matches;
    setIsIos(isIosDevice);

    // 3. Capture beforeinstallprompt event (Chromium, Android, Edge)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // 4. Capture successful app installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    // A. Native Chromium / Android prompt available
    if (installPrompt) {
      try {
        const promptEvent = installPrompt;
        setInstallPrompt(null);
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          setIsInstalled(true);
        }
        return choiceResult?.outcome || 'dismissed';
      } catch (err) {
        console.warn('[PWA] Error triggering install prompt:', err);
        setInstallPrompt(null);
      }
    }

    // B. iOS device: Display instructions for Safari Add to Home Screen
    if (isIos) {
      setShowIosModal(true);
      return 'ios_modal';
    }

    // C. Fallback: Open general install guide
    setShowIosModal(true);
    return 'guide_modal';
  };

  const dismissBanner = () => {
    setIsBannerDismissed(true);
    try {
      sessionStorage.setItem('noah_pwa_dismissed', 'true');
    } catch {}
  };

  const canInstall = !isInstalled;

  return (
    <PwaContext.Provider
      value={{
        installPrompt,
        isInstalled,
        isIos,
        canInstall,
        triggerInstall,
        showIosModal,
        setShowIosModal,
        isBannerDismissed,
        dismissBanner,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
