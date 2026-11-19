import React from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

/**
 * Accessible Theme Selector / Toggle
 * Offers three distinct options:
 * 1. Light Mode (Always light)
 * 2. Dark Mode (Always dark)
 * 3. System Default (Syncs dynamically with OS prefers-color-scheme)
 *
 * Supports 'card' (Settings/Profile panel) and 'icon' (compact) variants.
 */
export const ThemeToggle = ({
  variant = 'icon',
  className = '',
  showLabel = false,
  labelPosition = 'right',
}) => {
  const {
    theme,
    resolvedTheme,
    themePreference,
    isDark,
    isLight,
    isSystem,
    toggleTheme,
    setThemePreference,
  } = useTheme();

  const titleText = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

  if (variant === 'card') {
    const options = [
      {
        id: 'light',
        label: 'Light Mode',
        sublabel: 'Always light theme',
        icon: Sun,
      },
      {
        id: 'dark',
        label: 'Dark Mode',
        sublabel: 'Always dark theme',
        icon: Moon,
      },
      {
        id: 'system',
        label: 'System Default',
        sublabel: isSystem
          ? `Auto (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
          : 'Sync with OS',
        icon: Monitor,
      },
    ];

    return (
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#260D17] border-[#49202C]'
            : 'bg-[#FFFFFF] border-[#E2E5EC] shadow-sm'
        } ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                isDark
                  ? 'bg-[#851B2B]/30 text-[#FFFFFF] border border-[#851B2B]'
                  : 'bg-[#FCECEF] text-[#851B2B] border border-[#E2E5EC]'
              }`}
            >
              {themePreference === 'system' ? (
                <Monitor className="w-5 h-5 text-current" />
              ) : isDark ? (
                <Moon className="w-5 h-5 text-current" />
              ) : (
                <Sun className="w-5 h-5 text-current" />
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
                {themePreference === 'system' ? (
                  <span>
                    Active:{' '}
                    <strong className={isDark ? 'text-white' : 'text-[#171923]'}>
                      System Default
                    </strong>{' '}
                    (Resolved: {resolvedTheme === 'dark' ? 'Dark Mode' : 'Light Mode'})
                  </span>
                ) : themePreference === 'dark' ? (
                  <span>
                    Active:{' '}
                    <strong className="text-white">Dark Burgundy</strong> (Always
                    dark)
                  </span>
                ) : (
                  <span>
                    Active:{' '}
                    <strong className="text-[#171923]">Lounge Light</strong> (Always
                    light)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Three-Option Theme Selection Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          role="radiogroup"
          aria-label="Theme preference selector"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = themePreference === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setThemePreference(opt.id)}
                role="radio"
                aria-checked={isSelected}
                className={`relative flex items-center sm:flex-col sm:items-start justify-between sm:justify-start gap-2 p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-[#851B2B] text-white border-[#851B2B] shadow-md shadow-[#851B2B]/20 ring-2 ring-[#851B2B]/30'
                    : isDark
                    ? 'bg-[#171014] border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] hover:border-[#851B2B]/50'
                    : 'bg-[#F8FAFC] border-[#E2E5EC] text-[#414858] hover:text-[#171923] hover:border-[#851B2B]/40'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isDark
                        ? 'bg-[#260D17] text-[#C7A5A8]'
                        : 'bg-white text-[#414858] border border-[#E2E5EC]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div
                      className={`text-xs font-bold font-heading ${
                        isSelected
                          ? 'text-white'
                          : isDark
                          ? 'text-[#FFF4E8]'
                          : 'text-[#171923]'
                      }`}
                    >
                      {opt.label}
                    </div>
                    <div
                      className={`text-[11px] ${
                        isSelected
                          ? 'text-white/80'
                          : isDark
                          ? 'text-[#C7A5A8]'
                          : 'text-[#626B7A]'
                      }`}
                    >
                      {opt.sublabel}
                    </div>
                  </div>
                </div>

                {/* Active check pill */}
                {isSelected && (
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-white shrink-0 sm:absolute sm:top-2.5 sm:right-2.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Compact Icon Button variant (for headers, sidebars or quick toggles)
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
      className={`relative h-9 ${
        showLabel ? 'px-3 gap-2' : 'w-9 p-0'
      } rounded-xl border transition-all flex items-center justify-center select-none active:scale-95 group focus:outline-none shrink-0 ${
        isDark
          ? 'bg-[#260D17] hover:bg-[#381322] border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8]'
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
          className={`w-4 h-4 text-[#F5B942] group-hover:text-white transition-all duration-300 absolute ${
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
