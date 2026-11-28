/**
 * Formats a 24-hour time string ("HH:mm" or "HH:mm:ss") or Date/ISO timestamp
 * into an unambiguous 12-hour AM/PM format (e.g. "11:00 AM", "2:00 PM", "12:00 AM", "12:00 PM").
 *
 * Does NOT alter underlying machine-readable timestamps; strictly for UI display.
 */
export function format12HourTime(timeInput) {
  if (!timeInput) return '';

  // Handle Date objects or ISO date-time strings
  if (timeInput instanceof Date || (typeof timeInput === 'string' && (timeInput.includes('T') || timeInput.includes('Z')))) {
    const d = timeInput instanceof Date ? timeInput : new Date(timeInput);
    if (!isNaN(d.getTime())) {
      return d
        .toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        .toUpperCase();
    }
  }

  // Handle "HH:mm" or "HH:mm:ss" 24-hr strings
  if (typeof timeInput === 'string') {
    const match = timeInput.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = match[2];
      // Normalize 24:00 to 00:00
      if (hours === 24) hours = 0;
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 === 0 ? 12 : hours % 12;
      return `${hour12}:${mins} ${period}`;
    }
  }

  return String(timeInput);
}

/**
 * Formats a start and end time into a 12-hour AM/PM range string.
 * e.g. ("11:00", "14:00") -> "11:00 AM - 2:00 PM"
 */
export function format12HourRange(startTime, endTime) {
  const start = format12HourTime(startTime);
  const end = format12HourTime(endTime);
  if (start && end) return `${start} - ${end}`;
  return start || end || '';
}

/**
 * Formats a booking object's time range into 12-hour AM/PM in IST.
 * Handles bookings with Date timestamps (startAt/endAt) or string times (startTime/endTime).
 */
export function formatBookingTimeRange12h(booking) {
  if (!booking) return '';

  if (booking.startAt && booking.endAt) {
    return `${format12HourTime(booking.startAt)} - ${format12HourTime(booking.endAt)}`;
  }

  const startStr = booking.startAt ? format12HourTime(booking.startAt) : format12HourTime(booking.startTime || '');
  let endStr = '';

  if (booking.endAt) {
    endStr = format12HourTime(booking.endAt);
  } else if (booking.endTime) {
    endStr = format12HourTime(booking.endTime);
  } else if (booking.startTime && booking.duration) {
    const [h, m] = booking.startTime.split(':').map(Number);
    const totalMins = h * 60 + m + Math.round(Number(booking.duration) * 60);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    endStr = format12HourTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  }

  if (startStr && endStr) return `${startStr} - ${endStr}`;
  return startStr || endStr || '';
}
