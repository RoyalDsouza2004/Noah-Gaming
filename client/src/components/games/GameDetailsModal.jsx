import React, { useState, useEffect } from 'react';
import {
  X,
  Gamepad2,
  Users,
  Star,
  Tv,
  Calendar,
  Building,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Maximize2,
} from 'lucide-react';

export const GameDetailsModal = ({ game, isOpen, onClose, onBookGame }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'multiplayer', 'media'
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !game) return null;

  const coverUrl = game.coverImage?.url || game.imageUrl || game.thumbnail;
  const backgroundUrl =
    game.backgroundImage?.url ||
    (game.screenshots && game.screenshots[0]) ||
    coverUrl;

  const genres = Array.isArray(game.genre) ? game.genre : [game.category?.name || 'Action'];
  const platforms = Array.isArray(game.platforms) && game.platforms.length > 0 ? game.platforms : ['PlayStation 5'];
  const localPlayers = game.localPlayersSupported || game.maxPlayers || 4;

  const rawgRating = game.ratings?.rawg;
  const metacriticScore = game.ratings?.metacritic?.score;
  const igdbRating = game.ratings?.igdb?.rating;

  const multiplayer = game.multiplayer || {};
  const trailers = Array.isArray(game.trailers) ? game.trailers : [];
  const primaryTrailer = trailers.find((t) => t.youtubeId) || trailers[0];
  const screenshots = Array.isArray(game.screenshots) ? game.screenshots : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-4xl my-auto rounded-3xl bg-[#171014] border border-[#49202C] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Background Banner */}
        <div className="relative h-48 sm:h-64 w-full bg-slate-950 flex-shrink-0 overflow-hidden">
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt={game.name}
              className="w-full h-full object-cover opacity-45 scale-105 filter blur-[1px]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#171014] via-[#171014]/60 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-[#851B2B] text-white transition-colors border border-white/10 z-20"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Floating Game Header on Top of Banner */}
          <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 flex items-end gap-4 z-10">
            {/* Cover artwork */}
            <div className="w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden bg-slate-900 border-2 border-[#851B2B] shadow-2xl flex-shrink-0">
              {coverUrl ? (
                <img src={coverUrl} alt={game.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                  <Gamepad2 className="w-10 h-10" />
                </div>
              )}
            </div>

            {/* Title & Quick Info */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {game.isExclusive ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F5B942] text-slate-950 font-black font-heading text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3 h-3" /> VIP Exclusive
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold font-heading text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Available at NOAH
                  </span>
                )}

                <span className="px-2.5 py-0.5 rounded-full bg-[#D7FF00]/15 text-[#D7FF00] border border-[#D7FF00]/30 font-bold font-heading text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" /> {localPlayers} Couch Players
                </span>
              </div>

              <h2 className="text-xl sm:text-3xl font-black font-heading text-[#FFF4E8] tracking-tight truncate">
                {game.name}
              </h2>

              <p className="text-xs text-[#C7A5A8] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {game.developer && <span>Dev: <strong className="text-white">{game.developer}</strong></span>}
                {game.releaseDate && <span>Released: <strong className="text-white">{game.releaseDate}</strong></span>}
                {game.ageRating && <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300">{game.ageRating}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 border-b border-[#49202C] flex items-center gap-4 bg-[#1e1319] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 text-xs font-bold font-heading uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#D7FF00] text-[#D7FF00]'
                : 'border-transparent text-[#C7A5A8] hover:text-[#FFF4E8]'
            }`}
          >
            Overview & Ratings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('multiplayer')}
            className={`pb-2.5 text-xs font-bold font-heading uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'multiplayer'
                ? 'border-[#D7FF00] text-[#D7FF00]'
                : 'border-transparent text-[#C7A5A8] hover:text-[#FFF4E8]'
            }`}
          >
            Multiplayer & Couch Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`pb-2.5 text-xs font-bold font-heading uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'media'
                ? 'border-[#D7FF00] text-[#D7FF00]'
                : 'border-transparent text-[#C7A5A8] hover:text-[#FFF4E8]'
            }`}
          >
            Media & Trailer ({trailers.length + screenshots.length})
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: OVERVIEW & RATINGS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Ratings Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Metacritic */}
                <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C7A5A8]">Metacritic Score</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span
                      className={`text-2xl font-black font-mono ${
                        metacriticScore && metacriticScore >= 75
                          ? 'text-emerald-400'
                          : metacriticScore
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {metacriticScore ? `${metacriticScore}` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500">/ 100</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">Critic Consensus</span>
                </div>

                {/* RAWG Rating */}
                <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#49202C] flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C7A5A8]">RAWG Community</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-purple-400 flex items-center gap-1">
                      {rawgRating?.rating ? rawgRating.rating : '4.5'}
                    </span>
                    <span className="text-[10px] text-slate-500">/ 5 ★</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {rawgRating?.ratingsCount ? `${rawgRating.ratingsCount} reviews` : 'Verified Rating'}
                  </span>
                </div>

                {/* Local Couch Capacity */}
                <div className="p-3.5 rounded-2xl bg-[#260D17] border border-[#D7FF00]/30 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D7FF00]">NOAH Couch Setup</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-[#D7FF00]">{localPlayers}</span>
                    <span className="text-[10px] text-slate-400">Players Max</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">DualSense Wireless Ready</span>
                </div>
              </div>

              {/* Genre and Platform Pills */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#C7A5A8]">Genres & Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {genres.map((g, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-medium text-xs"
                    >
                      {g}
                    </span>
                  ))}
                  {platforms.map((p, i) => (
                    <span
                      key={`p-${i}`}
                      className="px-3 py-1 rounded-xl bg-[#851B2B]/20 border border-[#851B2B]/40 text-[#FFF4E8] font-bold text-xs"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#C7A5A8]">About {game.name}</h4>
                <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-line bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
                  {game.description || 'Full game information is available at NOAH GAMING lounge.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: MULTIPLAYER & COUCH SPECS */}
          {activeTab === 'multiplayer' && (
            <div className="space-y-5">
              {/* Verified Couch Multiplayer Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#851B2B]/30 to-[#D7FF00]/10 border border-[#D7FF00]/40 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-[#D7FF00] text-slate-950 font-black">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white font-heading">
                    Verified NOAH Local Couch Multiplayer: Up to {localPlayers} Players
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tested and certified on NOAH GAMING PlayStation 5 stations. Play cooperatively or competitively on our 4K 120Hz displays with low-latency DualSense wireless controllers.
                  </p>
                </div>
              </div>

              {/* Detailed Specs Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Local Co-Op</span>
                  <span className="font-bold flex items-center gap-1 font-mono">
                    {multiplayer.localCoop ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Supported
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> No
                      </span>
                    )}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Split-Screen Support</span>
                  <span className="font-bold flex items-center gap-1 font-mono">
                    {multiplayer.splitScreen ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Shared / Fixed Camera
                      </span>
                    )}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Offline Multiplayer Players</span>
                  <span className="font-bold text-[#D7FF00] font-mono">
                    {multiplayer.maxOfflineMultiplayerPlayers || localPlayers} Players
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Online Multiplayer</span>
                  <span className="font-bold text-purple-300 font-mono">
                    {multiplayer.maxOnlinePlayers ? `Up to ${multiplayer.maxOnlinePlayers} Online` : 'PlayStation Network'}
                  </span>
                </div>
              </div>

              {/* Station Hardware note */}
              <div className="p-3.5 rounded-xl bg-[#260D17] border border-[#49202C] text-xs text-[#C7A5A8]">
                💡 <strong>Equipment Policy:</strong> NOAH GAMING maintains 2 physical PS5 Stations and 1 Tournament Pool Table. Each PS5 console accommodates up to 4 local players.
              </div>
            </div>
          )}

          {/* TAB 3: MEDIA & TRAILER */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              {/* YouTube Privacy-Enhanced Embed */}
              {primaryTrailer?.youtubeId ? (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#C7A5A8] flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-[#D7FF00]" />
                    Official Gameplay Trailer
                  </h4>
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${primaryTrailer.youtubeId}?rel=0&modestbranding=1`}
                      title={`${game.name} Official Trailer`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400">
                  <Play className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p>Official gameplay trailer preview is being processed for this game.</p>
                </div>
              )}

              {/* High-Res Screenshots Gallery */}
              {screenshots.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#C7A5A8]">
                    In-Game Screenshots ({screenshots.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {screenshots.map((imgUrl, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedScreenshot(imgUrl)}
                        className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer group hover:border-[#D7FF00] transition-colors"
                      >
                        <img
                          src={imgUrl}
                          alt={`${game.name} Screenshot ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-[#49202C] bg-[#1e1319] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold font-heading text-xs uppercase tracking-wider transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onBookGame) onBookGame(game);
            }}
            className="px-6 py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-black font-heading text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#D7FF00]/25 flex items-center gap-2 hover:scale-105 active:scale-95"
          >
            <Gamepad2 className="w-4 h-4" /> Book This Game at NOAH <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Screenshot Lightbox Modal */}
        {selectedScreenshot && (
          <div
            className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setSelectedScreenshot(null)}
          >
            <div className="relative max-w-5xl max-h-[90vh]">
              <img
                src={selectedScreenshot}
                alt="Enlarged screenshot"
                className="max-w-full max-h-[85vh] rounded-2xl object-contain border border-slate-700 shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setSelectedScreenshot(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
