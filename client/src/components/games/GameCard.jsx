import React from 'react';
import { Gamepad2, Users, Star, ArrowRight, Eye, Sparkles, Tv } from 'lucide-react';

export const GameCard = ({ game, onViewDetails, onBook }) => {
  const coverUrl = game.coverImage?.url || game.imageUrl || game.thumbnail;
  const genres = Array.isArray(game.genre) ? game.genre : [game.category?.name || 'Action'];
  const platforms = Array.isArray(game.platforms) && game.platforms.length > 0 ? game.platforms : ['PlayStation 5'];
  const localPlayers = game.localPlayersSupported || game.maxPlayers || 4;

  const rawgRating = game.ratings?.rawg?.rating;
  const metacriticScore = game.ratings?.metacritic?.score;

  return (
    <div className="game-card-item group relative rounded-2xl bg-white dark:bg-[#260D17]/90 border border-slate-200 dark:border-[#49202C] hover:border-[#851B2B] dark:hover:border-[#851B2B] transition-all duration-300 hover:shadow-xl hover:shadow-[#851B2B]/20 flex flex-col justify-between overflow-hidden shadow-sm">
      {/* Top Media / Artwork Container */}
      <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#381322] to-[#171014] text-[#C7A5A8]">
            <Gamepad2 className="w-12 h-12 text-[#851B2B] mb-2" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-slate-400">NOAH Lounge Game</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="game-card-overlay absolute inset-0 bg-gradient-to-t from-white/90 dark:from-[#260D17] via-transparent to-black/30 pointer-events-none" />

        {/* Badges in Artwork */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex flex-wrap gap-1.5">
            {game.isExclusive ? (
              <span className="px-2 py-0.5 rounded-md bg-[#F5B942] text-slate-950 font-bold font-heading text-[10px] uppercase tracking-wider shadow-md flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Exclusive
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/90 text-slate-950 font-bold font-heading text-[10px] uppercase tracking-wider shadow-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Non-Exclusive
              </span>
            )}
          </div>

          {/* Metacritic or RAWG Score Badge */}
          {metacriticScore ? (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono border shadow-sm ${
                metacriticScore >= 75
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
              title={`Metacritic Score: ${metacriticScore}`}
            >
              MC {metacriticScore}
            </span>
          ) : rawgRating ? (
            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold font-mono flex items-center gap-0.5 shadow-sm">
              <Star className="w-2.5 h-2.5 fill-current" /> {rawgRating}
            </span>
          ) : null}
        </div>

        {/* Couch Capacity Pill Overlay at bottom of artwork */}
        <div className="absolute bottom-2 left-2.5 flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[#D7FF00] border border-[#D7FF00]/30 font-heading">
          <Users className="w-3 h-3 text-[#D7FF00]" />
          <span>Up to {localPlayers} Couch Players</span>
        </div>
      </div>

      {/* Body Information */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          {/* Genre and Platform row */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#C7A5A8]">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-[#851B2B]/30 text-[#851B2B] dark:text-[#FFF4E8] font-heading uppercase tracking-wider">
              {genres[0] || 'Gaming'}
            </span>
            <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
              {platforms.find((p) => p.toLowerCase().includes('playstation')) || 'PS5 Station'}
            </span>
          </div>

          {/* Title */}
          <h4 className="font-bold text-[#171923] dark:text-[#FFF4E8] text-base font-heading group-hover:text-[#851B2B] dark:group-hover:text-[#D7FF00] transition-colors line-clamp-1">
            {game.name}
          </h4>

          {/* Description */}
          <p className="text-xs text-[#414858] dark:text-[#C7A5A8] line-clamp-2 leading-relaxed">
            {game.description || 'Experience intense local multiplayer or single-player adventures at NOAH GAMING.'}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-[#49202C] flex items-center gap-2">
          <button
            type="button"
            onClick={() => onViewDetails && onViewDetails(game)}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-[#FFF4E8] hover:text-[#851B2B] dark:hover:text-[#D7FF00] border border-slate-300 dark:border-slate-700/80 font-bold font-heading text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" /> Details
          </button>

          <button
            type="button"
            onClick={() => onBook && onBook(game)}
            className="py-2 px-3.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] font-black font-heading text-xs uppercase tracking-wider transition-all shadow-md shadow-[#D7FF00]/20 flex items-center justify-center gap-1 hover:scale-105 active:scale-95"
            title="Book session for this game"
          >
            Book <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
