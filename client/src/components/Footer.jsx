import React from 'react';
import { Gamepad2, ShieldCheck, Clock, Sparkles, MapPin, Phone, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export const Footer = () => {
  const { user, openLoginModal } = useAuth();

  const handleStaffPortalClick = (e) => {
    e.preventDefault();
    if (!user) {
      openLoginModal();
    } else if (user.role === 'admin') {
      window.location.hash = '#admin';
    } else if (user.role === 'receptionist') {
      window.location.hash = '#receptionist';
    } else {
      window.location.hash = '#profile';
    }
  };

  return (
    <footer className="mt-20 border-t border-[#49202C] bg-[#171014] py-12 text-[#C7A5A8] text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#171014] flex items-center justify-center shadow-md shadow-[#851B2B]/30 border border-[#851B2B]/60 p-0.5 shrink-0 overflow-hidden">
                <img src="/icons/Noah_gaming_logo.svg" alt="NOAH GAMING" className="w-full h-full object-cover rounded-full" />
              </div>
              <div className="flex items-baseline">
                <span className="text-lg font-black text-[#FFF4E8] font-heading tracking-wider">
                  NOAH
                </span>
                <span className="text-lg font-black text-[#D7FF00] font-heading tracking-wider ml-1.5">
                  GAMING
                </span>
              </div>
            </div>
            <p className="text-[11px] font-bold tracking-widest text-[#F5B942] uppercase">
              PLAY • CHILL • CONNECT
            </p>
            <p className="text-xs text-[#C7A5A8] max-w-md leading-relaxed">
              Bajagoli's premier console and tournament gaming destination. Featuring multi-station PlayStation 5 setups, tournament 8-ball pool, and exclusive private gaming suites.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#C7A5A8] pt-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D7FF00]" /> 10:00 AM – 11:00 PM IST (Daily)
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F5B942]" /> Bajagoli , Karkala
              </span>
            </div>
          </div>

          {/* Customer Navigation Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FFF4E8] font-heading mb-3">
              Explore & Reserve
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#overview" className="hover:text-[#FFF4E8] transition-colors">
                  PlayStation 5 Consoles
                </a>
              </li>
              <li>
                <a href="#overview" className="hover:text-[#FFF4E8] transition-colors">
                  Tournament 8-Ball Pool
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[#FFF4E8] transition-colors">
                  Hourly Pricing & House Rules
                </a>
              </li>
              <li>
                <a href="#passes" className="hover:text-[#FFF4E8] transition-colors">
                  NOAH Club Passes
                </a>
              </li>
              <li>
                <a href="#book" className="text-[#D7FF00] hover:underline font-bold transition-colors">
                  Book a Station Online →
                </a>
              </li>
            </ul>
          </div>

          {/* Lounge Support & Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FFF4E8] font-heading mb-3">
              Support & Administration
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#45C987]" /> +91 98765 43210
              </li>
              <li className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#D7FF00]" /> support@noahgaming.in
              </li>
              <li>
                <span className="text-[#C7A5A8]/80 hover:text-[#FFF4E8] transition-colors cursor-pointer">
                  Fair Play & Session Rules
                </span>
              </li>
              <li>
                <span className="text-[#C7A5A8]/80 hover:text-[#FFF4E8] transition-colors cursor-pointer">
                  Privacy Policy & Terms
                </span>
              </li>
              <li className="pt-2">
                <button
                  type="button"
                  onClick={handleStaffPortalClick}
                  className="inline-flex items-center gap-1 text-[11px] text-[#C7A5A8]/70 hover:text-[#D7FF00] transition-colors font-mono"
                  title="Staff & Management Access"
                >
                  <Lock className="w-3 h-3 text-[#F5B942]" /> Staff & Admin Portal
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#49202C] flex flex-col sm:flex-row items-center justify-between text-xs text-[#C7A5A8] gap-4">
          <p>© 2026 NOAH GAMING. All rights reserved. &bull; PLAY • CHILL • CONNECT</p>
          <p className="flex items-center gap-1 text-[#C7A5A8]">
            <Sparkles className="w-3 h-3 text-[#D7FF00]" /> Indian Standard Time (IST) Operational Hours
          </p>
        </div>
      </div>
    </footer>
  );
};
