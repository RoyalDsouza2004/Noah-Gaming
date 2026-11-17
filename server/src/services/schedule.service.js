import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import Holiday from '../models/Holiday.js';
import Booking from '../models/Booking.js';
import {
  parseISTDateTime,
  formatISTDate,
  formatISTTime,
  getOperatingHours as getLegacyOperatingHours,
} from '../utils/timeSlots.js';

// Canonical weekdays definition (Mon-Sun)
export const CANONICAL_WEEKDAYS = [
  { day: 'Monday', dayIndex: 1, key: 'monday' },
  { day: 'Tuesday', dayIndex: 2, key: 'tuesday' },
  { day: 'Wednesday', dayIndex: 3, key: 'wednesday' },
  { day: 'Thursday', dayIndex: 4, key: 'thursday' },
  { day: 'Friday', dayIndex: 5, key: 'friday' },
  { day: 'Saturday', dayIndex: 6, key: 'saturday' },
  { day: 'Sunday', dayIndex: 0, key: 'sunday' },
];

// Default standard weekly operating schedule (Mon-Sun)
export const DEFAULT_WEEKLY_SCHEDULE = [
  { day: 'Monday', dayOfWeek: 'monday', key: 'monday', dayIndex: 1, isOpen: true, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60 },
  { day: 'Tuesday', dayOfWeek: 'tuesday', key: 'tuesday', dayIndex: 2, isOpen: true, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60 },
  { day: 'Wednesday', dayOfWeek: 'wednesday', key: 'wednesday', dayIndex: 3, isOpen: true, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60 },
  { day: 'Thursday', dayOfWeek: 'thursday', key: 'thursday', dayIndex: 4, isOpen: true, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60 },
  { day: 'Friday', dayOfWeek: 'friday', key: 'friday', dayIndex: 5, isOpen: true, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60 },
  { day: 'Saturday', dayOfWeek: 'saturday', key: 'saturday', dayIndex: 6, isOpen: true, openTime: '09:00', closeTime: '23:00', slotDurationMinutes: 60 },
  { day: 'Sunday', dayOfWeek: 'sunday', key: 'sunday', dayIndex: 0, isOpen: true, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60 },
];

/**
 * 1. Get Weekly Operating Schedule
 */
export async function getWeeklyOperatingHours() {
  const setting = await Setting.findOne({ key: 'operating_hours_weekly' });
  if (setting && Array.isArray(setting.value) && setting.value.length === 7) {
    return setting.value.map((d) => {
      const dayKey = (d.key || d.dayOfWeek || d.day || '').toLowerCase();
      return {
        ...d,
        day: d.day || dayKey.charAt(0).toUpperCase() + dayKey.slice(1),
        dayOfWeek: dayKey,
        key: dayKey,
      };
    });
  }

  // Fallback to legacy single setting if present
  const legacy = await getLegacyOperatingHours();
  return DEFAULT_WEEKLY_SCHEDULE.map((d) => ({
    ...d,
    openTime: legacy.openTime || d.openTime,
    closeTime: legacy.closeTime || d.closeTime,
    slotDurationMinutes: legacy.slotDurationMinutes || 60,
  }));
}

/**
 * 2. Update Weekly Operating Schedule
 */
