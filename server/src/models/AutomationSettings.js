import mongoose from 'mongoose';

const automationSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'GLOBAL_AUTOMATION_CONFIG',
      unique: true,
      index: true,
    },
    // Minutes remaining before session end to send reminders
    sessionReminderIntervals: {
      type: [Number],
      default: [15, 5, 1], // 15m, 5m, 1m
    },
    // Minutes before booking starts to send customer arrival reminder
    bookingReminderIntervals: {
      type: [Number],
      default: [1440, 60, 15], // 24h, 1h, 15m
    },
    // Days before membership expiration to send renewal reminder
    membershipReminderIntervals: {
      type: [Number],
      default: [7, 3, 1, 0], // 7d, 3d, 1d, on expiration
    },
    // Active delivery channels
    notificationChannels: {
      type: [String],
      default: ['IN_APP', 'WHATSAPP'],
    },
    // WhatsApp Integration
    whatsappEnabled: {
      type: Boolean,
      default: false,
    },
    whatsappConfig: {
      provider: { type: String, default: 'WHATSAPP_BUSINESS_API' },
      apiUrl: { type: String, default: 'https://graph.facebook.com/v19.0' },
      phoneNumberId: { type: String, default: '' },
      apiKey: { type: String, default: '' },
      apiSecret: { type: String, default: '' },
      senderNumber: { type: String, default: '' },
      webhookVerifyToken: { type: String, default: '' },
    },
    // Master automation switch
    automationEnabled: {
      type: Boolean,
      default: true,
    },
    // Configurable notification message templates
    templates: {
      sessionWarning15: {
        type: String,
        default: 'Your gaming session on {deviceName} will end in 15 minutes. Contact front desk if you wish to extend!',
      },
      sessionWarning5: {
        type: String,
        default: 'Your gaming session on {deviceName} will end in 5 minutes.',
      },
      sessionWarning1: {
        type: String,
        default: 'Your gaming session on {deviceName} has 1 minute remaining. Please wrap up your game.',
      },
      sessionExpired: {
        type: String,
        default: 'Your gaming session on {deviceName} has reached its scheduled end. Please visit the reception desk for checkout.',
      },
      upcomingBooking24h: {
        type: String,
        default: 'Reminder: Your upcoming gaming session on {deviceName} ({gameName}) is scheduled for tomorrow at {startTime} IST.',
      },
      upcomingBooking1h: {
        type: String,
        default: 'Your gaming session on {deviceName} starts in 1 hour ({startTime} IST). Please arrive 10 minutes early.',
      },
      upcomingBooking15m: {
        type: String,
        default: 'Your gaming session on {deviceName} starts in 15 minutes! Your console is being prepped.',
      },
      membershipExpiring: {
        type: String,
        default: 'Your {planName} membership expires in {daysLeft} day(s). Renew now to maintain your benefits and priority booking.',
      },
    },
  },
  {
    timestamps: true,
  }
);

const AutomationSettings = mongoose.model(
  'AutomationSettings',
  automationSettingsSchema
);
export default AutomationSettings;
