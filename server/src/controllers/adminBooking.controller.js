import Booking from '../models/Booking.js';
import Device from '../models/Device.js';
import DeviceMaintenance from '../models/DeviceMaintenance.js';
import User from '../models/User.js';
import { createBookingAtomic, cancelBookingService } from '../services/booking.service.js';
import { scheduleService } from '../services/schedule.service.js';
import { parseISTDateTime, formatISTDate } from '../utils/timeSlots.js';
import {
  normalizePhone,
  isValidIndianPhone,
  normalizeEmail,
  isValidEmail,
  isPlaceholderEmail,
} from '../utils/validators.js';

// GET /api/admin/bookings
export const getAllBookingsAdmin = async (req, res) => {
  try {
    const {
      date,
      device,
      game,
      customer,
      bookingType,
      bookingStatus,
      paymentStatus,
      search,
      page = 1,
      limit = 25,
    } = req.query;

    const filter = {};

    if (date) filter.bookingDate = date;
    if (device) filter.device = device;
    if (game) filter.game = game;
    if (customer) filter.customer = customer;
    if (bookingType) filter.bookingType = bookingType;
    if (bookingStatus) filter.bookingStatus = bookingStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    if (search) {
      filter.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total, stats] = await Promise.all([
      Booking.find(filter)
        .populate('device', 'name deviceCode deviceType capacity')
        .populate('game', 'name category isExclusive')
        .populate('customer', 'name email phone')
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(filter),
      Booking.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalRevenuePaise: {
              $sum: {
                $cond: [{ $ne: ['$bookingStatus', 'CANCELLED'] }, '$totalAmount', 0],
              },
            },
            confirmedCount: {
              $sum: { $cond: [{ $eq: ['$bookingStatus', 'CONFIRMED'] }, 1, 0] },
            },
            cancelledCount: {
              $sum: { $cond: [{ $eq: ['$bookingStatus', 'CANCELLED'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const aggregateStats = stats[0] || {
      totalRevenuePaise: 0,
      confirmedCount: 0,
      cancelledCount: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        bookings,
        stats: {
          totalBookings: total,
          totalRevenueRupees: aggregateStats.totalRevenuePaise / 100,
          totalRevenuePaise: aggregateStats.totalRevenuePaise,
          confirmedCount: aggregateStats.confirmedCount,
          cancelledCount: aggregateStats.cancelledCount,
        },
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
      message: 'Failed to retrieve bookings',
      error: err.message,
    });
  }
};

// POST /api/admin/bookings (Walk-in & manual creation by Staff/Admin)
export const createBookingAdmin = async (req, res) => {
  try {
    const {
      customerId,
      customerPhone,
      customerName,
      customerEmail,
      deviceId,
      gameId,
      bookingType = 'SHARED',
      bookingDate,
      startTime,
      duration = 1,
      numberOfPlayers = 1,
      notes,
    } = req.body;

    let targetCustomerId = customerId;

    // If customerId not provided, search or create customer on-the-fly for walk-in
    if (!targetCustomerId) {
      if (!customerPhone || !String(customerPhone).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Customer mobile number is mandatory.',
        });
      }

      if (!customerEmail || !String(customerEmail).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Customer email address is mandatory for registration. Placeholder emails are not permitted.',
        });
      }

      const cleanPhone = normalizePhone(customerPhone);
      if (!isValidIndianPhone(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Customer mobile number must be a valid 10-digit number.',
        });
      }

      const cleanEmail = normalizeEmail(customerEmail);
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid customer email address.',
        });
      }

      if (isPlaceholderEmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Placeholder or fake email addresses are not permitted. Please enter the customer\'s real email address.',
        });
      }

      const existingPhone = await User.findOne({
        $or: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `+91 ${cleanPhone}` }],
      });
      const existingEmail = await User.findOne({ email: cleanEmail });

      if (existingPhone && existingEmail && existingPhone._id.toString() !== existingEmail._id.toString()) {
        return res.status(409).json({
          success: false,
          message: `Conflicting records: Mobile '${cleanPhone}' belongs to '${existingPhone.name}', while email '${cleanEmail}' is registered to '${existingEmail.name}'.`,
        });
      }

      let existing = existingPhone || existingEmail;
      if (!existing) {
        if (!customerName || !String(customerName).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Customer name is mandatory for new player registration.',
          });
        }

        existing = new User({
          name: customerName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          password: `NoahPass_${Math.random().toString(36).slice(-8)}!1`,
          role: 'customer',
          accountType: 'GUEST',
          isGuest: true,
        });
        await existing.save();
      }
      targetCustomerId = existing._id;
    }

    const booking = await createBookingAtomic({
      customerId: targetCustomerId,
      deviceId,
      gameId,
      bookingType,
      bookingDate,
      startTime,
      duration: parseFloat(duration) || 1,
      numberOfPlayers: parseInt(numberOfPlayers) || 1,
      notes: notes ? `[Admin/Walk-in] ${notes}` : '[Admin/Walk-in]',
    });

    const populated = await Booking.findById(booking._id)
      .populate('device', 'name deviceCode deviceType capacity')
      .populate('game', 'name category isExclusive')
      .populate('customer', 'name email phone');

    res.status(201).json({
      success: true,
      message: `Manual reservation ${booking.bookingId} confirmed successfully!`,
      data: { booking: populated },
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Error creating manual booking',
    });
  }
};

