import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

import app from './app.js';
import { connectDB } from './config/db.js';
import { getSystemFeatures } from './config/features.js';
import { releaseExpiredReservations } from './services/payment.service.js';
import { checkAndExpireSubscriptions } from './services/membership.service.js';
import { startScheduler } from './jobs/scheduler.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('====================================================');
    console.log('🚀 Starting Gaming Lounge Management & Booking Server');
    console.log('====================================================');

    await connectDB();
    await getSystemFeatures();

    // Start Phase 8 real-time automation and session timer scheduler
    startScheduler(10000);

    // Routine to sweep expired temporary slot reservations and memberships every 5 minutes
    setInterval(async () => {
      try {
        const { releasedCount } = await releaseExpiredReservations();
        if (releasedCount > 0) {
          console.log(`[Expiry Service] Released ${releasedCount} expired unpaid reservations.`);
        }
        await checkAndExpireSubscriptions();
      } catch (e) {
        console.warn('[Expiry Service Error]:', e.message);
      }
    }, 5 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`[Server] Live on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
      console.log(`[Server] Auth endpoint: http://localhost:${PORT}/api/auth`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('[Fatal Startup Error]', err);
    process.exit(1);
  }
}

startServer();
