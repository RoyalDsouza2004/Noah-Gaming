import React from 'react';
import { Download, X, Sparkles } from 'lucide-react';
import { usePwa } from '../../context/PwaContext.jsx';

export const MobileInstallBanner = () => {
  const { isInstalled, isBannerDismissed, dismissBanner, triggerInstall } = usePwa();

  if (isInstalled || isBannerDismissed) return null;

  return (
    <aside
      aria-label="Install NOAH GAMING Application"
      className="md:hidden mx-3 sm:mx-4 mt-20 mb-[-3.5rem] relative z-30 rounded-2xl bg-gradient-to-r from-[#260D17]/95 via-[#1F0A13]/95 to-[#2B0E1B]/95 border border-[#851B2B]/60 p-3 shadow-xl shadow-black/60 backdrop-blur-md animate-fadeIn"
    >
      <div className="flex items-center gap-3">
        {/* App Logo */}
        <div className="w-11 h-11 rounded-xl bg-[#171014] border border-[#851B2B] p-1 flex items-center justify-center shrink-0 shadow-md">
          <img
            src="/icons/Noah_gaming_logo.svg"
            alt="NOAH GAMING Logo"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="font-heading font-black text-xs tracking-wider text-[#FFF4E8]">
              NOAH <span className="text-[#D7FF00]">GAMING</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold border border-[#851B2B]/70">
              <Sparkles className="w-2.5 h-2.5 text-[#D7FF00]" /> APP
            </span>
          </div>
          <p className="text-[11px] text-[#C7A5A8] truncate mt-0.5">
            Instant booking, live console timers & quick access
          </p>
        </div>

        {/* Install CTA Button */}
        <button
          type="button"
          onClick={triggerInstall}
          className="h-8 px-3 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 shadow-md shadow-[#D7FF00]/20 active:scale-95"
          title="Install NOAH GAMING App"
        >
          <Download className="w-3.5 h-3.5 text-[#171014]" />
          <span>Install</span>
        </button>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={dismissBanner}
          className="w-7 h-7 rounded-lg text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