// PATCH /api/admin/bookings/:id
export const updateBookingAdmin = async (req, res) => {
  try {
    const { bookingStatus, paymentStatus, notes, cancellationReason, gameId } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (gameId) {
      const Game = (await import('../models/Game.js')).default;
      const game = await Game.findById(gameId);
      if (game) {
        if (booking.gameClassification === 'NON_EXCLUSIVE' && (game.isExclusive || /GTA/i.test(game.name))) {
          return res.status(400).json({
            success: false,
            message: 'Cannot assign an exclusive title to a non-exclusive booking without authorized pricing adjustment.',
          });
        }
        booking.game = game._id;
        booking.gameTitle = game.name;
        booking.isVenueSelection = false;
      }
    }

    if (bookingStatus) {
      if (bookingStatus === 'CANCELLED' && booking.bookingStatus !== 'CANCELLED') {
        booking.bookingStatus = 'CANCELLED';
        booking.cancellationReason = cancellationReason || 'Cancelled by staff/admin';
        booking.cancelledAt = new Date();
      } else {
        booking.bookingStatus = bookingStatus;
      }
    }

    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (typeof notes === 'string') booking.notes = notes;

    await booking.save();

    res.status(200).json({
      success: true,
      message: `Booking ${booking.bookingId} updated successfully.`,
      data: { booking },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update booking',
      error: err.message,
    });
  }
};

// GET /api/admin/bookings/calendar
export const getCalendarBookings = async (req, res) => {
  try {
    const { date, view = 'daily', deviceId } = req.query;
    const queryDateStr = date || formatISTDate(new Date());

    const deviceFilter = {};
    if (deviceId) {
      deviceFilter._id = deviceId;
    }

    const devices = await Device.find(deviceFilter).sort({ deviceType: 1, name: 1 });

    // Determine date range based on view
    let startQueryDate = parseISTDateTime(queryDateStr, '00:00');
    let endQueryDate = parseISTDateTime(queryDateStr, '23:59');

    if (view === 'weekly') {
      // 7 days from queryDate
      endQueryDate = new Date(startQueryDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (view === 'monthly') {
      // 30 days
      endQueryDate = new Date(startQueryDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch confirmed bookings in interval
    const bookings = await Booking.find({
      startAt: { $lt: endQueryDate },
      endAt: { $gt: startQueryDate },
      bookingStatus: { $ne: 'CANCELLED' },
      ...(deviceId ? { device: deviceId } : {}),
    })
      .populate('device', 'name deviceCode deviceType capacity')
      .populate('customer', 'name phone')
      .populate('game', 'name category isExclusive');

    // Fetch maintenance records in interval
    const maintenanceRecords = await DeviceMaintenance.find({
      startDate: { $lt: endQueryDate },
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
      ...(deviceId ? { device: deviceId } : {}),
    }).populate('device', 'name deviceCode');

    // Group by device timeline
    const timeline = devices.map((dev) => {
      const devBookings = bookings.filter(
        (b) => b.device?._id?.toString() === dev._id.toString()
      );
      const devMaintenance = maintenanceRecords.filter(
        (m) => m.device?._id?.toString() === dev._id.toString()
      );

      return {
        device: {
          id: dev._id,
          name: dev.name,
          deviceCode: dev.deviceCode,
          deviceType: dev.deviceType,
          capacity: dev.capacity,
          status: dev.status,
        },
        bookingsCount: devBookings.length,
        bookings: devBookings,
        maintenance: devMaintenance,
      };
    });

    // Fetch effective schedule and calculate operating slots for this date
    let effectiveSchedule = null;
    let operatingSlots = [];
    let conflictingBookings = [];
    try {
      effectiveSchedule = await scheduleService.getEffectiveDaySchedule(queryDateStr);
      if (!effectiveSchedule.isClosed && effectiveSchedule.openTime && effectiveSchedule.closeTime) {
        const [openH] = effectiveSchedule.openTime.split(':').map(Number);
        const [closeH, closeM] = effectiveSchedule.closeTime.split(':').map(Number);
        const effectiveLastHour = closeM > 0 ? closeH : closeH - 1;
        for (let h = openH; h <= effectiveLastHour; h++) {
          operatingSlots.push(`${String(h).padStart(2, '0')}:00`);
        }
      }

      if (effectiveSchedule.isClosed) {
        conflictingBookings = bookings;
      } else if (effectiveSchedule.closeTime) {
        const closeTimeStr = effectiveSchedule.closeTime;
        conflictingBookings = bookings.filter((b) => b.endTime && b.endTime > closeTimeStr);
      }
    } catch (e) {
      // Fallback
      operatingSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
    }

    res.status(200).json({
      success: true,
      data: {
        view,
        date: queryDateStr,
        timeline,
        totalBookingsInRange: bookings.length,
        effectiveSchedule,
        operatingSlots,
        conflictingBookings,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate calendar view',
      error: err.message,
    });
  }
};
