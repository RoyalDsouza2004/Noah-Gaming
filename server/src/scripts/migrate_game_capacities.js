import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import Game from '../models/Game.js';
import Device from '../models/Device.js';

async function migrateGames() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const games = await Game.find({});
    console.log(`Found ${games.length} existing games.`);

    for (const game of games) {
      const name = game.name.trim();
      let minPlayers = 1;
      let maxPlayers = 4;
      let bookingMode = 'BOTH';
      let status = game.status;

      if (name.includes('EA Sports FC 25')) {
        minPlayers = 1;
        maxPlayers = 4;
        bookingMode = 'BOTH';
      } else if (name.includes('Tekken 8')) {
        minPlayers = 1;
        maxPlayers = 2;
        bookingMode = 'BOTH';
      } else if (name.includes('Gran Turismo 7')) {
        minPlayers = 1;
        maxPlayers = 2;
        bookingMode = 'BOTH';
      } else if (name.includes('Spider-Man 2')) {
        minPlayers = 1;
        maxPlayers = 1;
        bookingMode = 'BOTH';
      } else if (name.includes('GTA 6')) {
        minPlayers = 1;
        maxPlayers = 1;
        bookingMode = 'PRIVATE_ONLY';
        // Requirement 6: "GTA 6 must remain disabled until activated by Admin"
        status = 'INACTIVE';
      } else if (name.includes('Tournament')) {
        minPlayers = 1;
        maxPlayers = 4;
        bookingMode = 'SHARED';
      } else {
        // Safe default
        minPlayers = game.minPlayers || 1;
        maxPlayers = game.maxPlayers || 4;
        bookingMode = game.bookingMode || 'BOTH';
      }

      game.minPlayers = minPlayers;
      game.maxPlayers = maxPlayers;
      game.bookingMode = bookingMode;
      game.status = status;

      await game.save();
      console.log(`Updated '${game.name}': min=${minPlayers}, max=${maxPlayers}, mode=${bookingMode}, status=${status}`);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateGames();
