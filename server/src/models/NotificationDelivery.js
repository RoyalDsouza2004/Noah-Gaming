import mongoose from 'mongoose';

const notificationDeliverySchema = new mongoose.Schema(
  {
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL', 'PUSH'],
      required: true,
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'],
      default: 'SENT',
      index: true,
    },
    providerReference: {
      type: String,
      default: '',
      trim: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

notificationDeliverySchema.index({ channel: 1, deliveryStatus: 1 });
notificationDeliverySchema.index({ recipient: 1, sentAt: -1 });

const NotificationDelivery = mongoose.model(
  'NotificationDelivery',
  notificationDeliverySchema
);
export default NotificationDelivery;
