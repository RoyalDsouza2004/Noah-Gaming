import * as scheduleService from '../services/schedule.service.js';

/**
 * 1. GET /api/schedule/operating-status
 * Public & Front Desk live operating status, today's schedule, weekly timings, and upcoming holidays
 */
export const getOperatingStatus = async (req, res, next) => {
  try {
    const statusData = await scheduleService.getLoungeOperatingStatus();
    res.status(200).json({
      success: true,
      data: statusData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. GET /api/schedule/effective-day?date=YYYY-MM-DD
 * Returns effective schedule for a specific date (evaluating holidays, special hours, and weekly schedule)
 */
export const getEffectiveDay = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD)' });
    }
    const schedule = await scheduleService.getEffectiveDaySchedule(date);
    res.status(200).json({
      success: true,
      data: schedule,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. GET /api/admin/schedule/operating-hours
 * Admin: Get weekly operating schedule for all 7 weekdays
 */
export const getAdminWeeklyHours = async (req, res, next) => {
  try {
    const weeklySchedule = await scheduleService.getWeeklyOperatingHours();
    const scheduleMap = {};
    for (const d of weeklySchedule) {
      const dayKey = (d.key || d.dayOfWeek || d.day || '').toLowerCase();
      if (!dayKey) continue;
      scheduleMap[dayKey] = {
        day: d.day || dayKey.charAt(0).toUpperCase() + dayKey.slice(1),
        dayOfWeek: dayKey,
        key: dayKey,
        dayIndex: d.dayIndex !== undefined ? d.dayIndex : 0,
        isOpen: d.isOpen !== false,
        openTime: d.openTime || '10:00',
        closeTime: d.closeTime || '23:00',
        slotDurationMinutes: d.slotDurationMinutes || 60,
      };
    }
    res.status(200).json({
      success: true,
      data: {
        schedule: scheduleMap,
        weeklySchedule,
      },
      schedule: scheduleMap,
      weeklySchedule,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. PUT /api/admin/schedule/operating-hours
 * Admin: Update weekly operating schedule for all 7 weekdays
 */
export const updateAdminWeeklyHours = async (req, res, next) => {
  try {
    const { schedule } = req.body;
    const updated = await scheduleService.updateWeeklyOperatingHours({
      schedule: schedule !== undefined ? schedule : req.body,
      updatedBy: req.user?._id,
    });
    const scheduleMap = {};
    for (const d of updated) {
      const dayKey = (d.key || d.dayOfWeek || d.day || '').toLowerCase();
      if (!dayKey) continue;
      scheduleMap[dayKey] = {
        day: d.day || dayKey.charAt(0).toUpperCase() + dayKey.slice(1),
        dayOfWeek: dayKey,
        key: dayKey,
        dayIndex: d.dayIndex !== undefined ? d.dayIndex : 0,
        isOpen: d.isOpen !== false,
        openTime: d.openTime || '10:00',
        closeTime: d.closeTime || '23:00',
        slotDurationMinutes: d.slotDurationMinutes || 60,
      };
    }
    res.status(200).json({
      success: true,
      data: {
        schedule: scheduleMap,
        weeklySchedule: updated,
      },
      schedule: scheduleMap,
      weeklySchedule: updated,
      message: 'Weekly operating hours updated successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. GET /api/admin/schedule/holidays
 * Admin: List holidays and closures with pagination & search
 */
export const getAdminHolidays = async (req, res, next) => {
  try {
    const { status, search, limit, page } = req.query;
    const result = await scheduleService.getHolidays({ status, search, limit, page });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. POST /api/admin/schedule/holidays
 * Admin: Add new holiday / closure
 */
export const createAdminHoliday = async (req, res, next) => {
  try {
    const holiday = await scheduleService.createHoliday({
      ...req.body,
      createdBy: req.user?._id,
    });
    res.status(201).json({
      success: true,
      data: holiday,
      message: `Holiday '${holiday.name}' scheduled successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. PUT /api/admin/schedule/holidays/:id
 * Admin: Edit existing holiday / closure
 */
export const updateAdminHoliday = async (req, res, next) => {
  try {
    const holiday = await scheduleService.updateHoliday(req.params.id, {
      ...req.body,
      updatedBy: req.user?._id,
    });
    res.status(200).json({
      success: true,
      data: holiday,
      message: `Holiday '${holiday.name}' updated successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. DELETE /api/admin/schedule/holidays/:id
 * Admin: Delete holiday / reopen lounge
 */
export const deleteAdminHoliday = async (req, res, next) => {
  try {
    const result = await scheduleService.deleteHoliday(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 9. POST /api/admin/schedule/check-conflicts
 * Admin: Check existing confirmed bookings against proposed schedule or holiday
 */
export const checkConflicts = async (req, res, next) => {
  try {
    const conflictResult = await scheduleService.checkScheduleConflicts(req.body);
    res.status(200).json({
      success: true,
      data: conflictResult,
    });
  } catch (err) {
    next(err);
  }
};
