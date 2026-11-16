import NotificationDelivery from '../models/NotificationDelivery.js';
import AutomationSettings from '../models/AutomationSettings.js';

/**
 * Dispatch a message via WhatsApp Business API / Provider
 * Handles sandbox simulation when external API credentials are not set.
 */
export async function sendWhatsAppMessage({
  recipientUser,
  notificationId,
  templateKey = 'CUSTOM',
  bodyText,
  parameters = [],
}) {
  const settings = await AutomationSettings.findOne({ key: 'GLOBAL_AUTOMATION_CONFIG' });
  const isEnabled = settings?.whatsappEnabled || false;
  const config = settings?.whatsappConfig || {};

  // If WhatsApp channel is disabled by admin, return early
  if (!isEnabled) {
    return {
      success: false,
      skipped: true,
      reason: 'WhatsApp notifications are currently disabled in Automation Settings.',
    };
  }

  const phone = recipientUser?.phone;
  if (!phone) {
    return {
      success: false,
      skipped: true,
      reason: 'Recipient does not have a registered mobile phone number.',
    };
  }

  try {
    let providerRef = `WA-MOCK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let deliveryStatus = 'SENT';
    let errorMessage = null;

    // Check if live credentials exist
    if (config.apiKey && config.phoneNumberId) {
      try {
        const payload = {
          messaging_product: 'whatsapp',
          to: phone.startsWith('+') ? phone : `+91${phone.replace(/^0+/, '')}`,
          type: 'text',
          text: { preview_url: false, body: bodyText },
        };

        const res = await fetch(`${config.apiUrl}/${config.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.messages?.[0]?.id) {
          providerRef = data.messages[0].id;
          deliveryStatus = 'DELIVERED';
        } else {
          deliveryStatus = 'FAILED';
          errorMessage = data.error?.message || 'WhatsApp Provider rejected payload';
        }
      } catch (networkErr) {
        deliveryStatus = 'FAILED';
        errorMessage = networkErr.message || 'WhatsApp Gateway Connection Error';
      }
    } else {
      // Sandbox Simulation mode: Logged as simulated sent
      providerRef = `WA-SANDBOX-${Date.now()}`;
      deliveryStatus = 'DELIVERED';
    }

    // Persist delivery record
    await NotificationDelivery.create({
      notification: notificationId,
      recipient: recipientUser._id,
      channel: 'WHATSAPP',
      deliveryStatus,
      providerReference: providerRef,
      errorMessage,
      metadata: {
        templateKey,
        phone,
        bodyText,
        simulation: !config.apiKey,
      },
    });

    return {
      success: deliveryStatus !== 'FAILED',
      providerReference: providerRef,
      status: deliveryStatus,
    };
  } catch (err) {
    console.warn('[WhatsApp Service Error]', err.message);
    // Never fail parent notification flow
    return {
      success: false,
      error: err.message,
    };
  }
}
