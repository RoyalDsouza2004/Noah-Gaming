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
  }).format(date);
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
 */
export async function getOperatingHours() {
  const setting = await Setting.findOne({ key: 'operating_hours' });
  if (setting && setting.value) {
    return {
      openTime: setting.value.openTime || '10:00',
      closeTime: setting.value.closeTime || '23:00',
      slotDurationMinutes: setting.value.slotDurationMinutes || 60,
    };
  }
  return {
    openTime: '10:00',
    closeTime: '23:00',
    slotDurationMinutes: 60,
  };
}

/**
 * Generates available daily slot intervals given operating hours and duration
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} [durationHours=1]
 */
export async function generateDailySlots(dateStr, durationHours = 1) {
  const { openTime, closeTime } = await getOperatingHours();

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const durationMinutes = Math.round(durationHours * 60);

  const slots = [];
  const now = new Date();

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
