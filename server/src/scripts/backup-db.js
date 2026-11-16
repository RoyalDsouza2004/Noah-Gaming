import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gaming_lounge';
const BACKUP_DIR = path.resolve(__dirname, '../../data/backup');

async function performBackup() {
  console.log('====================================================');
  console.log('📦 Starting Nexus Lounge MongoDB Backup');
  console.log('====================================================');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(BACKUP_DIR, `backup-${timestamp}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  await mongoose.connect(MONGODB_URI);
  console.log(`[Backup] Connected to database: ${mongoose.connection.name}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  const manifest = {
    timestamp: new Date().toISOString(),
    database: mongoose.connection.name,
    collections: {},
    totalDocuments: 0,
  };

  for (const collInfo of collections) {
    const collName = collInfo.name;
    // Skip system internal collections
    if (collName.startsWith('system.')) continue;

    const collection = mongoose.connection.db.collection(collName);
    const docs = await collection.find({}).toArray();

    const filePath = path.join(targetDir, `${collName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');

    manifest.collections[collName] = docs.length;
    manifest.totalDocuments += docs.length;
    console.log(`[Backup] Collection '${collName}': ${docs.length} documents exported.`);
  }

  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log('====================================================');
  console.log(`✅ Backup successfully created at: ${targetDir}`);
  console.log(`📊 Total Documents Saved: ${manifest.totalDocuments}`);
  console.log('====================================================');

  await mongoose.disconnect();
  return targetDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  performBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Backup Error]:', err);
      process.exit(1);
    });
}

export { performBackup };
