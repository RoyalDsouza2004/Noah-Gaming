const path = require('path');
const dotenv = require(path.resolve(__dirname, '../../node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));
const { MongoClient } = mongoose.mongo;

async function migrate() {
  console.log('====================================================');
  console.log('🚀 NOAH GAMING: MIGRATING LOCAL MONGODB TO ATLAS');
  console.log('====================================================');

  const localUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/gaming_lounge';
  const atlasUri = process.argv[2] || process.env.ATLAS_URI || process.env.MONGODB_URI;

  if (!atlasUri) {
    console.error('❌ Error: Target MongoDB Atlas URI not provided in arguments or .env');
    process.exit(1);
  }

  console.log('1. Connecting to Local MongoDB (127.0.0.1:27017)...');
  const localClient = new MongoClient(localUri, { serverSelectionTimeoutMS: 5000 });
  await localClient.connect();
  const localDb = localClient.db('gaming_lounge');
  console.log('✓ Local MongoDB connected.');

  console.log('\n2. Connecting to MongoDB Atlas...');
  const atlasClient = new MongoClient(atlasUri, { serverSelectionTimeoutMS: 15000 });
  await atlasClient.connect();
  const atlasDb = atlasClient.db('gaming_lounge');
  console.log('✓ MongoDB Atlas connected successfully to database:', atlasDb.databaseName);

  // List all collections from local
  const collections = await localDb.listCollections().toArray();
  const collectionNames = collections.map(c => c.name).filter(name => !name.startsWith('system.'));

  console.log(`\nFound ${collectionNames.length} collections to migrate:`);
  console.log(collectionNames.join(', '));

  const results = [];

  for (const colName of collectionNames) {
    const localCol = localDb.collection(colName);
    const atlasCol = atlasDb.collection(colName);

    const localDocs = await localCol.find({}).toArray();
    let migratedCount = 0;

    if (localDocs.length > 0) {
      const bulkOps = localDocs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));
      const bulkRes = await atlasCol.bulkWrite(bulkOps, { ordered: false });
      migratedCount = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);
    }

    // Migrate indexes
    let indexesCreated = 0;
    try {
      const indexes = await localCol.indexes();
      for (const idx of indexes) {
        if (idx.name === '_id_') continue;
        const options = {
          name: idx.name,
          unique: idx.unique || false,
          sparse: idx.sparse || false,
        };
        await atlasCol.createIndex(idx.key, options);
        indexesCreated++;
      }
    } catch (idxErr) {
      console.warn(`  ⚠️ Non-critical index note for [${colName}]: ${idxErr.message}`);
    }

    const atlasCount = await atlasCol.countDocuments();

    results.push({
      Collection: colName,
      'Local Docs': localDocs.length,
      'Atlas Docs': atlasCount,
      'Indexes': indexesCreated,
      Status: localDocs.length === atlasCount ? 'MATCH ✅' : 'COUNT MISMATCH ⚠️'
    });

    console.log(` ✓ [${colName}]: Migrated ${localDocs.length} docs, ${indexesCreated} indexes.`);
  }

  console.log('\n====================================================');
  console.log('📊 MIGRATION INTEGRITY AUDIT RESULTS');
  console.log('====================================================');
  console.table(results);

  const allMatch = results.every(r => r['Local Docs'] === r['Atlas Docs']);
  if (allMatch) {
    console.log('\n🎉 ALL COLLECTIONS & DOCUMENTS COPIED TO ATLAS 100% SUCCESSFULLY!');
  } else {
    console.warn('\n⚠️ Some collections had count differences. Review the audit table above.');
  }

  await localClient.close();
  await atlasClient.close();
  console.log('====================================================');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
