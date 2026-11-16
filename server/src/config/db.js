import mongoose from 'mongoose';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { fileURLToPath } from 'url';

// Use robust DNS servers on Windows to reliably resolve mongodb+srv SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongodProcess = null;
let dbState = {
  connected: false,
  uri: '',
  host: '',
  name: '',
  mode: 'standalone',
  error: null,
};

// Check if a TCP port is open
const isPortOpen = async (port, host = '127.0.0.1') => {
  const net = await import('net');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
};

// Attempt to start local mongod process if server is not running
const ensureLocalMongoDaemon = async () => {
  const isOpen = await isPortOpen(27017);
  if (isOpen) {
    console.log('[Database] MongoDB daemon detected running on port 27017.');
    return true;
  }

  // Look for mongod binary
  const standardPaths = [
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe',
    'mongod',
  ];

  let binaryPath = null;
  for (const p of standardPaths) {
    if (fs.existsSync(p)) {
      binaryPath = p;
      break;
    }
  }

  if (!binaryPath) {
    console.warn('[Database] No local mongod.exe found at standard paths.');
    return false;
  }

  const dbPath = path.resolve(__dirname, '../../data/db');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  // Check and clean stale mongod.lock if daemon is not running
  const lockFile = path.join(dbPath, 'mongod.lock');
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log('[Database] Cleared stale mongod.lock file.');
    } catch (e) {
      // ignore
    }
  }

  console.log(`[Database] Spawning mongod from ${binaryPath} using dbpath ${dbPath}...`);
  try {
    mongodProcess = spawn(binaryPath, ['--dbpath', dbPath, '--port', '27017', '--bind_ip', '127.0.0.1'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    mongodProcess.stdout?.on('data', (d) => {
      // quiet debug
    });

    mongodProcess.stderr?.on('data', (d) => {
      console.warn('[Database mongod stderr]', d.toString());
    });

    mongodProcess.on('error', (err) => {
      console.warn('[Database] Failed to spawn mongod:', err.message);
    });

    // Wait up to 10 seconds for port to open
    for (let i = 0; i < 20; i++) {
      await new Promise((res) => setTimeout(res, 500));
      if (await isPortOpen(27017)) {
        console.log('[Database] Local MongoDB successfully started on port 27017.');
        return true;
      }
    }
  } catch (err) {
    console.warn('[Database] Could not auto-launch mongod:', err.message);
  }

  return false;
};

export const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gaming_lounge';
  const isRemote =
    mongoURI.startsWith('mongodb+srv://') ||
    (!mongoURI.includes('127.0.0.1') && !mongoURI.includes('localhost'));

  try {
    // Only check local port and attempt spawning mongod if connecting locally
    if (!isRemote) {
      const portOpen = await isPortOpen(27017);
      if (!portOpen) {
        await ensureLocalMongoDaemon();
      }
    }

    // Redact credentials in connection logs
    const sanitizedURI = mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[Database] Connecting to ${isRemote ? 'MongoDB Atlas' : 'Local MongoDB'}: ${sanitizedURI}`);

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 2,
      autoIndex: true,
    });

    dbState.connected = true;
    dbState.uri = sanitizedURI;
    dbState.host = conn.connection.host;
    dbState.name = conn.connection.name;
    dbState.mode = isRemote ? 'atlas' : 'standalone';
    dbState.error = null;

    console.log(`[Database] MongoDB Connected (${dbState.mode}): ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    dbState.connected = false;
    dbState.error = err.message;
    console.error(`[Database] Connection Error: ${err.message}`);
    throw err;
  }
};

export const getDBStatus = () => {
  return {
    ...dbState,
    readyState: mongoose.connection.readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    modelsLoaded: Object.keys(mongoose.models),
  };
};

// Graceful cleanup on app termination
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongodProcess) {
    mongodProcess.kill();
  }
  process.exit(0);
});

export default connectDB;
