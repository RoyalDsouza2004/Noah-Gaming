import AutomationSettings from '../models/AutomationSettings.js';
import AutomationLog from '../models/AutomationLog.js';
import GamingSession from '../models/GamingSession.js';
import Booking from '../models/Booking.js';
import MembershipSubscription from '../models/MembershipSubscription.js';
import User from '../models/User.js';
import { createNotification } from './notification.service.js';

/**
 * Retrieves the global singleton automation configuration from MongoDB
 */
export async function getAutomationSettings() {
  let settings = await AutomationSettings.findOne({ key: 'GLOBAL_AUTOMATION_CONFIG' });
  if (!settings) {
    settings = await AutomationSettings.create({
      key: 'GLOBAL_AUTOMATION_CONFIG',
      sessionReminderIntervals: [15, 5, 1],
      bookingReminderIntervals: [1440, 60, 15],
      membershipReminderIntervals: [7, 3, 1, 0],
      notificationChannels: ['IN_APP', 'WHATSAPP'],
      whatsappEnabled: false,
      automationEnabled: true,
    });
  }
  return settings;
}

/**
 * Updates automation settings in MongoDB
 */
export async function updateAutomationSettings(updates) {
  let settings = await AutomationSettings.findOne({ key: 'GLOBAL_AUTOMATION_CONFIG' });
  if (!settings) {
    settings = new AutomationSettings({ key: 'GLOBAL_AUTOMATION_CONFIG' });
  }

  if (updates.sessionReminderIntervals) {
    settings.sessionReminderIntervals = updates.sessionReminderIntervals.map(Number).sort((a, b) => b - a);
  }
  if (updates.bookingReminderIntervals) {
    settings.bookingReminderIntervals = updates.bookingReminderIntervals.map(Number).sort((a, b) => b - a);
  }
  if (updates.membershipReminderIntervals) {
    settings.membershipReminderIntervals = updates.membershipReminderIntervals.map(Number).sort((a, b) => b - a);
  }
  if (updates.notificationChannels) {
    settings.notificationChannels = updates.notificationChannels;
  }
  if (updates.whatsappEnabled !== undefined) {
    settings.whatsappEnabled = Boolean(updates.whatsappEnabled);
  }
  if (updates.whatsappConfig) {
    settings.whatsappConfig = { ...settings.whatsappConfig, ...updates.whatsappConfig };
  }
  if (updates.automationEnabled !== undefined) {
    settings.automationEnabled = Boolean(updates.automationEnabled);
  }
  if (updates.templates) {
    settings.templates = { ...settings.templates, ...updates.templates };
  }

  await settings.save();
  return settings;
}

/**
 * 1. Checks active gaming sessions for 15m, 5m, 1m countdown reminders and scheduled end expiration
 */