export async function updateWeeklyOperatingHours({ schedule, updatedBy }) {
  if (!schedule) {
    const err = new Error('Weekly schedule payload is required.');
    err.status = 400;
    throw err;
  }

  // Handle various payload structures: raw array, { schedule: [...] }, or object with day keys
  let rawItems = schedule;
  while (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
    if (rawItems.schedule !== undefined) {
      rawItems = rawItems.schedule;
    } else if (rawItems.weeklySchedule !== undefined) {
      rawItems = rawItems.weeklySchedule;
    } else {
      break;
    }
  }

  const normalizedSchedule = [];

  for (const canonical of CANONICAL_WEEKDAYS) {
    let dayData = null;

    if (Array.isArray(rawItems)) {
      dayData = rawItems.find(
        (d) =>
          d &&
          (d.dayIndex === canonical.dayIndex ||
            (d.day && d.day.toLowerCase() === canonical.key) ||
            (d.dayOfWeek && d.dayOfWeek.toLowerCase() === canonical.key) ||
            (d.key && d.key.toLowerCase() === canonical.key) ||
            (d.name && d.name.toLowerCase() === canonical.key))
      );
    } else if (rawItems && typeof rawItems === 'object') {
      dayData =
        rawItems[canonical.key] ||
        rawItems[canonical.day] ||
        rawItems[canonical.day.toLowerCase()] ||
        rawItems[canonical.key.toUpperCase()];
    }

    if (!dayData) {
      const err = new Error(
        `Weekly schedule must contain exactly 7 days (Monday to Sunday). Missing entry for ${canonical.day}.`
      );
      err.status = 400;
      throw err;
    }

    const isOpen = typeof dayData.isOpen === 'boolean' ? dayData.isOpen : Boolean(dayData.isOpen);
    const openTime = (dayData.openTime || '10:00').trim();
    const closeTime = (dayData.closeTime || '23:00').trim();
    const slotDurationMinutes = parseInt(dayData.slotDurationMinutes, 10) || 60;

    normalizedSchedule.push({
      day: canonical.day,
      dayOfWeek: canonical.key,
      key: canonical.key,
      dayIndex: canonical.dayIndex,
      isOpen,
      openTime,
      closeTime,
      slotDurationMinutes,
    });
  }

  if (normalizedSchedule.length !== 7) {
    const err = new Error('Weekly schedule must contain exactly 7 days (Monday to Sunday).');
    err.status = 400;
    throw err;
  }

  // Validate time format (HH:mm)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  for (const day of normalizedSchedule) {
    if (day.isOpen) {
      if (!timeRegex.test(day.openTime) || !timeRegex.test(day.closeTime)) {
        const err = new Error(`Invalid time format for ${day.day}. Must be HH:mm (24-hour).`);
        err.status = 400;
        throw err;
      }
      const [oH, oM] = day.openTime.split(':').map(Number);
      const [cH, cM] = day.closeTime.split(':').map(Number);
      if (cH * 60 + cM <= oH * 60 + oM) {
        const err = new Error(`Closing time must be after opening time for ${day.day} (${day.openTime} to ${day.closeTime}).`);
        err.status = 400;
        throw err;
      }
    }
  }

  const validUpdatedBy = (updatedBy && mongoose.Types.ObjectId.isValid(updatedBy)) ? updatedBy : null;

  const updated = await Setting.findOneAndUpdate(
    { key: 'operating_hours_weekly' },
    {
      key: 'operating_hours_weekly',
      value: normalizedSchedule,
      category: 'HOURS',
      description: 'Admin-configured weekly operating schedule for each weekday',
      updatedBy: validUpdatedBy,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Synchronize legacy operating_hours setting as well
  const mondayEntry = normalizedSchedule.find((d) => d.dayIndex === 1) || normalizedSchedule[0];
  await Setting.findOneAndUpdate(
    { key: 'operating_hours' },
    {
      key: 'operating_hours',
      value: {
        openTime: mondayEntry.openTime || '10:00',
        closeTime: mondayEntry.closeTime || '23:00',
        slotDurationMinutes: mondayEntry.slotDurationMinutes || 60,
        isOpen: mondayEntry.isOpen !== false,
        allowCustomDuration: true,
      },
      category: 'HOURS',
      description: 'Default operating hours',
      updatedBy: validUpdatedBy,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return normalizedSchedule;
}

/**
 * 3. Holiday Management CRUD
 */
export async function getHolidays({ status = 'ALL', search = '', limit = 50, page = 1 } = {}) {
  const query = {};
  if (status && status !== 'ALL') {
    query.status = status;
  }
  if (search && search.trim()) {
    query.name = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));

  const [holidays, total] = await Promise.all([
    Holiday.find(query)
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role')
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Holiday.countDocuments(query),
  ]);

  return {
    holidays,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)) || 1,
    },
  };
}

