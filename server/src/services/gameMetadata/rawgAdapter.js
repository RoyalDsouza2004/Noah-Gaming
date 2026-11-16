import { BaseGameMetadataAdapter } from './baseAdapter.js';

export class RawgAdapter extends BaseGameMetadataAdapter {
  constructor() {
    super('rawg');
    this.baseUrl = 'https://api.rawg.io/api';
  }

  getApiKey() {
    return process.env.RAWG_API_KEY || '';
  }

  isConfigured() {
    return Boolean(this.getApiKey());
  }

  /**
   * Search RAWG games by title
   */
  async search(query) {
    if (!this.isConfigured()) {
      throw new Error('RAWG API key is not configured. Please set RAWG_API_KEY in server environment.');
    }

    const key = this.getApiKey();
    const url = `${this.baseUrl}/games?key=${key}&search=${encodeURIComponent(query)}&page_size=10&search_precise=true`;

    const res = await fetch(url, { headers: { 'User-Agent': 'NOAH-GAMING-LOUNGE/1.0' } });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`RAWG API search failed (HTTP ${res.status}): ${errBody.slice(0, 100)}`);
    }

    const data = await res.json();
    const results = data.results || [];

    return results.map((item) => ({
      id: String(item.id),
      slug: item.slug,
      name: item.name,
      released: item.released || 'TBA',
      backgroundImage: item.background_image || '',
      rating: item.rating ? Number(item.rating.toFixed(1)) : null,
      metacritic: item.metacritic || null,
      platforms: (item.platforms || []).map((p) => p.platform?.name).filter(Boolean),
      genres: (item.genres || []).map((g) => g.name),
    }));
  }

  /**
   * Fetch full game details, screenshots, and movies from RAWG
   */
  async getDetails(externalId) {
    if (!this.isConfigured()) {
      throw new Error('RAWG API key is not configured.');
    }

    const key = this.getApiKey();
    const detailUrl = `${this.baseUrl}/games/${externalId}?key=${key}`;
    const screenUrl = `${this.baseUrl}/games/${externalId}/screenshots?key=${key}`;
    const movieUrl = `${this.baseUrl}/games/${externalId}/movies?key=${key}`;

    const [detailRes, screenRes, movieRes] = await Promise.all([
      fetch(detailUrl, { headers: { 'User-Agent': 'NOAH-GAMING-LOUNGE/1.0' } }),
      fetch(screenUrl, { headers: { 'User-Agent': 'NOAH-GAMING-LOUNGE/1.0' } }).catch(() => null),
      fetch(movieUrl, { headers: { 'User-Agent': 'NOAH-GAMING-LOUNGE/1.0' } }).catch(() => null),
    ]);

    if (!detailRes.ok) {
      throw new Error(`RAWG API getDetails failed with status ${detailRes.status}`);
    }

    const d = await detailRes.json();
    const screens = screenRes && screenRes.ok ? await screenRes.json() : { results: [] };
    const movies = movieRes && movieRes.ok ? await movieRes.json() : { results: [] };

    // Strip HTML tags from description_raw / description
    let cleanDescription = d.description_raw || '';
    if (!cleanDescription && d.description) {
      cleanDescription = d.description.replace(/<[^>]*>?/gm, '').trim();
    }

    const platforms = (d.platforms || []).map((p) => p.platform?.name).filter(Boolean);
    const genres = (d.genres || []).map((g) => g.name);
    const developers = (d.developers || []).map((dev) => dev.name).join(', ');
    const publishers = (d.publishers || []).map((pub) => pub.name).join(', ');

    // Extract screenshots
    const screenshots = (screens.results || [])
      .map((s) => s.image)
      .filter(Boolean)
      .slice(0, 8);

    // Extract official trailers
    const trailers = (movies.results || []).map((m) => ({
      title: m.name || 'Official Trailer',
      videoUrl: m.data?.max || m.data?.['480'] || '',
      previewUrl: m.preview || '',
      youtubeId: '',
    }));

    // Detect multiplayer heuristics from tags & genres
    const tags = (d.tags || []).map((t) => t.slug.toLowerCase());
    const isCoop = tags.some((t) => t.includes('co-op') || t.includes('coop'));
    const isSplitScreen = tags.some((t) => t.includes('split-screen') || t.includes('splitscreen'));
    const isMultiplayer = tags.some((t) => t.includes('multiplayer') || t.includes('local-multiplayer'));

    return {
      provider: 'rawg',
      externalId: String(d.id),
      externalSlug: d.slug,
      name: d.name,
      description: cleanDescription,
      coverUrl: d.background_image || '',
      backgroundUrl: d.background_image_additional || d.background_image || '',
      genres: genres.length ? genres : ['Action'],
      developer: developers,
      publisher: publishers,
      releaseDate: d.released || 'TBA',
      ageRating: d.esrb_rating?.name || (d.pegi_rating ? `PEGI ${d.pegi_rating}` : 'Unrated'),
      platforms: platforms.length ? platforms : ['PlayStation 5'],
      ratings: {
        rawg: {
          rating: d.rating ? Number(d.rating.toFixed(1)) : null,
          ratingTop: d.rating_top || 5,
          ratingsCount: d.ratings_count || 0,
          reviewsCount: d.reviews_count || 0,
        },
        metacritic: {
          score: d.metacritic || null,
          url: d.metacritic_url || '',
        },
      },
      multiplayer: {
        localCoop: isCoop || isSplitScreen,
        splitScreen: isSplitScreen,
        offlineMultiplayer: isMultiplayer || isCoop || isSplitScreen,
        maxOfflineCoopPlayers: isSplitScreen ? 2 : isCoop ? 2 : 1,
        maxOfflineMultiplayerPlayers: isSplitScreen ? 4 : isMultiplayer ? 4 : 1,
        onlineCoop: isCoop,
        maxOnlinePlayers: isMultiplayer ? 10 : 0,
      },
      localPlayersSupported: isSplitScreen ? 4 : isCoop ? 2 : 1,
      trailers,
      screenshots,
    };
  }
}
