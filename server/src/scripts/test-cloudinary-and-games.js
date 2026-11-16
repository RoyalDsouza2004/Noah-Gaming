import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Game from '../models/Game.js';
import GameCategory from '../models/GameCategory.js';
import { generateUploadSignature, validateFolderPermission } from '../services/cloudinary.service.js';
import { gameMetadataService } from '../services/gameMetadata/gameMetadataService.js';

// Setup DNS for Windows Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // ignore
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Provide mock test credentials if env is not configured locally
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'noah-gaming-test';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '123456789012345';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'test_secret_abcdef1234567890';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/noah_gaming_lounge';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING CLOUDINARY & GAME METADATA INTEGRATION TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Test Cloudinary Permission & Signature Validation
    console.log('\n--- 1. Testing Cloudinary Folder Permissions & Signatures ---');
    const customerUser = { _id: 'cust123', role: 'customer' };
    const adminUser = { _id: 'adm123', role: 'admin' };

    const custCanProfile = validateFolderPermission('noah-gaming/profiles', customerUser.role);
    assert(custCanProfile === true, 'Customer allowed to upload to noah-gaming/profiles');

    const custCanGame = validateFolderPermission('noah-gaming/games/covers', customerUser.role);
    assert(custCanGame === false, 'Customer forbidden from uploading to noah-gaming/games/covers');

    const adminCanCovers = validateFolderPermission('noah-gaming/games/covers', adminUser.role);
    assert(adminCanCovers === true, 'Admin allowed to upload to noah-gaming/games/covers');

    const adminCanBackgrounds = validateFolderPermission('noah-gaming/games/backgrounds', adminUser.role);
    assert(adminCanBackgrounds === true, 'Admin allowed to upload to noah-gaming/games/backgrounds');

    const adminCanGallery = validateFolderPermission('noah-gaming/games/gallery', adminUser.role);
    assert(adminCanGallery === true, 'Admin allowed to upload to noah-gaming/games/gallery');

    const signatureResult = generateUploadSignature({
      folder: 'noah-gaming/profiles',
      userRole: 'customer',
    });
    assert(
      signatureResult.signature && signatureResult.timestamp && signatureResult.apiKey,
      'Signed upload payload generated successfully with signature, timestamp, apiKey'
    );

    // 2. Test Game Metadata Adapter & Curated Catalog
    console.log('\n--- 2. Testing Game Metadata Service & Curated Catalog ---');
    const searchResults = await gameMetadataService.searchGames('Mortal', 'curated');
    assert(
      Array.isArray(searchResults) && searchResults.length > 0,
      `Curated search for "Mortal" returned ${searchResults.length} results`
    );

    const mkResult = searchResults[0];
    assert(mkResult.name.includes('Mortal Kombat'), `Found title: ${mkResult.name}`);

    const details = await gameMetadataService.getGameDetails(mkResult.id, 'curated');
    assert(details && details.trailers?.length > 0, 'Details include official trailers');
    assert(details.ratings?.rawg?.rating, 'Details include RAWG ratings');
    assert(details.multiplayer?.offlineMultiplayer, 'Details include offline multiplayer specs');
    assert(Number(details.localPlayersSupported) <= 4, 'Verified localPlayersSupported is <= 4 on PS5');

    // 3. Database operations
    console.log('\n--- 3. Testing MongoDB Models & Business Constraints ---');
    await connectDB();

    // Verify Hardware Stations Constraints: strictly 2 PS5s and 1 Pool Table
    const ps5Devices = await Device.find({ deviceType: 'PS5' });
    const poolDevices = await Device.find({ deviceType: 'POOL' });
    console.log(`Found ${ps5Devices.length} PS5 stations, ${poolDevices.length} pool tables in DB.`);
    assert(ps5Devices.length === 2, 'Strict constraint: Exactly 2 PS5 stations in lounge hardware inventory');
    assert(poolDevices.length === 1, 'Strict constraint: Exactly 1 Pool table in lounge hardware inventory');

    // Test import game into MongoDB
    const defaultCat = (await GameCategory.findOne()) || (await GameCategory.create({ name: 'Sports & Racing' }));
    const testGameSlug = 'test-fc-24-' + Date.now();
    const importedGame = new Game({
      name: 'EA Sports FC 24 Test Import',
      description: 'Official test import description',
      category: defaultCat._id,
      compatibleDevices: ps5Devices.map((d) => d._id),
      minPlayers: 1,
      maxPlayers: 4,
      localPlayersSupported: 4,
      genre: ['Sports', 'Football'],
      ratings: {
        rawg: { rating: 4.2 },
        metacritic: { score: 76 },
      },
      trailers: [
        {
          title: 'Gameplay Trailer',
          youtubeId: 'XhP3Xh4LMA8',
          videoUrl: 'https://www.youtube.com/watch?v=XhP3Xh4LMA8',
        },
      ],
      externalSync: {
        provider: 'curated',
        externalId: testGameSlug,
        manuallyEditedFields: ['localPlayersSupported'],
      },
    });

    await importedGame.save();
    assert(importedGame._id, 'Imported Game saved into MongoDB Game collection successfully');

    // Verify physical hardware inventory was untouched
    const ps5DevicesAfter = await Device.find({ deviceType: 'PS5' });
    assert(
      ps5DevicesAfter.length === 2,
      'Hardware invariant preserved: Still exactly 2 PS5 stations after game import'
    );

    // Test Metadata Refresh preserving manually edited fields
    importedGame.localPlayersSupported = 2; // Admin manual override to 2 players
    importedGame.externalSync.manuallyEditedFields = ['localPlayersSupported'];
    await importedGame.save();

    const freshCurated = await gameMetadataService.getGameDetails('curated-fc-24', 'curated');
    // freshCurated has localPlayersSupported: 4
    gameMetadataService.applyMetadataUpdate(importedGame, freshCurated);
    assert(
      importedGame.localPlayersSupported === 2,
      'Metadata refresh preserved manual admin override for localPlayersSupported (remained 2, did not overwrite to 4)'
    );

    // Test Duplicate prevention
    const duplicateCheck = await Game.findOne({
      $or: [
        { name: 'EA Sports FC 24 Test Import' },
        { 'externalSync.externalId': testGameSlug },
      ],
    });
    assert(duplicateCheck !== null, 'Duplicate detection identifies existing game by title or externalId');

    // Clean up test game
    await Game.findByIdAndDelete(importedGame._id);
    console.log('Cleaned up test game record from MongoDB.');

    // 4. Test User Profile Picture Model Fields
    console.log('\n--- 4. Testing User Profile Picture Persistence ---');
    const testUser = await User.findOne({ role: 'customer' }) || await User.findOne();
    if (testUser) {
      const origPic = testUser.profilePicture;
      const origId = testUser.profilePicturePublicId;

      testUser.profilePicture = 'https://res.cloudinary.com/test-cloud/image/upload/v1234/noah-gaming/profiles/test.webp';
      testUser.profilePicturePublicId = 'noah-gaming/profiles/test';
      await testUser.save();

      const reloadedUser = await User.findById(testUser._id);
      assert(
        reloadedUser.profilePicture.includes('cloudinary.com'),
        'User profilePicture persisted with Cloudinary secure URL'
      );
      assert(
        reloadedUser.profilePicturePublicId === 'noah-gaming/profiles/test',
        'User profilePicturePublicId persisted with Cloudinary public ID'
      );

      // Restore original
      testUser.profilePicture = origPic;
      testUser.profilePicturePublicId = origId;
      await testUser.save();
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (err) {
    console.error('Fatal error during integration tests:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