export async function createHoliday(data) {
  const {
    name,
    startDate,
    endDate,
    closureType = 'FULL_DAY',
    description = '',
    notifyCustomers = false,
    partialClosure = {},
    createdBy,
  } = data;

  if (!name || !name.trim()) {
    const err = new Error('Holiday or closure name is required.');
    err.status = 400;
    throw err;
  }
  if (!startDate || !endDate) {
    const err = new Error('Both start date and end date are required (YYYY-MM-DD).');
    err.status = 400;
    throw err;
  }
  if (startDate > endDate) {
    const err = new Error('Start date cannot be after end date.');
    err.status = 400;
    throw err;
  }

  // If partial closure, validate opening/closing or closed intervals
  if (closureType === 'PARTIAL') {
    if (partialClosure.openTime && partialClosure.closeTime) {
      const [oH, oM] = partialClosure.openTime.split(':').map(Number);
      const [cH, cM] = partialClosure.closeTime.split(':').map(Number);
      if (cH * 60 + cM <= oH * 60 + oM) {
        const err = new Error('Special closing time must be after opening time.');
        err.status = 400;
        throw err;
      }
    }
  }

  const holiday = await Holiday.create({
    name: name.trim(),
    startDate,
    endDate,
    closureType,
    description: description ? description.trim() : '',
    notifyCustomers: Boolean(notifyCustomers),
    partialClosure: closureType === 'PARTIAL' ? partialClosure : {},
    createdBy: createdBy || null,
    updatedBy: createdBy || null,
  });

  return holiday;
}

export async function updateHoliday(id, data) {
  const holiday = await Holiday.findById(id);
  if (!holiday) {
    const err = new Error('Holiday record not found.');
    err.status = 404;
    throw err;
  }

  const {
    name,
    startDate,
    endDate,
    closureType,
    description,
    notifyCustomers,
    partialClosure,
    status,
    updatedBy,
  } = data;

  if (name !== undefined) holiday.name = name.trim();
  if (startDate !== undefined) holiday.startDate = startDate;
  if (endDate !== undefined) holiday.endDate = endDate;
  if (closureType !== undefined) holiday.closureType = closureType;
  if (description !== undefined) holiday.description = description ? description.trim() : '';
  if (notifyCustomers !== undefined) holiday.notifyCustomers = Boolean(notifyCustomers);
  if (partialClosure !== undefined) holiday.partialClosure = partialClosure;
  if (status !== undefined) holiday.status = status;
  if (updatedBy) holiday.updatedBy = updatedBy;

  if (holiday.startDate > holiday.endDate) {
    const err = new Error('Start date cannot be after end date.');
    err.status = 400;
    throw err;
  }

  await holiday.save();
  return holiday;
}

export async function deleteHoliday(id) {
  const holiday = await Holiday.findById(id);
  if (!holiday) {
    const err = new Error('Holiday record not found.');
    err.status = 404;
    throw err;
  }
  await Holiday.findByIdAndDelete(id);
  return { success: true, message: `Holiday '${holiday.name}' was removed successfully.` };
}

/**
 * 4. Schedule Priority Calculator: getEffectiveDaySchedule(dateStr)
 * Priority order:
 * 1. Full-day holiday closure
 * 2. Date-specific special operating hours (partial holiday / special closure)
 * 3. Date-specific partial closed intervals
 * 4. Regular weekly operating schedule
 */
