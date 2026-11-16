import * as automationService from '../services/automation.service.js';
import * as notificationService from '../services/notification.service.js';
import AutomationLog from '../models/AutomationLog.js';

export const getAutomationSettings = async (req, res, next) => {
  try {
    const settings = await automationService.getAutomationSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAutomationSettings = async (req, res, next) => {
  try {
    const settings = await automationService.updateAutomationSettings(req.body);
    res.json({
      success: true,
      message: 'Automation settings updated successfully.',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

export const getAutomationLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AutomationLog.find({})
        .sort({ executedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AutomationLog.countDocuments({}),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const triggerAutomationCycle = async (req, res, next) => {
  try {
    const result = await automationService.executeMasterAutomationCycle();
    res.json({
      success: true,
      message: 'Automation cycle triggered and executed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminNotifications = async (req, res, next) => {
  try {
    const data = await notificationService.getAdminNotifications(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
