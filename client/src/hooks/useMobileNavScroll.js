import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useMobileNavScroll
 * 
 * Intelligent scroll direction controller that auto-hides the mobile bottom navigation
 * on scroll down and reveals it on scroll up.
 * 
 * Key Features:
 * - Capture-phase scroll listener on window catches scrolls from window AND any nested
 *   scrollable containers (e.g., admin dashboard, receptionist POS, customer profile,
 *   my bookings, modals, tables).
 * - Threshold dampening (10px) eliminates touch jitter and accidental toggles.
 * - Always reveals navigation when at or near the top of the container (scrollTop <= 25px).
 * - iOS rubber-band / overscroll protection prevents bottom bounce flickering.
 * - rAF throttling and state memoization prevent unnecessary React re-renders.
 * - Route/hash change listeners ensure navigation is never stuck hidden.
 */
export function useMobileNavScroll({ activeNav, threshold = 10, topOffset = 25 } = {}) {
  const [isVisible, setIsVisible] = useState(true);
  const isVisibleRef = useRef(true);
  isVisibleRef.current = isVisible;

  // Track last scroll position per scrolling element using WeakMap
  const lastScrollTopMap = useRef(new WeakMap());
  // Fallback for document / window scrolling
  const lastWindowScrollTop = useRef(0);

  const ticking = useRef(false);

  const showNav = useCallback(() => {
    if (!isVisibleRef.current) {
      isVisibleRef.current = true;
      setIsVisible(true);
    }
  }, []);

  const hideNav = useCallback(() => {
    if (isVisibleRef.current) {
      isVisibleRef.current = false;
      setIsVisible(false);
    }
  }, []);

  const resetNav = useCallback(() => {
    isVisibleRef.current = true;
    setIsVisible(true);
    lastWindowScrollTop.current = 0;
  }, []);

  // Reset visibility whenever activeNav route changes
  useEffect(() => {
    resetNav();
  }, [activeNav, resetNav]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Reset when URL hash changes or history changes
    const handleNavigationEvent = () => {
      resetNav();
    };

    window.addEventListener('hashchange', handleNavigationEvent, { passive: true });
    window.addEventListener('popstate', handleNavigationEvent, { passive: true });
    window.addEventListener('noah:show-nav', showNav, { passive: true });
    window.addEventListener('noah:reset-nav', resetNav, { passive: true });

    const handleScroll = (event) => {
      if (ticking.current) return;

      const target = event.target;
      ticking.current = true;

      window.requestAnimationFrame(() => {
        ticking.current = false;

        let currentScrollTop = 0;
        let lastScrollTop = 0;
        let isWindowTarget = false;
        let maxScroll = 0;

        if (
          !target ||
          target === window ||
          target === document ||
          target === document.documentElement ||
          target === document.body
        ) {
          isWindowTarget = true;
          currentScrollTop =
            window.pageYOffset ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;
          lastScrollTop = lastWindowScrollTop.current;
          maxScroll =
            (document.documentElement.scrollHeight || document.body.scrollHeight || 0) -
            window.innerHeight;
        } else if (target instanceof HTMLElement) {
          currentScrollTop = target.scrollTop;
          lastScrollTop = lastScrollTopMap.current.get(target) || 0;
          maxScroll = target.scrollHeight - target.clientHeight;
        } else {
          return;
        }

        // Prevent negative values from iOS bounce at top
        if (currentScrollTop < 0) {
          currentScrollTop = 0;
        }

        // 1. If near or at top of container / document, ALWAYS show bottom nav
        if (currentScrollTop <= topOffset) {
          showNav();
          if (isWindowTarget) {
            lastWindowScrollTop.current = currentScrollTop;
          } else if (target instanceof HTMLElement) {
            lastScrollTopMap.current.set(target, currentScrollTop);
          }
          return;
        }

        // 2. Ignore overscroll past the bottom (iOS rubber-banding)
        if (maxScroll > 0 && currentScrollTop >= maxScroll - 6) {
          return;
        }

        const delta = currentScrollTop - lastScrollTop;

        // 3. Ignore movements smaller than threshold (e.g. finger jitter)
        if (Math.abs(delta) < threshold) {
          return;
        }

        // 4. Scrolling Down: Hide bottom navigation
        if (delta > 0) {
          hideNav();
        }
        // 5. Scrolling Up: Reveal bottom navigation
        else if (delta < 0) {
          showNav();
        }

        // Update recorded position
        if (isWindowTarget) {
          lastWindowScrollTop.current = currentScrollTop;
        } else if (target instanceof HTMLElement) {
          lastScrollTopMap.current.set(target, currentScrollTop);
        }
      });
    };

    // Capture phase listener catches scroll on window AND all nested scrollable containers
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('hashchange', handleNavigationEvent);
      window.removeEventListener('popstate', handleNavigationEvent);
      window.removeEventListener('noah:show-nav', showNav);
      window.removeEventListener('noah:reset-nav', resetNav);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [threshold, topOffset, showNav, hideNav, resetNav]);

  return { isVisible, showNav, hideNav, resetNav };
}