export async function getEffectiveDaySchedule(dateStr) {
  // 1. Check for Active Holidays overlapping this date
  const holiday = await Holiday.findOne({
    startDate: { $lte: dateStr },
    endDate: { $gte: dateStr },
    status: { $in: ['SCHEDULED', 'ACTIVE'] },
  });

  // Calculate day of week index in Asia/Kolkata (0 = Sunday, 1 = Monday, ... 6 = Saturday)
  const dateObj = parseISTDateTime(dateStr, '12:00');
  const dayIndex = dateObj.getDay();

  const weeklySchedule = await getWeeklyOperatingHours();
  const weeklyDay = weeklySchedule.find((d) => d.dayIndex === dayIndex) || weeklySchedule[0];

  if (holiday) {
    if (holiday.closureType === 'FULL_DAY') {
      return {
        date: dateStr,
        dayName: weeklyDay.day,
        isClosed: true,
        reason: holiday.name,
        type: 'HOLIDAY',
        holiday: {
          id: holiday._id,
          name: holiday.name,
          description: holiday.description,
          closureType: holiday.closureType,
          startDate: holiday.startDate,
          endDate: holiday.endDate,
        },
        openTime: null,
        closeTime: null,
        closedIntervals: [],
      };
    }

    if (holiday.closureType === 'PARTIAL') {
      const openTime = holiday.partialClosure?.openTime || weeklyDay.openTime || '10:00';
      const closeTime = holiday.partialClosure?.closeTime || weeklyDay.closeTime || '23:00';
      const closedIntervals = holiday.partialClosure?.closedIntervals || [];

      return {
        date: dateStr,
        dayName: weeklyDay.day,
        isClosed: false,
        reason: holiday.name,
        type: 'SPECIAL',
        holiday: {
          id: holiday._id,
          name: holiday.name,
          description: holiday.description,
          closureType: holiday.closureType,
          startDate: holiday.startDate,
          endDate: holiday.endDate,
        },
        openTime,
        closeTime,
        closedIntervals,
      };
    }
  }

  // Regular Weekly Schedule check
  if (!weeklyDay.isOpen) {
    return {
      date: dateStr,
      dayName: weeklyDay.day,
      isClosed: true,
      reason: `Closed on ${weeklyDay.day}s`,
      type: 'WEEKLY_CLOSED',
      holiday: null,
      openTime: null,
      closeTime: null,
      closedIntervals: [],
    };
  }

  return {
    date: dateStr,
    dayName: weeklyDay.day,
    isClosed: false,
    reason: null,
    type: 'REGULAR',
    holiday: null,
    openTime: weeklyDay.openTime,
    closeTime: weeklyDay.closeTime,
    closedIntervals: [],
  };
}

/**
 * 5. Booking Conflict Detection
 * Checks existing confirmed bookings against proposed schedule changes
 */
