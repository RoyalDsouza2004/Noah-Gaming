import React from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Sun, Moon } from 'lucide-react';

/**
 * Accessible Theme Toggle Button (Dark Mode / Light Mode)
 * Supports 'icon' (compact header button) and 'card' (settings panel) variants.
 */
export const ThemeToggle = ({
  variant = 'icon',
  className = '',
  showLabel = false,
  labelPosition = 'right',
}) => {
  const { theme, isDark, toggleTheme, setTheme } = useTheme();

  const titleText = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

  if (variant === 'card') {
    return (
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#260D17] border-[#49202C]'
            : 'bg-[#FFFFFF] border-[#E2E5EC] shadow-sm'
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isDark
                  ? 'bg-[#851B2B]/40 text-[#D7FF00] border border-[#851B2B]'
                  : 'bg-[#FCECEF] text-[#851B2B] border border-[#CDD2DC]'
              }`}
            >
              {isDark ? (
                <Moon className="w-5 h-5 transition-transform duration-300" />
              ) : (
                <Sun className="w-5 h-5 transition-transform duration-300 rotate-90" />
              )}
            </div>
            <div>
              <div
                className={`text-sm font-bold font-heading ${
                  isDark ? 'text-[#FFF4E8]' : 'text-[#171923]'
                }`}
              >
                Appearance & Theme
              </div>
              <div
                className={`text-xs ${
                  isDark ? 'text-[#C7A5A8]' : 'text-[#414858]'
                }`}
              >
                Currently active: {isDark ? 'Dark Burgundy' : 'Lounge Light'}
              </div>
            </div>
          </div>

          {/* Segmented Dual Switch */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isDark
                ? 'bg-[#171014] border-[#49202C]'
                : 'bg-[#F0F2F6] border-[#E2E5EC]'
            }`}
            role="radiogroup"
            aria-label="Theme selector"
          >
            <button
              type="button"
              onClick={() => setTheme('dark')}
              role="radio"
              aria-checked={isDark}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isDark
                  ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/30'
                  : 'text-[#414858] hover:text-[#171923]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              role="radio"
              aria-checked={!isDark}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isDark
                  ? 'bg-[#851B2B] text-[#FFFFFF] shadow-md shadow-[#851B2B]/30'
                  : 'text-[#C7A5A8] hover:text-[#FFF4E8]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact Icon Button variant
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={titleText}
      aria-label={titleText}
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        outline: 'none',
      }}
      className={`relative h-9 px-2.5 sm:px-3 rounded-xl border transition-all flex items-center justify-center gap-2 select-none active:scale-95 group focus:outline-none ${
        isDark
          ? 'bg-[#260D17] hover:bg-[#381322] border-[#49202C] text-[#C7A5A8] hover:text-[#D7FF00]'
          : 'bg-[#FFFFFF] hover:bg-[#F1F3F7] border-[#E2E5EC] text-[#414858] hover:text-[#851B2B] shadow-sm'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        {/* Sun Icon */}
        <Sun
          className={`w-4 h-4 text-[#851B2B] transition-all duration-300 absolute ${
            isDark
              ? 'opacity-0 rotate-90 scale-50 pointer-events-none'
              : 'opacity-100 rotate-0 scale-100'
          }`}
        />
        {/* Moon Icon */}
        <Moon
          className={`w-4 h-4 text-[#F5B942] group-hover:text-[#D7FF00] transition-all duration-300 absolute ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
          }`}
        />
      </div>

      {showLabel && (
        <span
          className={`text-xs font-bold font-heading uppercase tracking-wider ${
            isDark ? 'text-[#FFF4E8]' : 'text-[#171923]'
          }`}
        >
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
};
