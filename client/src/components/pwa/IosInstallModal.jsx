import React from 'react';
import { X, Share2, PlusSquare, Sparkles, CheckCircle2 } from 'lucide-react';
import { usePwa } from '../../context/PwaContext.jsx';

export const IosInstallModal = () => {
  const { showIosModal, setShowIosModal, isIos } = usePwa();

  if (!showIosModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={() => setShowIosModal(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[#1D141A] border border-[#851B2B]/60 p-5 sm:p-6 shadow-2xl shadow-black/80 text-[#FFF4E8] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Neon Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-[#851B2B]/40 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-[#D7FF00]/15 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setShowIosModal(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#260D17] hover:bg-[#381322] border border-[#49202C] text-[#C7A5A8] hover:text-[#FFF4E8] flex items-center justify-center transition-colors"
          aria-label="Close install instructions"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with App Logo */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#851B2B] bg-[#171014] p-1 shadow-md shrink-0">
            <img
              src="/icons/Noah_gaming_logo.svg"
              alt="NOAH GAMING"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-sm tracking-wide text-[#FFF4E8]">
                NOAH <span className="text-[#D7FF00]">GAMING</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold border border-[#851B2B]/70">
                APP
              </span>
            </div>
            <p className="text-xs text-[#C7A5A8]">
              {isIos ? 'Install on your iPhone / iPad' : 'Install on your mobile device'}
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3 my-4 bg-[#171014]/70 rounded-xl p-3.5 border border-[#49202C]/60 text-xs sm:text-sm">
          {isIos ? (
            <>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#851B2B]">
                  1
                </span>
                <div className="flex-1 text-[#C7A5A8]">
                  Tap the <strong className="text-[#FFF4E8] inline-flex items-center gap-1 font-semibold">Share <Share2 className="w-3.5 h-3.5 text-[#D7FF00] inline" /></strong> button in the bottom Safari toolbar.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#851B2B]">
                  2
                </span>
                <div className="flex-1 text-[#C7A5A8]">
                  Scroll down and select <strong className="text-[#FFF4E8] inline-flex items-center gap-1 font-semibold">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 text-[#D7FF00] inline" /></strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#851B2B]">
                  3
                </span>
                <div className="flex-1 text-[#C7A5A8]">
                  Tap <strong className="text-[#FFF4E8] font-semibold">Add</strong> in the top-right corner to finish.
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#851B2B]">
                  1
                </span>
                <div className="flex-1 text-[#C7A5A8]">
                  Open your browser menu by tapping the <strong className="text-[#FFF4E8] font-semibold">three dots (⋮)</strong> in the top right.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#851B2B]">
                  2
                </span>
                <div className="flex-1 text-[#C7A5A8]">
                  Select <strong className="text-[#FFF4E8] font-semibold">Install app</strong> or <strong className="text-[#FFF4E8] font-semibold">Add to Home screen</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#851B2B]/40 text-[#FFF4E8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#851B2B]">
                  3
                </span>
                <div className="flex-1 text-[#C7A5A8]">
                  Follow the on-screen prompt to confirm installation.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Benefits badge */}
        <div className="flex items-center gap-2 text-[11px] text-[#A59599] mb-4">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#45C987] shrink-0" />
          <span>Full-screen experience, lightning-fast session bookings & live timers.</span>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setShowIosModal(false)}
          className="w-full py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#D7FF00]/20"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
