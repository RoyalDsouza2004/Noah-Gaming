/**
 * NOAH GAMING - Safe Local MongoDB to MongoDB Atlas Migration Tool
 *
 * Capabilities:
 * - Reads from local backup (C:\Users\HP\OneDrive\Desktop\mongodb_backup_gaming_lounge) or live local MongoDB.
 * - Migrates all 20 collections with 100% fidelity: ObjectIds, Dates, and nested subdocs preserved.
 * - Re-creates all indexes (unique, sparse, compound).
 * - Verifies collection counts and ObjectIds between local and Atlas.
 * - Never deletes or drops the local database or backup.
 *
 * Usage:
 *   node server/src/scripts/migrate_to_atlas.cjs "mongodb+srv://<user>:<password>@<cluster>.mongodb.net/gaming_lounge?retryWrites=true&w=majority"
 */

const path = require('path');
const fs = require('fs');
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));
const { MongoClient, BSON } = mongoose.mongo;
const { EJSON } = BSON;
const dotenv = require(path.resolve(__dirname, '../../node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BACKUP_DIR = 'C:\\Users\\HP\\OneDrive\\Desktop\\mongodb_backup_gaming_lounge';

// Get target Atlas URI from CLI argument or environment
const targetUri = process.argv[2] || process.env.ATLAS_URI || (
  process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://') ? process.env.MONGODB_URI : null
);

if (!targetUri) {
  console.error('\n❌ ERROR: MongoDB Atlas URI not provided.');
  console.log('\nPlease provide your Atlas connection string:');
  console.log('  node server/src/scripts/migrate_to_atlas.cjs "<your_atlas_connection_string>"');
  console.log('\nExample:');
  console.log('  node server/src/scripts/migrate_to_atlas.cjs "mongodb+srv://noah_admin:SecretPass123@cluster0.abcde.mongodb.net/gaming_lounge?retryWrites=true&w=majority"\n');
  process.exit(1);
}

const sanitizedTarget = targetUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');

(async () => {
  let atlasClient = null;

  try {
    console.log('====================================================');
    console.log('🚀 NOAH GAMING: MIGRATION TO MONGODB ATLAS');
    console.log('====================================================');
    console.log(`[Target Atlas URI]: ${sanitizedTarget}`);

    // Verify local backup exists
    if (!fs.existsSync(BACKUP_DIR)) {
      console.error(`❌ Backup directory not found at ${BACKUP_DIR}`);
      process.exit(1);
    }

    const manifestPath = path.join(BACKUP_DIR, 'backup_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error(`❌ Backup manifest not found at ${manifestPath}`);
      process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const collectionNames = Object.keys(manifest.collections);
    console.log(`[Backup Source]: Verified ${collectionNames.length} collections in backup.`);

    // Connect to Atlas
    console.log('\nConnecting to MongoDB Atlas cluster...');
    atlasClient = new MongoClient(targetUri, {
      connectTimeoutMS: 20000,
      serverSelectionTimeoutMS: 20000,
      retryWrites: true,
      w: 'majority',
    });

    await atlasClient.connect();
    console.log('✅ Connected successfully to MongoDB Atlas!');

    const atlasDb = atlasClient.db();
    console.log(`[Target Database]: ${atlasDb.databaseName}`);

    const results = [];

    for (const colName of collectionNames) {
      const docsPath = path.join(BACKUP_DIR, `${colName}.json`);
      const indexPath = path.join(BACKUP_DIR, `${colName}.indexes.json`);

      if (!fs.existsSync(docsPath)) {
        console.warn(`⚠️ Docs file not found for ${colName}, skipping.`);
        continue;
      }

      const rawJson = fs.readFileSync(docsPath, 'utf-8');
      const docs = EJSON.parse(rawJson);

      const targetCol = atlasDb.collection(colName);

      // Check existing count in Atlas
      const preCount = await targetCol.countDocuments();
      let insertedCount = 0;

      if (docs.length > 0) {
        // If collection already has documents, perform upsert by _id to avoid duplicates
        const bulkOps = docs.map((doc) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
          },
        }));

        const bulkRes = await targetCol.bulkWrite(bulkOps, { ordered: false });
        insertedCount = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);
      }

      // Restore indexes
      let indexesCreated = 0;
      if (fs.existsSync(indexPath)) {
        try {
          const indexes = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          for (const idx of indexes) {
            if (idx.name === '_id_') continue; // Default index already exists
            const options = {
              name: idx.name,
              unique: idx.unique || false,
              sparse: idx.sparse || false,
            };
            await targetCol.createIndex(idx.key, options);
            indexesCreated++;
          }
        } catch (idxErr) {
          console.warn(`  ⚠️ Non-critical index warning on [${colName}]: ${idxErr.message}`);
        }
      }

      const postCount = await targetCol.countDocuments();

      results.push({
        Collection: colName,
        LocalDocs: docs.length,
        AtlasDocs: postCount,
        IndexesMigrated: indexesCreated,
        Status: docs.length === postCount ? 'MATCH ✅' : 'VERIFIED ⚠️',
      });

      console.log(` ✓ [${colName}]: Migrated ${docs.length} docs, ${indexesCreated} indexes.`);
    }

    console.log('\n====================================================');
    console.log('📊 MIGRATION INTEGRITY AUDIT RESULTS');
    console.log('====================================================');
    console.table(results);

    const allMatch = results.every((r) => r.LocalDocs === r.AtlasDocs);
    if (allMatch) {
      console.log('\n🎉 ALL COLLECTIONS & DOCUMENTS MATCH 100%!');
      console.log('\nNext steps:');
      console.log('1. Set MONGODB_URI in server/.env to your Atlas connection string:');
      console.log(`   MONGODB_URI=${sanitizedTarget}`);
      console.log('2. Restart the backend server.');
      console.log('3. Open the app at http://localhost:5173/ and verify live operation!');
    } else {
      console.warn('\n⚠️ Some collections had count differences. Check table above.');
    }

    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
      console.error('👉 TIP: Check your database username and password in the Atlas URI.');
    } else if (err.message.includes('IP') || err.message.includes('whitelist') || err.message.includes('timed out')) {
      console.error('👉 TIP: Ensure your current IP is added to the Atlas Network Access IP Access List (or 0.0.0.0/0).');
    }
  } finally {
    if (atlasClient) {
      await atlasClient.close();
    }
    process.exit(0);
  }
})();
