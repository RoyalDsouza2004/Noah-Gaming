import { TIMEZONE } from '../config/constants.js';
import Setting from '../models/Setting.js';

/**
 * Converts a date string (YYYY-MM-DD) and 24-hr time string (HH:mm) in IST to a UTC Date object
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:mm'
 * @returns {Date}
 */
export function parseISTDateTime(dateStr, timeStr) {
  // Format as ISO string with +05:30 offset
  const paddedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const isoString = `${dateStr}T${paddedTime}+05:30`;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid IST date/time provided: ${dateStr} ${timeStr}`);
  }
  return date;
}

/**
 * Formats a Date object to IST 24-hr time string (HH:mm)
 * @param {Date} date
 * @returns {string}
 */
export function formatISTTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Formats a Date object to IST 12-hr display time (e.g. "02:00 PM")
 * @param {Date} date
 * @returns {string}
 */
export function formatISTDisplayTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .toUpperCase();
}

/**
 * Converts a 24-hour string ("14:00", "00:00") into 12-hour AM/PM ("2:00 PM", "12:00 AM")
 */
export function format12HourTimeStr(timeStr) {
  if (!timeStr) return '';
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return String(timeStr);
  let h = parseInt(match[1], 10);
  const m = match[2];
  if (h === 24) h = 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

/**
 * Returns consistent, user-friendly canonical equipment names for notifications:
 * - PlayStation 5 Station 1
 * - PlayStation 5 Station 2
 * - Pool Table
 */
export function getCanonicalEquipmentName(device) {
  if (!device) return 'Gaming Station';
  const code = String(device.deviceCode || '').toUpperCase();
  const name = String(device.name || '').trim();
  if (device.deviceType === 'POOL' || code.includes('POOL') || /pool/i.test(name)) {
    return 'Pool Table';
  }
  if (code === 'PS5-01' || /station\s*1/i.test(name) || /ps5\s*1/i.test(name)) {
    return 'PlayStation 5 Station 1';
  }
  if (code === 'PS5-02' || /station\s*2/i.test(name) || /ps5\s*2/i.test(name)) {
    return 'PlayStation 5 Station 2';
  }
  return name || 'Gaming Station';
}

/**
 * Formats a Date object to IST Date string (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
export function formatISTDate(date) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Retrieves configured operating hours
 * Checks weekly schedule first, then legacy operating_hours setting, then default
 */
export async function getOperatingHours(dateStr = null) {
  try {
    const weeklySetting = await Setting.findOne({ key: 'operating_hours_weekly' });
    if (weeklySetting && Array.isArray(weeklySetting.value) && weeklySetting.value.length === 7) {
      const targetDate = dateStr ? new Date(`${dateStr}T12:00:00+05:30`) : new Date();
      const dayIndex = targetDate.getDay(); // 0 is Sunday, 1 is Monday...
      const canonicalIndex = dayIndex === 0 ? 6 : dayIndex - 1; // 0=Mon, 1=Tue, ..., 6=Sun
      const dayData = weeklySetting.value[canonicalIndex];
      if (dayData) {
        return {
          openTime: dayData.openTime || '10:00',
          closeTime: dayData.closeTime || '23:00',
          slotDurationMinutes: 60,
          isOpen: dayData.isOpen !== false,
        };
      }
    }
  } catch (e) {}

  const setting = await Setting.findOne({ key: 'operating_hours' });
  if (setting && setting.value) {
    return {
      openTime: setting.value.openTime || '10:00',
      closeTime: setting.value.closeTime || '23:00',
      slotDurationMinutes: setting.value.slotDurationMinutes || 60,
      isOpen: setting.value.isOpen !== false,
    };
  }
  return {
    openTime: '10:00',
    closeTime: '23:00',
    slotDurationMinutes: 60,
    isOpen: true,
  };
}

/**
 * Generates available daily slot intervals given operating hours and duration
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} [durationHours=1]
 * @param {Object} [effectiveSchedule=null] - Optional schedule override from scheduleService
 */
export async function generateDailySlots(dateStr, durationHours = 1, effectiveSchedule = null) {
  if (effectiveSchedule && effectiveSchedule.isClosed) {
    return [];
  }

  let openTime = '10:00';
  let closeTime = '23:00';

  if (effectiveSchedule && effectiveSchedule.openTime && effectiveSchedule.closeTime) {
    openTime = effectiveSchedule.openTime;
    closeTime = effectiveSchedule.closeTime;
  } else {
    const hours = await getOperatingHours(dateStr);
    if (hours.isOpen === false) {
      return [];
    }
    openTime = hours.openTime;
    closeTime = hours.closeTime;
  }

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const durationMinutes = Math.round(durationHours * 60);

  const slots = [];
  const now = new Date();

  // Closed intervals parsed for this date if present
  const intervals = (effectiveSchedule?.closedIntervals || []).map((ci) => ({
    startAt: parseISTDateTime(dateStr, ci.from),
    endAt: parseISTDateTime(dateStr, ci.to),
    reason: ci.reason || 'Closed interval',
  }));

  // Iterate in 1-hour increments
  for (let startM = openMinutes; startM + durationMinutes <= closeMinutes; startM += 60) {
    const endM = startM + durationMinutes;

    const startHStr = String(Math.floor(startM / 60)).padStart(2, '0');
    const startMStr = String(startM % 60).padStart(2, '0');
    const startTimeStr = `${startHStr}:${startMStr}`;

    const endHStr = String(Math.floor(endM / 60)).padStart(2, '0');
    const endMStr = String(endM % 60).padStart(2, '0');
    const endTimeStr = `${endHStr}:${endMStr}`;

    const startAt = parseISTDateTime(dateStr, startTimeStr);
    const endAt = parseISTDateTime(dateStr, endTimeStr);

    // If slot overlaps with any scheduled closed interval, skip it
    const overlapsClosedInterval = intervals.some(
      (ci) => startAt.getTime() < ci.endAt.getTime() && endAt.getTime() > ci.startAt.getTime()
    );
    if (overlapsClosedInterval) {
      continue;
    }

    const isPast = startAt.getTime() <= now.getTime();

    slots.push({
      startTime: startTimeStr,
      endTime: endTimeStr,
      displayStartTime: formatISTDisplayTime(startAt),
      displayEndTime: formatISTDisplayTime(endAt),
      startAt,
      endAt,
      durationHours,
      isPast,
    });
  }

  return slots;
}

/**
 * Generates unique booking reference ID
 * Example: BK-20261114-87432
 */
export function generateBookingId(dateStr) {
  const cleanDate = (dateStr || formatISTDate(new Date())).replace(/-/g, '');
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `BK-${cleanDate}-${randomSuffix}`;
}