export async function runSessionTimerChecks(settings) {
  const now = new Date();
  const intervals = settings?.sessionReminderIntervals || [15, 5, 1];
  const channels = settings?.notificationChannels || ['IN_APP'];

  const activeSessions = await GamingSession.find({
    status: { $in: ['ACTIVE', 'EXTENDED'] },
  }).populate('customer device game booking');

  let remindersSent = 0;
  let expiredSessionsCount = 0;

  for (const session of activeSessions) {
    const endMs = new Date(session.scheduledEndAt).getTime();
    const remainingMs = endMs - now.getTime();
    const remainingMinutes = Math.floor(remainingMs / 60000);
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    // A. Check countdown threshold reminders (e.g. 15m, 5m, 1m)
    for (const threshold of intervals) {
      if (remainingMinutes <= threshold && remainingSeconds > 0) {
        const thresholdLabel = `${threshold}_MIN`;
        const alreadySent = session.reminderHistory?.some(
          (r) => r.thresholdMinutes === threshold
        );

        if (!alreadySent) {
          // Send notification to customer
          const customerMsg =
            threshold === 1
              ? `Your gaming session on ${session.device?.name || 'Console'} has 1 minute remaining. Please wrap up your game.`
              : `Your gaming session on ${session.device?.name || 'Console'} will end in ${threshold} minutes. Contact front desk if you wish to extend!`;

          await createNotification({
            recipient: session.customer._id,
            recipientRole: 'customer',
            title: `Session Ending Soon (${threshold} min remaining) ⏱️`,
            message: customerMsg,
            category: 'SESSION_WARNING',
            relatedBooking: session.booking?._id,
            relatedSession: session._id,
            deliveryChannels: channels,
            idempotencyKey: `SESSION_REMIND_${session._id}_${threshold}`,
          });

          // Send warning notification to receptionist staff
          await createNotification({
            recipientRole: 'receptionist',
            recipient: session.customer._id, // placeholder recipient for role-wide broadcast
            title: `Station Ending Soon: ${session.device?.name}`,
            message: `Booking ${session.booking?.bookingId} on ${session.device?.name} has ${threshold} min remaining.`,
            category: 'SESSION_WARNING',
            relatedBooking: session.booking?._id,
            relatedSession: session._id,
            deliveryChannels: ['IN_APP'],
            idempotencyKey: `STAFF_SESSION_REMIND_${session._id}_${threshold}`,
          });

          session.reminderHistory.push({
            thresholdMinutes: threshold,
            label: thresholdLabel,
            sentAt: now,
            channels,
          });
          session.lastReminderSent = thresholdLabel;
          await session.save();
          remindersSent++;
          break; // Trigger closest threshold first
        }
      }
    }

    // B. Check Session Expiration (scheduledEndAt <= now)
    // IMPORTANT: Do NOT automatically terminate physical session. Transition to AWAITING_RECEPTIONIST.
    if (remainingSeconds <= 0 && session.status !== 'AWAITING_RECEPTIONIST') {
      session.status = 'AWAITING_RECEPTIONIST';
      session.lastReminderSent = 'EXPIRED';
      await session.save();

      // Update Booking sessionStatus to AWAITING_RECEPTIONIST
      if (session.booking) {
        await Booking.findByIdAndUpdate(session.booking._id, {
          sessionStatus: 'AWAITING_RECEPTIONIST',
        });
      }

      // Notify customer
      await createNotification({
        recipient: session.customer._id,
        recipientRole: 'customer',
        title: 'Gaming Session Ended 🛑',
        message: `Your scheduled gaming time on ${session.device?.name || 'Console'} has expired. Please visit the reception desk for checkout.`,
        category: 'SESSION_EXPIRED',
        relatedBooking: session.booking?._id,
        relatedSession: session._id,
        deliveryChannels: channels,
        idempotencyKey: `SESSION_EXPIRED_${session._id}`,
      });

      // Notify receptionist that session is overdue and awaiting checkout
      await createNotification({
        recipientRole: 'receptionist',
        recipient: session.customer._id,
        title: `Session Overdue: ${session.device?.name}`,
        message: `Booking ${session.booking?.bookingId} on ${session.device?.name} has reached scheduled end and is AWAITING RECEPTIONIST confirmation.`,
        category: 'SESSION_EXPIRED',
        relatedBooking: session.booking?._id,
        relatedSession: session._id,
        deliveryChannels: ['IN_APP'],
        idempotencyKey: `STAFF_SESSION_EXPIRED_${session._id}`,
      });

      expiredSessionsCount++;
    }
  }

  return { remindersSent, expiredSessionsCount };
}

/**
 * 2. Checks confirmed upcoming bookings for 24h, 1h, 15m arrival reminders
 */
export async function runBookingReminderChecks(settings) {
  const now = new Date();
  const intervals = settings?.bookingReminderIntervals || [1440, 60, 15]; // 24h, 1h, 15m
  const channels = settings?.notificationChannels || ['IN_APP'];

  // Query confirmed, not yet checked-in bookings starting in the next 25 hours
  const upcomingBookings = await Booking.find({
    bookingStatus: 'CONFIRMED',
    checkInStatus: 'NOT_CHECKED_IN',
    startAt: {
      $gte: now,
      $lte: new Date(now.getTime() + 25 * 3600 * 1000),
    },
  }).populate('customer device game');

  let remindersSent = 0;

  for (const booking of upcomingBookings) {
    const startMs = new Date(booking.startAt).getTime();
    const diffMinutes = Math.floor((startMs - now.getTime()) / 60000);

    for (const threshold of intervals) {
      if (diffMinutes <= threshold && diffMinutes > threshold - 15) {
        const idempotencyKey = `BOOKING_REMIND_${booking._id}_${threshold}`;

        let reminderText = '';
        if (threshold >= 1440) {
          reminderText = `Reminder: Your upcoming gaming session on ${booking.device?.name} is scheduled for tomorrow at ${booking.startTime} IST.`;
        } else if (threshold >= 60) {
          reminderText = `Your gaming session on ${booking.device?.name} starts in 1 hour (${booking.startTime} IST). Please arrive on time!`;
        } else {
          reminderText = `Your gaming session on ${booking.device?.name} starts in 15 minutes! Your console is being readied.`;
        }

        const result = await createNotification({
          recipient: booking.customer._id,
          recipientRole: 'customer',
          title: `Upcoming Booking Reminder (${threshold >= 60 ? threshold / 60 + 'h' : threshold + 'm'}) 📅`,
          message: reminderText,
          category: 'UPCOMING_BOOKING',
          relatedBooking: booking._id,
          deliveryChannels: channels,
          idempotencyKey,
        });

        if (!result.duplicate) {
          remindersSent++;
        }
      }
    }
  }

  return { remindersSent };
}

