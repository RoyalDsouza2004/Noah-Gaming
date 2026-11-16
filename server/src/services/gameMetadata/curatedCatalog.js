import { BaseGameMetadataAdapter } from './baseAdapter.js';

export const CURATED_GAMES = [
  {
    externalId: 'curated-fc-25',
    name: 'EA Sports FC 25',
    aliases: ['fc 25', 'ea sports fc 25', 'fifa 25', 'fc25', 'ea sports fc 24', 'fc 24'],
    description: 'EA SPORTS FC 25 brings you more ways to win for the club. Team up with 5v5 Rush, a new way to play with friends in Football Ultimate Team, Clubs, and Kick-Off. Powered by FC IQ for greater tactical control.',
    coverUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1920&q=80',
    genres: ['Sports', 'Football', 'Competitive'],
    developer: 'EA Vancouver, EA Romania',
    publisher: 'Electronic Arts',
    releaseDate: '2024-09-27',
    ageRating: 'PEGI 3 / ESRB E',
    platforms: ['PlayStation 5', 'PlayStation 4', 'Xbox Series X/S', 'PC'],
    ratings: {
      rawg: { rating: 4.1, ratingTop: 5, ratingsCount: 1850, reviewsCount: 420 },
      metacritic: { score: 76, url: 'https://www.metacritic.com/game/ea-sports-fc-25/' },
    },
    multiplayer: {
      localCoop: true,
      splitScreen: false,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 4,
      maxOfflineMultiplayerPlayers: 4,
      onlineCoop: true,
      maxOnlinePlayers: 22,
    },
    localPlayersSupported: 4,
    trailers: [
      {
        title: 'EA SPORTS FC 25 Official Reveal Trailer',
        youtubeId: 'Lgb20q-h44s',
        videoUrl: 'https://www.youtube.com/watch?v=Lgb20q-h44s',
        previewUrl: 'https://img.youtube.com/vi/Lgb20q-h44s/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1280&q=80',
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-fc-24',
    name: 'EA Sports FC 24',
    aliases: ['fc 24', 'fifa 24', 'fc24'],
    description: 'EA SPORTS FC 24 welcomes you to The World’s Game: the truest football experience ever with HyperMotionV, PlayStyles optimised by Opta, and a revolutionised Frostbite Engine.',
    coverUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1920&q=80',
    genres: ['Sports', 'Football', 'Competitive'],
    developer: 'EA Vancouver, EA Romania',
    publisher: 'Electronic Arts',
    releaseDate: '2023-09-29',
    ageRating: 'PEGI 3 / ESRB E',
    platforms: ['PlayStation 5', 'PlayStation 4', 'Xbox Series X/S', 'PC'],
    ratings: {
      rawg: { rating: 3.8, ratingTop: 5, ratingsCount: 1420, reviewsCount: 380 },
      metacritic: { score: 76, url: 'https://www.metacritic.com/game/ea-sports-fc-24/' },
    },
    multiplayer: {
      localCoop: true,
      splitScreen: false,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 4,
      maxOfflineMultiplayerPlayers: 4,
      onlineCoop: true,
      maxOnlinePlayers: 22,
    },
    localPlayersSupported: 4,
    trailers: [
      {
        title: 'EA SPORTS FC 24 Official Gameplay Trailer',
        youtubeId: 'XhP3Xh4LMA8',
        videoUrl: 'https://www.youtube.com/watch?v=XhP3Xh4LMA8',
        previewUrl: 'https://img.youtube.com/vi/XhP3Xh4LMA8/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1280&q=80',
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-mk-1',
    name: 'Mortal Kombat 1',
    aliases: ['mk1', 'mk 1', 'mortal kombat'],
    description: 'Discover a reborn Mortal Kombat Universe created by the Fire God Liu Kang. Mortal Kombat 1 ushers in a new era of the iconic franchise with a new fighting system, game modes, and Fatalities!',
    coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1920&q=80',
    genres: ['Fighting', 'Action', 'Competitive'],
    developer: 'NetherRealm Studios',
    publisher: 'Warner Bros. Games',
    releaseDate: '2023-09-19',
    ageRating: 'PEGI 18 / ESRB M',
    platforms: ['PlayStation 5', 'Xbox Series X/S', 'PC'],
    ratings: {
      rawg: { rating: 4.4, ratingTop: 5, ratingsCount: 890, reviewsCount: 210 },
      metacritic: { score: 83, url: 'https://www.metacritic.com/game/mortal-kombat-1/' },
    },
    multiplayer: {
      localCoop: false,
      splitScreen: false,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 1,
      maxOfflineMultiplayerPlayers: 2,
      onlineCoop: false,
      maxOnlinePlayers: 2,
    },
    localPlayersSupported: 2,
    trailers: [
      {
        title: 'Mortal Kombat 1 - Official Gameplay Debut Trailer',
        youtubeId: 'UYFlv_Q2i_c',
        videoUrl: 'https://www.youtube.com/watch?v=UYFlv_Q2i_c',
        previewUrl: 'https://img.youtube.com/vi/UYFlv_Q2i_c/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1280&q=80',
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-tekken-8',
    name: 'Tekken 8',
    aliases: ['tekken8', 'tekken 8', 'tk8'],
    description: 'Fist Meets Fate! TEKKEN 8 continues the tragic saga of the Mishima bloodline and its world-shattering father-and-son grudge matches. Powered by Unreal Engine 5 with the brand-new Heat System.',
    coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?auto=format&fit=crop&w=1920&q=80',
    genres: ['Fighting', 'Action', 'Competitive'],
    developer: 'Bandai Namco Studios',
    publisher: 'Bandai Namco Entertainment',
    releaseDate: '2024-01-26',
    ageRating: 'PEGI 16 / ESRB T',
    platforms: ['PlayStation 5', 'Xbox Series X/S', 'PC'],
    ratings: {
      rawg: { rating: 4.7, ratingTop: 5, ratingsCount: 1120, reviewsCount: 310 },
      metacritic: { score: 90, url: 'https://www.metacritic.com/game/tekken-8/' },
    },
    multiplayer: {
      localCoop: false,
      splitScreen: false,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 1,
      maxOfflineMultiplayerPlayers: 2,
      onlineCoop: false,
      maxOnlinePlayers: 2,
    },
    localPlayersSupported: 2,
    trailers: [
      {
        title: 'TEKKEN 8 - Official Launch Gameplay Trailer',
        youtubeId: 'ohClxMmNL-Q',
        videoUrl: 'https://www.youtube.com/watch?v=ohClxMmNL-Q',
        previewUrl: 'https://img.youtube.com/vi/ohClxMmNL-Q/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-spider-man-2',
    name: "Marvel's Spider-Man 2",
    aliases: ['spider-man 2', 'spiderman 2', 'spider man 2', 'spiderman'],
    description: 'Spider-Men Peter Parker and Miles Morales return for an exciting new adventure in the critically acclaimed Marvel’s Spider-Man franchise. Battle the iconic Venom and Kraven across an expanded New York City.',
    coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?auto=format&fit=crop&w=1920&q=80',
    genres: ['Action', 'Adventure', 'Open World'],
    developer: 'Insomniac Games',
    publisher: 'Sony Interactive Entertainment',
    releaseDate: '2023-10-20',
    ageRating: 'PEGI 16 / ESRB T',
    platforms: ['PlayStation 5'],
    ratings: {
      rawg: { rating: 4.6, ratingTop: 5, ratingsCount: 2200, reviewsCount: 560 },
      metacritic: { score: 90, url: 'https://www.metacritic.com/game/marvels-spider-man-2/' },
    },
    multiplayer: {
      localCoop: false,
      splitScreen: false,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 1,
      maxOfflineMultiplayerPlayers: 1,
      onlineCoop: false,
      maxOnlinePlayers: 1,
    },
    localPlayersSupported: 1,
    trailers: [
      {
        title: "Marvel's Spider-Man 2 - Gameplay Reveal Trailer",
        youtubeId: 'bgqGdIoa52s',
        videoUrl: 'https://www.youtube.com/watch?v=bgqGdIoa52s',
        previewUrl: 'https://img.youtube.com/vi/bgqGdIoa52s/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1635863138275-d9b33299680b?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-gta-6',
    name: 'GTA 6',
    aliases: ['gta 6', 'gta vi', 'grand theft auto 6', 'grand theft auto vi'],
    description: 'Grand Theft Auto VI heads to the state of Leonida, home to the neon-soaked streets of Vice City and beyond in the biggest, most immersive evolution of the Grand Theft Auto series yet.',
    coverUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
    genres: ['Action', 'Open World', 'Adventure', 'VIP Exclusive'],
    developer: 'Rockstar Studios',
    publisher: 'Rockstar Games',
    releaseDate: 'Fall 2025',
    ageRating: 'PEGI 18 / ESRB M',
    platforms: ['PlayStation 5', 'Xbox Series X/S'],
    ratings: {
      rawg: { rating: 4.9, ratingTop: 5, ratingsCount: 5400, reviewsCount: 1200 },
      metacritic: { score: 98, url: 'https://www.metacritic.com/game/grand-theft-auto-vi/' },
    },
    multiplayer: {
      localCoop: false,
      splitScreen: false,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 1,
      maxOfflineMultiplayerPlayers: 1,
      onlineCoop: true,
      maxOnlinePlayers: 30,
    },
    localPlayersSupported: 1,
    trailers: [
      {
        title: 'Grand Theft Auto VI Trailer 1',
        youtubeId: 'QdBZY2fkU-0',
        videoUrl: 'https://www.youtube.com/watch?v=QdBZY2fkU-0',
        previewUrl: 'https://img.youtube.com/vi/QdBZY2fkU-0/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-gt7',
    name: 'Gran Turismo 7',
    aliases: ['gt7', 'gt 7', 'gran turismo 7', 'gran turismo'],
    description: 'Gran Turismo 7 brings together the very best features of the Real Driving Simulator. Whether you’re a competitive or casual racer, collector, tuner, livery designer, or photographer – find your line with an astounding collection of game modes.',
    coverUrl: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1920&q=80',
    genres: ['Racing', 'Simulation', 'Motorsport'],
    developer: 'Polyphony Digital',
    publisher: 'Sony Interactive Entertainment',
    releaseDate: '2022-03-04',
    ageRating: 'PEGI 3 / ESRB E',
    platforms: ['PlayStation 5', 'PlayStation 4'],
    ratings: {
      rawg: { rating: 4.2, ratingTop: 5, ratingsCount: 1650, reviewsCount: 390 },
      metacritic: { score: 87, url: 'https://www.metacritic.com/game/gran-turismo-7/' },
    },
    multiplayer: {
      localCoop: false,
      splitScreen: true,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 1,
      maxOfflineMultiplayerPlayers: 2,
      onlineCoop: false,
      maxOnlinePlayers: 20,
    },
    localPlayersSupported: 2,
    trailers: [
      {
        title: 'Gran Turismo 7 - State of Play Official Gameplay Trailer',
        youtubeId: 'cwywPjA_8Vw',
        videoUrl: 'https://www.youtube.com/watch?v=cwywPjA_8Vw',
        previewUrl: 'https://img.youtube.com/vi/cwywPjA_8Vw/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1280&q=80',
    ],
  },
  {
    externalId: 'curated-it-takes-two',
    name: 'It Takes Two',
    aliases: ['it takes two', 'ittakestwo'],
    description: 'Embark on the craziest journey of your life in It Takes Two, a genre-bending platform adventure created purely for co-op. Winner of Game of the Year at The Game Awards.',
    coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    backgroundUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1920&q=80',
    genres: ['Adventure', 'Co-Op', 'Platformer'],
    developer: 'Hazelight Studios',
    publisher: 'Electronic Arts',
    releaseDate: '2021-03-26',
    ageRating: 'PEGI 12 / ESRB T',
    platforms: ['PlayStation 5', 'PlayStation 4', 'Xbox Series X/S', 'PC'],
    ratings: {
      rawg: { rating: 4.6, ratingTop: 5, ratingsCount: 3100, reviewsCount: 820 },
      metacritic: { score: 89, url: 'https://www.metacritic.com/game/it-takes-two/' },
    },
    multiplayer: {
      localCoop: true,
      splitScreen: true,
      offlineMultiplayer: true,
      maxOfflineCoopPlayers: 2,
      maxOfflineMultiplayerPlayers: 2,
      onlineCoop: true,
      maxOnlinePlayers: 2,
    },
    localPlayersSupported: 2,
    trailers: [
      {
        title: 'It Takes Two - Official Gameplay Trailer',
        youtubeId: 'GAW7M5FFbYw',
        videoUrl: 'https://www.youtube.com/watch?v=GAW7M5FFbYw',
        previewUrl: 'https://img.youtube.com/vi/GAW7M5FFbYw/hqdefault.jpg',
      },
    ],
    screenshots: [
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1280&q=80',
    ],
  },
];

export class CuratedAdapter extends BaseGameMetadataAdapter {
  constructor() {
    super('curated');
  }

  isConfigured() {
    return true; // Always available out of the box
  }

  async search(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];

    const matches = CURATED_GAMES.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.aliases && g.aliases.some((a) => a.includes(q) || q.includes(a))) ||
        g.genres.some((gen) => gen.toLowerCase().includes(q))
    );

    return matches.map((g) => ({
      id: g.externalId,
      name: g.name,
      released: g.releaseDate,
      backgroundImage: g.coverUrl,
      rating: g.ratings.rawg?.rating || 4.5,
      platforms: g.platforms,
      genres: g.genres,
    }));
  }

  async getDetails(externalId) {
    const game =
      CURATED_GAMES.find((g) => g.externalId === externalId) ||
      CURATED_GAMES.find(
        (g) =>
          g.name.toLowerCase() === String(externalId).toLowerCase() ||
          (g.aliases && g.aliases.some((a) => a === String(externalId).toLowerCase()))
      );

    if (!game) {
      throw new Error(`Curated game '${externalId}' not found.`);
    }

    return {
      provider: 'curated',
      ...game,
    };
  }
}
