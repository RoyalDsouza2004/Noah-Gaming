import { CuratedAdapter } from './curatedCatalog.js';
import { RawgAdapter } from './rawgAdapter.js';
import { IgdbAdapter } from './igdbAdapter.js';

class GameMetadataService {
  constructor() {
    this.adapters = {
      curated: new CuratedAdapter(),
      rawg: new RawgAdapter(),
      igdb: new IgdbAdapter(),
    };

    // Simple TTL cache for search and details: key -> { data, expiresAt }
    this.cache = new Map();
    this.CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
  }

  getAdapter(providerName) {
    if (providerName && this.adapters[providerName.toLowerCase()]) {
      return this.adapters[providerName.toLowerCase()];
    }

    const preferred = (process.env.GAME_METADATA_PROVIDER || 'auto').toLowerCase();

    if (preferred === 'rawg' && this.adapters.rawg.isConfigured()) {
      return this.adapters.rawg;
    }
    if (preferred === 'igdb' && this.adapters.igdb.isConfigured()) {
      return this.adapters.igdb;
    }
    if (preferred === 'curated') {
      return this.adapters.curated;
    }

    // Auto resolution: prefer configured external API, fallback to curated
    if (this.adapters.rawg.isConfigured()) {
      return this.adapters.rawg;
    }
    if (this.adapters.igdb.isConfigured()) {
      return this.adapters.igdb;
    }
    return this.adapters.curated;
  }

  getProvidersStatus() {
    return {
      active: this.getAdapter().name,
      providers: {
        curated: { configured: true, name: 'Curated NOAH Catalog' },
        rawg: { configured: this.adapters.rawg.isConfigured(), name: 'RAWG Video Games Database' },
        igdb: { configured: this.adapters.igdb.isConfigured(), name: 'Internet Game Database (IGDB)' },
      },
    };
  }

  async searchGames(query, requestedProvider) {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    const adapter = this.getAdapter(requestedProvider);
    const cacheKey = `search:${adapter.name}:${trimmed.toLowerCase()}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const results = await adapter.search(trimmed);
      const normalized = results.map((r) => ({
        ...r,
        provider: adapter.name,
      }));
      this.cache.set(cacheKey, { data: normalized, expiresAt: Date.now() + this.CACHE_TTL_MS });
      return normalized;
    } catch (err) {
      console.warn(`[GameMetadataService] Search with ${adapter.name} failed:`, err.message);
      // If external provider failed, fallback to curated
      if (adapter.name !== 'curated') {
        const fallbackResults = await this.adapters.curated.search(trimmed);
        return fallbackResults.map((r) => ({
          ...r,
          provider: 'curated',
          fallback: true,
        }));
      }
      throw err;
    }
  }

  async getGameDetails(externalId, requestedProvider) {
    const adapter = this.getAdapter(requestedProvider);
    const cacheKey = `details:${adapter.name}:${externalId}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const details = await adapter.getDetails(externalId);
      this.cache.set(cacheKey, { data: details, expiresAt: Date.now() + this.CACHE_TTL_MS });
      return details;
    } catch (err) {
      console.warn(`[GameMetadataService] Details fetch with ${adapter.name} failed:`, err.message);
      if (adapter.name !== 'curated') {
        // Fallback check curated
        try {
          return await this.adapters.curated.getDetails(externalId);
        } catch {
          // not in curated either
        }
      }
      throw err;
    }
  }

  /**
   * Safe merge of newly fetched external metadata into an existing Game document,
   * respecting manual admin overrides in `manuallyEditedFields`.
   */
  applyMetadataUpdate(existingGame, freshDetails) {
    const manualFields = new Set(existingGame.externalSync?.manuallyEditedFields || []);

    const updatableFields = [
      'description',
      'genres',
      'developer',
      'publisher',
      'releaseDate',
      'ageRating',
      'platforms',
      'localPlayersSupported',
      'multiplayer',
      'ratings',
      'trailers',
      'screenshots',
    ];

    for (const field of updatableFields) {
      if (!manualFields.has(field) && freshDetails[field] !== undefined) {
        if (field === 'genres') {
          existingGame.genre = freshDetails.genres;
        } else if (field === 'localPlayersSupported') {
          // Clamp to max 4 for PS5
          const clamped = Math.min(Math.max(1, Number(freshDetails.localPlayersSupported) || 1), 4);
          existingGame.localPlayersSupported = clamped;
        } else {
          existingGame[field] = freshDetails[field];
        }
      }
    }

    // Only update cover/background if existing game didn't have custom Cloudinary uploaded images
    if (!existingGame.coverImage?.publicId && freshDetails.coverUrl && !manualFields.has('coverImage')) {
      existingGame.coverImage = { url: freshDetails.coverUrl, publicId: '' };
      existingGame.imageUrl = freshDetails.coverUrl;
    }
    if (!existingGame.backgroundImage?.publicId && freshDetails.backgroundUrl && !manualFields.has('backgroundImage')) {
      existingGame.backgroundImage = { url: freshDetails.backgroundUrl, publicId: '' };
    }

    if (!existingGame.externalSync) {
      existingGame.externalSync = {};
    }
    existingGame.externalSync.lastSyncedAt = new Date();
    existingGame.externalSync.provider = freshDetails.provider || existingGame.externalSync.provider || 'unknown';

    return existingGame;
  }
}

export const gameMetadataService = new GameMetadataService();
export default gameMetadataService;