export async function checkScheduleConflicts({
  type, // 'WEEKLY_DAY', 'WEEKLY_SCHEDULE', 'HOLIDAY', 'PARTIAL_HOURS'
  dayIndex, // for WEEKLY_DAY
  isOpen, // for WEEKLY_DAY
  openTime,
  closeTime,
  weeklySchedule, // for WEEKLY_SCHEDULE
  startDate, // for HOLIDAY
  endDate, // for HOLIDAY
  closureType = 'FULL_DAY',
  closedIntervals = [],
}) {
  const now = new Date();
  const todayIST = formatISTDate(now);

  const query = {
    bookingStatus: 'CONFIRMED',
    bookingDate: { $gte: todayIST },
  };

  if (type === 'HOLIDAY') {
    query.bookingDate = { $gte: startDate, $lte: endDate };
  } else if (type === 'WEEKLY_DAY' && typeof dayIndex === 'number') {
    // We will filter by weekday on the retrieved future bookings
  }

  const futureBookings = await Booking.find(query)
    .populate('customer', 'name phone email')
    .populate('device', 'name deviceCode')
    .populate('game', 'name')
    .sort({ bookingDate: 1, startTime: 1 });

  const conflicts = [];

  for (const b of futureBookings) {
    // If checking full weekly schedule
    if (type === 'WEEKLY_SCHEDULE' && weeklySchedule) {
      const bDate = parseISTDateTime(b.bookingDate, '12:00');
      const bDayIndex = bDate.getDay();
      let dayData = null;

      if (Array.isArray(weeklySchedule)) {
        dayData = weeklySchedule.find(
          (d) =>
            d.dayIndex === bDayIndex ||
            (d.key && d.key === CANONICAL_WEEKDAYS.find((c) => c.dayIndex === bDayIndex)?.key)
        );
      } else if (typeof weeklySchedule === 'object') {
        const canonical = CANONICAL_WEEKDAYS.find((c) => c.dayIndex === bDayIndex);
        if (canonical) {
          dayData = weeklySchedule[canonical.key] || weeklySchedule[canonical.day];
        }
      }

      if (dayData) {
        const dayIsOpen = dayData.isOpen !== false;
        if (!dayIsOpen) {
          conflicts.push({
            bookingId: b.bookingId,
            customerName: b.customer?.name || 'Customer',
            customerPhone: b.customer?.phone || '',
            deviceName: b.device?.name || 'Station',
            bookingDate: b.bookingDate,
            startTime: b.startTime,
            endTime: b.endTime,
            totalAmountRupees: (b.totalAmount || 0) / 100,
            paymentStatus: b.paymentStatus,
            conflictReason: `Lounge closed on ${b.bookingDate} (${b.startTime} - ${b.endTime}) due to scheduled weekday closure.`,
          });
          continue;
        }

        if (dayData.openTime && dayData.closeTime) {
          const bStartAt = parseISTDateTime(b.bookingDate, b.startTime);
          const bEndAt = parseISTDateTime(b.bookingDate, b.endTime);
          const dayOpenAt = parseISTDateTime(b.bookingDate, dayData.openTime);
          const dayCloseAt = parseISTDateTime(b.bookingDate, dayData.closeTime);

          if (bStartAt.getTime() < dayOpenAt.getTime() || bEndAt.getTime() > dayCloseAt.getTime()) {
            conflicts.push({
              bookingId: b.bookingId,
              customerName: b.customer?.name || 'Customer',
              customerPhone: b.customer?.phone || '',
              deviceName: b.device?.name || 'Station',
              bookingDate: b.bookingDate,
              startTime: b.startTime,
              endTime: b.endTime,
              totalAmountRupees: (b.totalAmount || 0) / 100,
              paymentStatus: b.paymentStatus,
              conflictReason: `Reservation falls outside new operating hours (${dayData.openTime} to ${dayData.closeTime} IST).`,
            });
            continue;
          }
        }
      }
      continue;
    }

    // If single weekly day change
    if (type === 'WEEKLY_DAY' && typeof dayIndex === 'number') {
      const bDate = parseISTDateTime(b.bookingDate, '12:00');
      if (bDate.getDay() !== dayIndex) continue;

      if (!isOpen) {
        conflicts.push({
          bookingId: b.bookingId,
          customerName: b.customer?.name || 'Customer',
          customerPhone: b.customer?.phone || '',
          deviceName: b.device?.name || 'Station',
          bookingDate: b.bookingDate,
          startTime: b.startTime,
          endTime: b.endTime,
          totalAmountRupees: (b.totalAmount || 0) / 100,
          paymentStatus: b.paymentStatus,
          conflictReason: `Station closed on ${b.bookingDate} (${b.startTime} - ${b.endTime}) due to permanent weekday closure.`,
        });
        continue;
      }
    }

    // Check open and close times
    if (openTime && closeTime) {
      const bStartAt = parseISTDateTime(b.bookingDate, b.startTime);
      const bEndAt = parseISTDateTime(b.bookingDate, b.endTime);
      const dayOpenAt = parseISTDateTime(b.bookingDate, openTime);
      const dayCloseAt = parseISTDateTime(b.bookingDate, closeTime);

      if (bStartAt.getTime() < dayOpenAt.getTime() || bEndAt.getTime() > dayCloseAt.getTime()) {
        conflicts.push({
          bookingId: b.bookingId,
          customerName: b.customer?.name || 'Customer',
          customerPhone: b.customer?.phone || '',
          deviceName: b.device?.name || 'Station',
          bookingDate: b.bookingDate,
          startTime: b.startTime,
          endTime: b.endTime,
          totalAmountRupees: (b.totalAmount || 0) / 100,
          paymentStatus: b.paymentStatus,
          conflictReason: `Reservation falls outside new operating hours (${openTime} to ${closeTime} IST).`,
        });
        continue;
      }
    }

    // Check holiday full day closure
    if (type === 'HOLIDAY' && closureType === 'FULL_DAY') {
      conflicts.push({
        bookingId: b.bookingId,
        customerName: b.customer?.name || 'Customer',
        customerPhone: b.customer?.phone || '',
        deviceName: b.device?.name || 'Station',
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        totalAmountRupees: (b.totalAmount || 0) / 100,
        paymentStatus: b.paymentStatus,
        conflictReason: `Lounge closed on ${b.bookingDate} for holiday closure.`,
      });
      continue;
    }

    // Check closed intervals
    if (Array.isArray(closedIntervals) && closedIntervals.length > 0) {
      const bStartAt = parseISTDateTime(b.bookingDate, b.startTime);
      const bEndAt = parseISTDateTime(b.bookingDate, b.endTime);

      for (const interval of closedIntervals) {
        const intStart = parseISTDateTime(b.bookingDate, interval.startTime);
        const intEnd = parseISTDateTime(b.bookingDate, interval.endTime);

        // Check overlap: bStart < intEnd && bEnd > intStart
        if (bStartAt.getTime() < intEnd.getTime() && bEndAt.getTime() > intStart.getTime()) {
          conflicts.push({
            bookingId: b.bookingId,
            customerName: b.customer?.name || 'Customer',
            customerPhone: b.customer?.phone || '',
            deviceName: b.device?.name || 'Station',
            bookingDate: b.bookingDate,
            startTime: b.startTime,
            endTime: b.endTime,
            totalAmountRupees: (b.totalAmount || 0) / 100,
            paymentStatus: b.paymentStatus,
            conflictReason: `Reservation overlaps temporary closure interval (${interval.startTime} - ${interval.endTime}).`,
          });
          break;
        }
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflictCount: conflicts.length,
    conflicts,
    affectedBookings: conflicts,
  };
}

/**
 * 6. Public/Front-Desk Lounge Operating Status
 */
export async function getLoungeOperatingStatus() {
  const now = new Date();
  const todayIST = formatISTDate(now);
  const currentTimeIST = formatISTTime(now);

  const todaySchedule = await getEffectiveDaySchedule(todayIST);
  const weeklySchedule = await getWeeklyOperatingHours();

  // Next upcoming holiday
  const upcomingHolidays = await Holiday.find({
    endDate: { $gte: todayIST },
    status: { $in: ['SCHEDULED', 'ACTIVE'] },
  })
    .sort({ startDate: 1 })
    .limit(5);

  let currentStatus = 'CLOSED';
  let statusMessage = '';

  if (todaySchedule.isClosed) {
    currentStatus = 'CLOSED';
    statusMessage = todaySchedule.reason || 'Lounge is closed today';
  } else {
    const [nowH, nowM] = currentTimeIST.split(':').map(Number);
    const nowMinutes = nowH * 60 + nowM;

    const [openH, openM] = todaySchedule.openTime.split(':').map(Number);
    const [closeH, closeM] = todaySchedule.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    // Check if inside closed intervals
    let inClosedInterval = false;
    for (const interval of todaySchedule.closedIntervals) {
      const [iSH, iSM] = interval.startTime.split(':').map(Number);
      const [iEH, iEM] = interval.endTime.split(':').map(Number);
      if (nowMinutes >= iSH * 60 + iSM && nowMinutes < iEH * 60 + iEM) {
        inClosedInterval = true;
        statusMessage = `Temporary Closure (${interval.startTime} - ${interval.endTime}): ${interval.reason || 'Maintenance'}`;
        break;
      }
    }

    if (inClosedInterval) {
      currentStatus = 'CLOSED';
    } else if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
      currentStatus = 'OPEN';
      statusMessage = `Open until ${todaySchedule.closeTime} IST`;
    } else if (nowMinutes < openMinutes) {
      currentStatus = 'CLOSED';
      statusMessage = `Opens today at ${todaySchedule.openTime} IST`;
    } else {
      currentStatus = 'CLOSED';
      statusMessage = `Closed for today at ${todaySchedule.closeTime} IST`;
    }
  }

  const isCurrentlyOpen = currentStatus === 'OPEN';

  return {
    today: {
      ...todaySchedule,
      currentTime: currentTimeIST,
      currentStatus,
      statusMessage,
    },
    todaySchedule: {
      ...todaySchedule,
      currentTime: currentTimeIST,
      currentStatus,
      statusMessage,
    },
    isCurrentlyOpen,
    currentStatus,
    statusMessage,
    weeklySchedule,
    upcomingHolidays,
  };
}

export const scheduleService = {
  CANONICAL_WEEKDAYS,
  DEFAULT_WEEKLY_SCHEDULE,
  getWeeklyOperatingHours,
  updateWeeklyOperatingHours,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getEffectiveDaySchedule,
  checkScheduleConflicts,
  getLoungeOperatingStatus,
};

export default scheduleService;
