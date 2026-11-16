import { BaseGameMetadataAdapter } from './baseAdapter.js';

export class IgdbAdapter extends BaseGameMetadataAdapter {
  constructor() {
    super('igdb');
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  isConfigured() {
    return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  }

  async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt - 60000) {
      return this.token;
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('IGDB Twitch credentials are not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.');
    }

    const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to obtain Twitch OAuth token for IGDB: HTTP ${res.status}`);
    }

    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return this.token;
  }

  async search(query) {
    if (!this.isConfigured()) {
      throw new Error('IGDB adapter is not configured.');
    }

    const token = await this.getAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID;

    const body = `search "${query.replace(/"/g, '')}"; fields id, name, summary, cover.url, first_release_date, rating, platforms.name, genres.name; limit 10;`;
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`IGDB search failed with HTTP ${res.status}`);
    }

    const games = await res.json();
    return games.map((g) => {
      let coverUrl = g.cover?.url || '';
      if (coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
      coverUrl = coverUrl.replace('t_thumb', 't_cover_big');

      return {
        id: String(g.id),
        name: g.name,
        released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : 'TBA',
        backgroundImage: coverUrl,
        rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
        platforms: (g.platforms || []).map((p) => p.name),
        genres: (g.genres || []).map((gen) => gen.name),
      };
    });
  }

  async getDetails(externalId) {
    if (!this.isConfigured()) {
      throw new Error('IGDB adapter is not configured.');
    }

    const token = await this.getAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID;

    const body = `where id = ${externalId}; fields id, name, summary, storyline, cover.url, screenshots.url, videos.video_id, first_release_date, rating, rating_count, platforms.name, genres.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, multiplayer_modes.*; limit 1;`;

    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`IGDB getDetails failed with HTTP ${res.status}`);
    }

    const [g] = await res.json();
    if (!g) throw new Error(`Game with ID ${externalId} not found in IGDB.`);

    let coverUrl = g.cover?.url || '';
    if (coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
    coverUrl = coverUrl.replace('t_thumb', 't_1080p');

    const screenshots = (g.screenshots || [])
      .map((s) => (s.url?.startsWith('//') ? 'https:' + s.url : s.url).replace('t_thumb', 't_1080p'))
      .filter(Boolean);

    const trailers = (g.videos || []).map((v) => ({
      title: 'Official Trailer',
      youtubeId: v.video_id,
      videoUrl: `https://www.youtube.com/watch?v=${v.video_id}`,
      previewUrl: `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg`,
    }));

    // Multiplayers
    const modes = (g.multiplayer_modes || [])[0] || {};
    const localCoop = Boolean(modes.campaigncoop || modes.lancoop || modes.offlinecoop);
    const splitScreen = Boolean(modes.splitscreen);
    const maxOfflineCoop = modes.offlinecoopmax || (localCoop ? 2 : 1);
    const maxOfflineMulti = modes.offlinemax || (splitScreen ? 4 : 1);

    return {
      provider: 'igdb',
      externalId: String(g.id),
      name: g.name,
      description: g.summary || g.storyline || '',
      coverUrl,
      backgroundUrl: screenshots[0] || coverUrl,
      genres: (g.genres || []).map((gen) => gen.name),
      developer: (g.involved_companies || [])
        .filter((c) => c.developer)
        .map((c) => c.company?.name)
        .join(', '),
      publisher: (g.involved_companies || [])
        .filter((c) => c.publisher)
        .map((c) => c.company?.name)
        .join(', '),
      releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : 'TBA',
      ageRating: 'PEGI 16',
      platforms: (g.platforms || []).map((p) => p.name),
      ratings: {
        igdb: {
          rating: g.rating ? Number((g.rating / 10).toFixed(1)) : null,
          ratingCount: g.rating_count || 0,
        },
      },
      multiplayer: {
        localCoop,
        splitScreen,
        offlineMultiplayer: maxOfflineMulti > 1 || localCoop,
        maxOfflineCoopPlayers: maxOfflineCoop,
        maxOfflineMultiplayerPlayers: maxOfflineMulti,
        onlineCoop: Boolean(modes.onlinecoop),
        maxOnlinePlayers: modes.onlinemax || 0,
      },
      localPlayersSupported: Math.min(4, Math.max(1, maxOfflineMulti)),
      trailers,
      screenshots,
    };
  }
}
