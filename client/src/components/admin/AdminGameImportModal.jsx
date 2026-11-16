import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Download,
  Loader2,
  Gamepad2,
  Users,
  Star,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Tv,
  Calendar,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { equipmentApi } from '../../api/equipment.js';
import { showToast } from '../../utils/toast.js';

export const AdminGameImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [provider, setProvider] = useState('curated');
  const [providersStatus, setProvidersStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // Selected Game for Preview & Override
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Overrides state
  const [overrides, setOverrides] = useState({
    name: '',
    description: '',
    localPlayersSupported: 4,
    genre: '',
    developer: '',
    publisher: '',
    releaseDate: '',
    ageRating: '',
  });

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  // Load provider configurations on mount
  useEffect(() => {
    if (!isOpen) return;
    const fetchStatus = async () => {
      try {
        const res = await equipmentApi.getProvidersStatus();
        if (res.success && res.data) {
          setProvidersStatus(res.data);
          if (res.data.active) {
            setProvider(res.data.active);
          }
        }
      } catch (e) {
        console.warn('Could not load provider status:', e.message);
      }
    };
    fetchStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const res = await equipmentApi.searchExternalGames(q, provider);
      if (res.success && Array.isArray(res.data)) {
        setSearchResults(res.data);
        if (res.data.length === 0) {
          setSearchError(`No games found for "${q}" via ${provider.toUpperCase()}. Try another keyword.`);
        }
      } else {
        throw new Error(res.message || 'Failed to search external games.');
      }
    } catch (err) {
      setSearchError(err.message || 'Error occurred while searching game metadata.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectGame = async (item) => {
    setLoadingDetails(true);
    setSearchError(null);
    setImportError(null);

    try {
      // In curated mode or RAWG/IGDB mode, query the details
      // We can also use searchExternalGames or import directly
      // Let's use search results or get detailed item
      setSelectedPreview(item);
      setOverrides({
        name: item.name || '',
        description: item.description || '',
        localPlayersSupported: Math.min(Number(item.localPlayersSupported) || 4, 4),
        genre: Array.isArray(item.genres) ? item.genres.join(', ') : '',
        developer: item.developer || '',
        publisher: item.publisher || '',
        releaseDate: item.released || item.releaseDate || '',
        ageRating: item.ageRating || 'PEGI 12',
      });
    } catch (err) {
      setSearchError('Failed to load full game details: ' + err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedPreview) return;
    setImporting(true);
    setImportError(null);

    try {
      const payload = {
        externalId: String(selectedPreview.id || selectedPreview.externalId),
        provider: selectedPreview.provider || provider,
        overrides: {
          name: overrides.name,
          description: overrides.description,
          localPlayersSupported: Math.min(Math.max(1, parseInt(overrides.localPlayersSupported, 10) || 1), 4),
          genres: overrides.genre
            ? overrides.genre.split(',').map((s) => s.trim()).filter(Boolean)
            : selectedPreview.genres || [],
          developer: overrides.developer,
          publisher: overrides.publisher,
          releaseDate: overrides.releaseDate,
          ageRating: overrides.ageRating,
          coverUrl: selectedPreview.backgroundImage || selectedPreview.coverUrl,
          manuallyEditedFields: ['localPlayersSupported'],
        },
      };

      const res = await equipmentApi.importGame(payload);
      if (res.success && res.data?.game) {
        showToast.success(`Game "${res.data.game.name}" imported to PS5 stations successfully!`);
        if (onImportSuccess) onImportSuccess(res.data.game);
        onClose();
      } else {
        throw new Error(res.message || 'Failed to import game.');
      }
    } catch (err) {
      setImportError(err.message || 'Error occurred while saving imported game.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-4xl my-auto rounded-3xl bg-[#171014] border border-[#49202C] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#49202C] bg-[#1e1319] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#851B2B]/30 border border-[#851B2B] text-[#D7FF00]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-white">Import Game from Metadata Provider</h3>
              <p className="text-xs text-slate-400">
                Search verified game databases (RAWG, IGDB, Curated Catalog) and automatically link to PS5 stations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* STEP 1: Provider selection & Search form */}
          {!selectedPreview ? (
            <div className="space-y-4">
              {/* Provider Selection */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-slate-300 font-heading uppercase tracking-wider text-[11px]">
                  Active Metadata Provider:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider('curated')}
                    className={`px-3 py-1.5 rounded-xl font-bold font-heading text-xs transition-colors ${
                      provider === 'curated'
                        ? 'bg-[#D7FF00] text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Curated NOAH Catalog (Offline/Verified)
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('rawg')}
                    className={`px-3 py-1.5 rounded-xl font-bold font-heading text-xs transition-colors ${
                      provider === 'rawg'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    RAWG Video Games API
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('igdb')}
                    className={`px-3 py-1.5 rounded-xl font-bold font-heading text-xs transition-colors ${
                      provider === 'igdb'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    IGDB (Twitch)
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search game title (e.g. FC 24, Mortal Kombat, Tekken, Spider-Man)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#D7FF00]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-slate-950 font-bold font-heading uppercase tracking-wider text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </form>

              {/* Search Feedback */}
              {searchError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search Results Grid */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Found {searchResults.length} Match{searchResults.length > 1 ? 'es' : ''} via {provider.toUpperCase()}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectGame(item)}
                        className="group p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-[#D7FF00] cursor-pointer transition-all flex flex-col justify-between space-y-2 hover:shadow-lg"
                      >
                        <div className="space-y-2">
                          <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-950 relative">
                            {item.backgroundImage ? (
                              <img
                                src={item.backgroundImage}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <Gamepad2 className="w-8 h-8" />
                              </div>
                            )}
                            {item.rating && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[#D7FF00] font-mono font-bold text-[10px] flex items-center gap-0.5 backdrop-blur-sm">
                                <Star className="w-2.5 h-2.5 fill-current" /> {item.rating}
                              </div>
                            )}
                          </div>
                          <div>
                            <h5 className="font-bold text-white font-heading text-sm group-hover:text-[#D7FF00] transition-colors line-clamp-1">
                              {item.name}
                            </h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {item.released ? `Released: ${item.released}` : 'Release TBA'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate max-w-[120px]">
                            {Array.isArray(item.genres) ? item.genres.slice(0, 2).join(', ') : 'Action'}
                          </span>
                          <span className="text-[#D7FF00] font-bold font-heading uppercase group-hover:translate-x-0.5 transition-transform">
                            Select →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Preview, Review & Edit Fields Before Import */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedPreview(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Search Results
                </button>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                  Target: 2 Physical PS5 Stations
                </span>
              </div>

              {/* Hardware policy notice */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center gap-2.5">
                <Tv className="w-5 h-5 text-[#D7FF00] flex-shrink-0" />
                <span>
                  This will register <strong>{overrides.name}</strong> into your MongoDB Game collection and link it to both <strong>PS5 Station 1</strong> and <strong>PS5 Station 2</strong>. Physical station hardware is never modified.
                </span>
              </div>

              {/* Overrides Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Game Title</label>
                  <input
                    type="text"
                    value={overrides.name}
                    onChange={(e) => setOverrides({ ...overrides, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Local Couch Players Supported (Max 4 on PS5)
                  </label>
                  <select
                    value={overrides.localPlayersSupported}
                    onChange={(e) => setOverrides({ ...overrides, localPlayersSupported: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  >
                    <option value={1}>1 Player (Single-Player Only)</option>
                    <option value={2}>2 Players (1v1 or 2-Player Co-Op)</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players (Full 4-Player Couch Party)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Genres (comma-separated)</label>
                  <input
                    type="text"
                    value={overrides.genre}
                    onChange={(e) => setOverrides({ ...overrides, genre: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Developer / Publisher</label>
                  <input
                    type="text"
                    value={overrides.developer}
                    onChange={(e) => setOverrides({ ...overrides, developer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Game Description</label>
                  <textarea
                    rows={4}
                    value={overrides.description}
                    onChange={(e) => setOverrides({ ...overrides, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white leading-relaxed"
                  />
                </div>
              </div>

              {importError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#49202C] bg-[#1e1319] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold font-heading text-xs uppercase tracking-wider"
          >
            Cancel
          </button>

          {selectedPreview && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || !overrides.name.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#D7FF00] hover:bg-[#c8ee00] text-slate-950 font-black font-heading text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-[#D7FF00]/20"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing to Database...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Confirm & Import Game
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
