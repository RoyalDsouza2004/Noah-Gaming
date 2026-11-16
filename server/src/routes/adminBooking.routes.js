import { Router } from 'express';
import {
  getAllBookingsAdmin,
  createBookingAdmin,
  updateBookingAdmin,
  getCalendarBookings,
} from '../controllers/adminBooking.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireStaff } from '../middlewares/rbac.js';

const router = Router();

// All administrative booking operations require Staff or Admin authentication
router.use(authenticate, requireStaff);

router.get('/', getAllBookingsAdmin);
router.post('/', createBookingAdmin);
router.get('/calendar', getCalendarBookings);
router.patch('/:id', updateBookingAdmin);

export default router;
