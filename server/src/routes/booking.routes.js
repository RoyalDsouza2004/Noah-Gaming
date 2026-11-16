import { Router } from 'express';
import {
  getAvailability,
  createCustomerBooking,
  getMyBookings,
  getBookingById,
  cancelMyBooking,
} from '../controllers/booking.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Availability check (Public / Customer)
router.get('/availability', getAvailability);

// Customer booking operations (Protected by JWT)
router.post('/', authenticate, createCustomerBooking);
router.get('/my-bookings', authenticate, getMyBookings);
router.get('/:id', authenticate, getBookingById);
router.patch('/:id/cancel', authenticate, cancelMyBooking);

export default router;
