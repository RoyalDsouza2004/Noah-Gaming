import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEME_STORAGE_KEY = 'noah_theme';

const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const resolveTheme = (pref) => {
  if (pref === 'system') {
    return getSystemTheme();
  }
  return pref === 'light' ? 'light' : 'dark';
};

export const ThemeProvider = ({ children }) => {
  // 1. Initial preference: light, dark, or system (defaults to 'system' if not set)
  const [themePreference, setPreferenceState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch (e) {}
    return 'system'; // System default for new users or if no preference is saved
  });

  // 2. Active resolved theme ('light' or 'dark')
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(themePreference));

  const applyTheme = useCallback((newTheme, withTransition = false) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (withTransition) {
      root.classList.add('theme-transition');
    }

    if (newTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }

    // Update mobile browser status bar theme color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', newTheme === 'light' ? '#F5F6FA' : '#851B2B');
    }

    if (withTransition) {
      setTimeout(() => {
        root.classList.remove('theme-transition');
      }, 250);
    }
  }, []);

  // Sync DOM on mount and when resolved theme changes
  useEffect(() => {
    applyTheme(resolvedTheme, false);
  }, [resolvedTheme, applyTheme]);

  // Listen to OS prefers-color-scheme when preference is 'system'
  useEffect(() => {
    if (themePreference !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newSystemTheme);
      applyTheme(newSystemTheme, true);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [themePreference, applyTheme]);

  const setThemePreference = (newPref) => {
    if (newPref !== 'light' && newPref !== 'dark' && newPref !== 'system') return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newPref);
    } catch (e) {}
    setPreferenceState(newPref);
    const active = resolveTheme(newPref);
    setResolvedTheme(active);
    applyTheme(active, true);
  };

  const setTheme = (prefOrTheme) => {
    setThemePreference(prefOrTheme);
  };

  const toggleTheme = () => {
    // Cycles manually between dark and light
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemePreference(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        resolvedTheme,
        themePreference,
        isDark: resolvedTheme === 'dark',
        isLight: resolvedTheme === 'light',
        isSystem: themePreference === 'system',
        setThemePreference,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