/**
 * 3. Checks active memberships expiring in 7d, 3d, 1d, 0d
 */
export async function runMembershipAlertChecks(settings) {
  const now = new Date();
  const intervals = settings?.membershipReminderIntervals || [7, 3, 1, 0];
  const channels = settings?.notificationChannels || ['IN_APP'];

  const activeMemberships = await MembershipSubscription.find({
    status: 'ACTIVE',
    expirationDate: {
      $gte: now,
      $lte: new Date(now.getTime() + 8 * 24 * 3600 * 1000),
    },
  }).populate('customer membershipPlan');

  let remindersSent = 0;

  for (const sub of activeMemberships) {
    if (!sub.customer) continue;
    const endMs = new Date(sub.expirationDate).getTime();
    const daysLeft = Math.ceil((endMs - now.getTime()) / (24 * 3600 * 1000));

    for (const threshold of intervals) {
      if (daysLeft === threshold) {
        const idempotencyKey = `MEMBERSHIP_EXPIRY_${sub._id}_${threshold}D`;

        const msg =
          threshold === 0
            ? `Your ${sub.membershipPlan?.name || 'Gaming Pass'} expires today! Renew now to retain unlimited gaming privileges.`
            : `Your ${sub.membershipPlan?.name || 'Gaming Pass'} expires in ${threshold} day(s). Renew today to avoid interruption!`;

        const result = await createNotification({
          recipient: sub.customer._id || sub.customer,
          recipientRole: 'customer',
          title: `Membership Expiring ${threshold === 0 ? 'Today' : `in ${threshold} Days`} 👑`,
          message: msg,
          category: threshold === 0 ? 'MEMBERSHIP_EXPIRED' : 'MEMBERSHIP_EXPIRING',
          deliveryChannels: channels,
          idempotencyKey,
          metadata: { planId: sub.membershipPlan?._id, daysLeft },
        });

        if (!result.duplicate) {
          remindersSent++;
        }
      }
    }
  }

  return { remindersSent };
}

/**
 * Master automation tick function called on schedule
 */
export async function executeMasterAutomationCycle() {
  const startTime = Date.now();
  const settings = await getAutomationSettings();

  if (!settings.automationEnabled) {
    return { skipped: true, reason: 'Automation is disabled in settings.' };
  }

  try {
    const [timerResults, bookingResults, membershipResults] = await Promise.all([
      runSessionTimerChecks(settings),
      runBookingReminderChecks(settings),
      runMembershipAlertChecks(settings),
    ]);

    const durationMs = Date.now() - startTime;
    const summary = `Timers: ${timerResults.remindersSent} reminders, ${timerResults.expiredSessionsCount} expired; Bookings: ${bookingResults.remindersSent} reminders; Memberships: ${membershipResults.remindersSent} alerts (${durationMs}ms)`;

    // Log automation execution
    await AutomationLog.create({
      jobType: 'MASTER_AUTOMATION_CYCLE',
      status: 'SUCCESS',
      summary,
      details: {
        timerResults,
        bookingResults,
        membershipResults,
      },
      durationMs,
    });

    return {
      success: true,
      durationMs,
      timerResults,
      bookingResults,
      membershipResults,
    };
  } catch (err) {
    console.error('[Automation Scheduler Error]', err);
    await AutomationLog.create({
      jobType: 'MASTER_AUTOMATION_CYCLE',
      status: 'FAILED',
      summary: `Automation failure: ${err.message}`,
      durationMs: Date.now() - startTime,
    });
    return { success: false, error: err.message };
  }
}
