import * as sessionService from '../services/session.service.js';

export const getActiveSessions = async (req, res, next) => {
  try {
    // If staff requests all lounge active sessions (e.g., reception live view with ?all=true)
    let customerId = req.user._id;
    if (req.user.role === 'admin' || req.user.role === 'receptionist') {
      if (req.query.all === 'true') {
        customerId = null;
      } else if (req.query.customerId) {
        customerId = req.query.customerId;
      }
    }

    const sessions = await sessionService.getActiveSessions({ customerId });
    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionById = async (req, res, next) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

export const startSession = async (req, res, next) => {
  try {
    const bookingId = req.params.id || req.body.bookingId;
    const session = await sessionService.startGamingSession({
      bookingId,
      staffUser: req.user,
    });
    res.status(200).json({
      success: true,
      message: 'Gaming session timer started successfully.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

export const extendSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const {
      extendedDurationHours,
      paymentMethod,
      paymentAmountPaise,
      transactionReference,
      notes,
    } = req.body;

    const session = await sessionService.extendGamingSession({
      sessionId,
      extendedDurationHours,
      paymentMethod,
      paymentAmountPaise,
      transactionReference,
      staffUser: req.user,
      notes,
    });

    res.json({
      success: true,
      message: 'Gaming session extended successfully.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

export const completeSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { paymentCollection, notes } = req.body;

    const result = await sessionService.completeGamingSession({
      sessionId,
      staffUser: req.user,
      paymentCollection,
      notes,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};
