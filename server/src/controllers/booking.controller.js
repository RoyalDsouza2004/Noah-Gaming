import Booking from '../models/Booking.js';
import {
  getDeviceDailyAvailability,
  createBookingAtomic,
  cancelBookingService,
} from '../services/booking.service.js';
import { formatISTDate } from '../utils/timeSlots.js';

// GET /api/bookings/availability
export const getAvailability = async (req, res) => {
  try {
    const { deviceId, date, duration = 1, gameId } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId query parameter is required',
      });
    }

    const queryDate = date || formatISTDate(new Date());

    // If user is authenticated, validate advance booking limit
    if (req.user?._id) {
      try {
        const { validateCustomerAdvanceBooking } = await import('../services/membership.service.js');
        await validateCustomerAdvanceBooking({ customerId: req.user._id, bookingDate: queryDate });
      } catch (limitErr) {
        return res.status(limitErr.status || 400).json({
          success: false,
          code: limitErr.code || 'ADVANCE_BOOKING_LIMIT_EXCEEDED',
          message: limitErr.message,
        });
      }
    }

    const availabilityData = await getDeviceDailyAvailability(
      deviceId,
      queryDate,
      parseFloat(duration) || 1,
      gameId || null
    );

    res.status(200).json({
      success: true,
      data: availabilityData,
    });
  } catch (err) {
    console.error('Availability Error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Error checking availability',
    });
  }
};

// POST /api/bookings
export const createCustomerBooking = async (req, res) => {
  try {
    const {
      deviceId,
      gameId = null,
      pricingCategory,
      gameClassification,
      isVenueSelection = false,
      bookingType = 'SHARED',
      bookingDate,
      startTime,
      duration = 1,
      numberOfPlayers = 1,
      notes,
    } = req.body;

    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

    if (!deviceId || !bookingDate || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'deviceId, bookingDate (YYYY-MM-DD), and startTime (HH:mm) are required',
      });
    }

    const booking = await createBookingAtomic({
      customerId: req.user._id,
      deviceId,
      gameId: gameId || null,
      pricingCategory,
      gameClassification,
      isVenueSelection: Boolean(isVenueSelection),
      bookingType,
      bookingDate,
      startTime,
      duration: parseFloat(duration) || 1,
      numberOfPlayers: parseInt(numberOfPlayers) || 1,
      notes,
      idempotencyKey,
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('device', 'name deviceCode deviceType capacity')
      .populate('game', 'name category thumbnail isExclusive')
      .populate('customer', 'name email phone');

    res.status(201).json({
      success: true,
      message: `Booking ${booking.bookingId} confirmed successfully!`,
      data: { booking: populatedBooking },
    });
  } catch (err) {
    console.error('Create Booking Error:', err.message);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to complete booking',
    });
  }
};

// GET /api/bookings/my-bookings
export const getMyBookings = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const filter = { customer: req.user._id };

    if (status) filter.bookingStatus = status;
    if (type) filter.bookingType = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('device', 'name deviceCode deviceType capacity image')
        .populate('game', 'name category thumbnail isExclusive')
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your bookings',
      error: err.message,
    });
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('device', 'name deviceCode deviceType capacity image')
      .populate('game', 'name category thumbnail isExclusive')
      .populate('customer', 'name email phone role');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Role check: customer can only view own booking; staff/admin can view any
    if (
      req.user.role === 'customer' &&
      booking.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this booking record.',
      });
    }

    res.status(200).json({
      success: true,
      data: { booking },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking details',
      error: err.message,
    });
  }
};

// PATCH /api/bookings/:id/cancel
export const cancelMyBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await cancelBookingService(
      req.params.id,
      req.user._id,
      req.user.role,
      reason
    );

    res.status(200).json({
      success: true,
      message: `Booking ${booking.bookingId} cancelled successfully. Occupied positions released.`,
      data: { booking },
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Error cancelling booking',
    });
  }
};
