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

const KNOWN_OBJECT_ID_FIELDS = new Set([
  '_id',
  'customer',
  'device',
  'game',
  'booking',
  'pricing',
  'payment',
  'subscription',
  'category',
  'user',
  'userId',
  'collectedBy',
  'sessionStartedBy',
  'sessionCompletedBy',
  'extendedBy',
  'completedBy',
  'changedBy',
  'recipient',
  'membershipPlan',
  'membershipSubscription',
  'previousSubscription',
  'previousPlan',
  'targetPlan',
  'upgradedTo',
  'walkInCreatedBy',
  'relatedBooking',
  'relatedSession',
]);

function reviveBsonTypes(value, key = '') {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    // Check if key is known ObjectId field and value is 24 hex chars
    if (
      (key === '_id' || key.endsWith('Id') || KNOWN_OBJECT_ID_FIELDS.has(key)) &&
      /^[0-9a-fA-F]{24}$/.test(value)
    ) {
      return new mongoose.Types.ObjectId(value);
    }
    // Check if ISO Date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item) && (key.endsWith('s') || KNOWN_OBJECT_ID_FIELDS.has(key))) {
        return new mongoose.Types.ObjectId(item);
      }
      return reviveBsonTypes(item, key);
    });
  }

  if (typeof value === 'object') {
    const revived = {};
    for (const [k, v] of Object.entries(value)) {
      revived[k] = reviveBsonTypes(v, k);
    }
    return revived;
  }

  return value;
}

async function performRestore(specificBackupPath = null) {
  console.log('====================================================');
  console.log('📥 Starting Nexus Lounge MongoDB Restore (with BSON Hydration)');
  console.log('====================================================');

  let sourceDir = specificBackupPath;

  if (!sourceDir) {
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`Backup root directory not found: ${BACKUP_DIR}`);
    }
    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((dir) => dir.startsWith('backup-'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      throw new Error('No backup archives found to restore.');
    }
    sourceDir = path.join(BACKUP_DIR, backups[0]);
  }

  console.log(`[Restore] Source archive: ${sourceDir}`);
  const manifestPath = path.join(sourceDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Backup manifest.json missing from source archive.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`[Restore] Archive Created: ${manifest.timestamp} (Database: ${manifest.database})`);

  await mongoose.connect(MONGODB_URI);
  console.log(`[Restore] Connected to target database: ${mongoose.connection.name}`);

  let restoredCount = 0;
  for (const [collName, docCount] of Object.entries(manifest.collections)) {
    const filePath = path.join(sourceDir, `${collName}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[Restore] Skipped '${collName}': JSON dump not found.`);
      continue;
    }

    const rawDocs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (rawDocs.length === 0) {
      console.log(`[Restore] Collection '${collName}': 0 documents to restore.`);
      continue;
    }

    // Hydrate ObjectIds and Dates properly
    const hydratedDocs = rawDocs.map((doc) => reviveBsonTypes(doc));

    const collection = mongoose.connection.db.collection(collName);
    await collection.deleteMany({});
    await collection.insertMany(hydratedDocs);
    restoredCount += hydratedDocs.length;
    console.log(`[Restore] Restored '${collName}': ${hydratedDocs.length} documents (ObjectIds & Dates hydrated).`);
  }

  console.log('====================================================');
  console.log(`✅ Database successfully restored & hydrated! (${restoredCount} total documents)`);
  console.log('====================================================');

  await mongoose.disconnect();
  return { sourceDir, restoredCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specificPath = process.argv[2] || null;
  performRestore(specificPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Restore Error]:', err);
      process.exit(1);
    });
}

export { performRestore };
