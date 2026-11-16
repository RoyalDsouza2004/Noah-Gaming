const path = require('path');
const fs = require('fs');
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));
const { EJSON } = mongoose.mongo.BSON;

const BACKUP_DIR = 'C:\\Users\\HP\\OneDrive\\Desktop\\mongodb_backup_gaming_lounge';

(async () => {
  try {
    console.log('====================================================');
    console.log('📦 Starting Safe Local Database Backup');
    console.log('====================================================');

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    await mongoose.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in 'gaming_lounge':`);

    const manifest = {
      database: 'gaming_lounge',
      backupDate: new Date().toISOString(),
      collections: {},
    };

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const col = db.collection(colName);
      const docs = await col.find().toArray();
      const indexes = await col.indexes();

      // Write documents using Extended JSON (preserves ObjectId, Date, etc.)
      const docsPath = path.join(BACKUP_DIR, `${colName}.json`);
      fs.writeFileSync(docsPath, EJSON.stringify(docs, null, 2), 'utf-8');

      // Write indexes metadata
      const indexPath = path.join(BACKUP_DIR, `${colName}.indexes.json`);
      fs.writeFileSync(indexPath, JSON.stringify(indexes, null, 2), 'utf-8');

      manifest.collections[colName] = {
        documentCount: docs.length,
        indexCount: indexes.length,
        fileSize: fs.statSync(docsPath).size,
      };

      console.log(` ✓ [${colName}] Backed up ${docs.length} documents, ${indexes.length} indexes (${manifest.collections[colName].fileSize} bytes)`);
    }

    // Write manifest
    const manifestPath = path.join(BACKUP_DIR, 'backup_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log('====================================================');
    console.log(`✅ Backup successfully created at: ${BACKUP_DIR}`);
    console.log(`Manifest saved with ${Object.keys(manifest.collections).length} collections.`);
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  }
})();
