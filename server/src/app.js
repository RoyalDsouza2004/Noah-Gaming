import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import deviceRoutes from './routes/device.routes.js';
import gameRoutes from './routes/game.routes.js';
import categoryRoutes from './routes/category.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import adminBookingRoutes from './routes/adminBooking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import adminPaymentRoutes from './routes/adminPayment.routes.js';
import membershipRoutes from './routes/membership.routes.js';
import adminMembershipRoutes from './routes/adminMembership.routes.js';
import receptionistRoutes from './routes/receptionist.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import sessionRoutes from './routes/session.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminAutomationRoutes from './routes/adminAutomation.routes.js';
import userManagementRoutes from './routes/userManagement.routes.js';
import adminEmailRoutes from './routes/adminEmail.routes.js';
import pushNotificationRoutes from './routes/pushNotification.routes.js';
import cloudinaryRoutes from './routes/cloudinary.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import { getAdminNotifications } from './controllers/adminAutomation.controller.js';
import { authenticate } from './middlewares/auth.js';
import { requireAdmin } from './middlewares/rbac.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { sanitizeInput } from './middlewares/sanitize.js';

const app = express();

app.set('trust proxy', 1);

// Security headers with cross-origin resource policy
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Multi-Origin Cross-Origin Resource Sharing (CORS)
const getAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

const isOriginAllowed = (origin, allowedPatterns) => {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/+$/, '');
  return allowedPatterns.some((pattern) => {
    if (pattern === '*' || pattern === normalizedOrigin) return true;
    if (pattern.includes('*')) {
      const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(normalizedOrigin);
    }
    return false;
  });
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      const allowed = getAllowedOrigins();
      if (isOriginAllowed(origin, allowed)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: Origin '${origin}' is not authorized.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-razorpay-signature'],
    optionsSuccessStatus: 204,
  })
);

// Body parsing with rawBody capture for payment webhook signature validation
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL Injection Sanitization
app.use(sanitizeInput);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global API rate limiting
app.use('/api/', apiLimiter);

// Mount core routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminPaymentRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/admin/memberships', adminMembershipRoutes);
app.use('/api/receptionist', receptionistRoutes);
app.use('/api/admin/receptionist', receptionistRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushNotificationRoutes);
app.use('/api/admin/automation', adminAutomationRoutes);
app.use('/api/admin/notifications', authenticate, requireAdmin, getAdminNotifications);
app.use('/api/admin/users', userManagementRoutes);
app.use('/api/users-management', userManagementRoutes);
app.use('/api/admin/email', adminEmailRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/api/schedule', scheduleRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Gaming Lounge Management API',
    status: 'ONLINE',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' not found.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }
  console.error('[Global Error]', err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
