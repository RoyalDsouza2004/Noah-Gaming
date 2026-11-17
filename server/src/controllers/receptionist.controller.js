import * as receptionistService from '../services/receptionist.service.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await receptionistService.getReceptionistDashboardStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

export const searchCustomers = async (req, res, next) => {
  try {
    const query = req.query.q || req.query.query || '';
    const customers = await receptionistService.searchCustomersForReceptionist({ query });
    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerDetails = async (req, res, next) => {
  try {
    const customerDetails = await receptionistService.getReceptionistCustomerDetails({
      customerId: req.params.id,
      historyFilter: req.query.filter || 'all',
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.status(200).json({
      success: true,
      data: customerDetails,
    });
  } catch (err) {
    next(err);
  }
};

export const registerCustomer = async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    const result = await receptionistService.registerCustomerAtReception({
      name,
      phone,
      email,
      staffUser: req.user,
    });
    res.status(201).json({
      success: true,
      data: result.customer,
      alreadyExists: result.alreadyExists,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

export const createWalkIn = async (req, res, next) => {
  try {
    const result = await receptionistService.createWalkInBooking({
      ...req.body,
      staffUser: req.user,
    });
    res.status(201).json({
      success: true,
      data: result,
      message: 'Walk-in booking created successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const getTodayBookingsHandler = async (req, res, next) => {
  try {
    const { search, status, checkInStatus } = req.query;
    const bookings = await receptionistService.getTodayBookings({ search, status, checkInStatus });
    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    next(err);
  }
};

export const getUpcomingBookingsHandler = async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const bookings = await receptionistService.getUpcomingBookings({ limit });
    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    next(err);
  }
};

export const getBookingDetails = async (req, res, next) => {
  try {
    const booking = await receptionistService.getBookingDetailsForReceptionist(req.params.id);
    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
};

export const checkIn = async (req, res, next) => {
  try {
    const { paymentCollection } = req.body;
    const result = await receptionistService.checkInBooking({
      bookingId: req.params.id,
      staffUser: req.user,
      paymentCollection,
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Customer checked in successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const markNoShow = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await receptionistService.markBookingNoShow({
      bookingId: req.params.id,
      staffUser: req.user,
      reason,
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Booking marked as No-Show',
    });
  } catch (err) {
    next(err);
  }
};

export const getActiveSessionsHandler = async (req, res, next) => {
  try {
    const sessions = await receptionistService.getActiveSessions();
    res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
};

export const startSessionHandler = async (req, res, next) => {
  try {
    const result = await receptionistService.startSession({
      bookingId: req.params.id,
      staffUser: req.user,
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Gaming session started',
    });
  } catch (err) {
    next(err);
  }
};

export const previewExtensionHandler = async (req, res, next) => {
  try {
    const { durationHours } = req.query;
    const preview = await receptionistService.previewSessionExtension({
      bookingId: req.params.id,
      extendedDurationHours: parseFloat(durationHours) || 1,
    });
    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (err) {
    next(err);
  }
};

export const extendSessionHandler = async (req, res, next) => {
  try {
    const {
      extendedDurationHours,
      paymentMethod,
      paymentAmountPaise,
      transactionReference,
      notes,
    } = req.body;

    const result = await receptionistService.extendSession({
      bookingId: req.params.id,
      extendedDurationHours,
      paymentMethod,
      paymentAmountPaise,
      transactionReference,
      staffUser: req.user,
      notes,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Session extended by +${extendedDurationHours} hour(s)`,
    });
  } catch (err) {
    next(err);
  }
};

export const completeSessionHandler = async (req, res, next) => {
  try {
    const { paymentCollection, notes } = req.body;
    const result = await receptionistService.completeSession({
      bookingId: req.params.id,
      staffUser: req.user,
      paymentCollection,
      notes,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Gaming session completed successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const collectOfflinePayment = async (req, res, next) => {
  try {
    const {
      bookingId,
      amountPaise,
      paymentMethod,
      transactionReference,
      notes,
    } = req.body;

    const result = await receptionistService.collectReceptionistOfflinePayment({
      bookingId,
      amountPaise,
      paymentMethod,
      transactionReference,
      staffUser: req.user,
      notes,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Offline payment collected and receipt generated',
    });
  } catch (err) {
    next(err);
  }
};

export const getPendingPaymentsHandler = async (req, res, next) => {
  try {
    const bookings = await receptionistService.getPendingPaymentsList();
    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    next(err);
  }
};

export const getActivityLogsHandler = async (req, res, next) => {
  try {
    const result = await receptionistService.getReceptionistActivityLogs(req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
