import * as analyticsService from '../services/analytics.service.js';

export const getDashboardKPIs = async (req, res, next) => {
  try {
    const data = await analyticsService.getDashboardKPIs();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueAnalytics(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueByDevice = async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueByDevice(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueByGame = async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueByGame(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueByPaymentMethod = async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueByPaymentMethod(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getBookingAnalytics(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingTrends = async (req, res, next) => {
  try {
    const data = await analyticsService.getBookingAnalytics(req.query);
    res.json({
      success: true,
      data: {
        peakDays: data.peakDays,
        peakHours: data.peakHours,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDeviceUtilization = async (req, res, next) => {
  try {
    const data = await analyticsService.getDeviceUtilization(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getGamePerformance = async (req, res, next) => {
  try {
    const data = await analyticsService.getGamePerformance(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getCustomerAnalytics(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMembershipAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getMembershipAnalytics(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getReceptionistPerformance = async (req, res, next) => {
  try {
    const data = await analyticsService.getReceptionistPerformance(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getMaintenanceAnalytics();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getFinancialPaymentReports = async (req, res, next) => {
  try {
    const data = await analyticsService.getFinancialPaymentReports(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
