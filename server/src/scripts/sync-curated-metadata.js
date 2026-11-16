import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import Game from '../models/Game.js';
import { CURATED_GAMES } from '../services/gameMetadata/curatedCatalog.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function syncMetadata() {
  console.log('\n--- Syncing Game Metadata & Media for Lounge Catalog ---');
  await connectDB();

  const games = await Game.find({});
  console.log(`Found ${games.length} existing games in database.`);

  let updated = 0;

  for (const game of games) {
    const cleanName = game.name.toLowerCase().trim();

    // Match with curated catalog by exact name or alias
    const match = CURATED_GAMES.find((c) => {
      const curName = c.name.toLowerCase();
      if (curName === cleanName || cleanName.includes(curName) || curName.includes(cleanName)) {
        return true;
      }
      if (c.aliases && c.aliases.some((a) => cleanName === a || cleanName.includes(a) || a.includes(cleanName))) {
        return true;
      }
      return false;
    });

    if (match) {
      console.log(`\n🎮 Matching "${game.name}" -> Curated: "${match.name}" (Metacritic: ${match.ratings?.metacritic?.score}, Trailers: ${match.trailers?.length})`);

      // Update ratings
      game.ratings = {
        rawg: match.ratings.rawg,
        metacritic: match.ratings.metacritic,
      };

      // Update media (trailers and screenshots)
      game.trailers = match.trailers || [];
      game.screenshots = match.screenshots || [];

      // Update artwork if not custom Cloudinary
      if (!game.coverImage?.publicId && match.coverUrl) {
        game.coverImage = { url: match.coverUrl, publicId: '' };
        game.imageUrl = match.coverUrl;
        game.thumbnail = match.coverUrl;
      }

      if (!game.backgroundImage?.publicId && match.backgroundUrl) {
        game.backgroundImage = { url: match.backgroundUrl, publicId: '' };
      }

      // Update developer, publisher, release date, age rating
      if (!game.developer && match.developer) game.developer = match.developer;
      if (!game.publisher && match.publisher) game.publisher = match.publisher;
      if (!game.releaseDate && match.releaseDate) game.releaseDate = match.releaseDate;
      if (!game.ageRating && match.ageRating) game.ageRating = match.ageRating;

      // Update genres
      if ((!game.genre || game.genre.length === 0) && match.genres) {
        game.genre = match.genres;
      }

      // Update multiplayer specs
      if (match.multiplayer) {
        game.multiplayer = match.multiplayer;
      }

      // Update verified local couch capacity (clamped to max 4 on PS5)
      if (!game.localPlayersSupported && match.localPlayersSupported) {
        game.localPlayersSupported = Math.min(match.localPlayersSupported, 4);
      }

      // Update externalSync reference
      game.externalSync = {
        provider: 'curated',
        externalId: match.externalId,
        externalSlug: match.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        lastSyncedAt: new Date(),
        manuallyEditedFields: game.externalSync?.manuallyEditedFields || [],
      };

      await game.save();
      console.log(`✅ Updated "${game.name}" with full Metacritic ratings, official trailer, and artwork.`);
      updated++;
    } else {
      console.log(`ℹ️ No curated match found for "${game.name}" (manual title).`);
    }
  }

  console.log(`\n🎉 Successfully synced metadata for ${updated} games.`);
  await mongoose.disconnect();
}

syncMetadata().catch((e) => {
  console.error('Sync failed:', e);
  process.exit(1);
});
