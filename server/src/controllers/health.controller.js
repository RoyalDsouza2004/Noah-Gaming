import { getDBStatus } from '../config/db.js';
import { TIMEZONE } from '../config/constants.js';

export const getHealth = (req, res) => {
  const dbStatus = getDBStatus();
  
  // Format current time in Indian Standard Time (IST)
  const now = new Date();
  const istTime = now.toLocaleString('en-IN', {
    timeZone: TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'long',
  });

  res.status(200).json({
    success: true,
    message: 'Gaming Lounge Management API is healthy and operational.',
    data: {
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestampUTC: now.toISOString(),
      timestampIST: istTime,
      timezone: TIMEZONE,
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    },
  });
};
