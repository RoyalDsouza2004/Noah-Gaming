import React, { useState } from 'react';
import { usePushNotifications } from '../../context/PushNotificationContext.jsx';
import { usePwa } from '../../context/PwaContext.jsx';
import {
  Bell,
  BellOff,
  BellRing,
  Send,
  AlertTriangle,
  Smartphone,
  Laptop,
  CheckCircle2,
  Info,
  ExternalLink,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

export const PushNotificationSettings = ({ compact = false }) => {
  const {
    isSupported,
    permission,
    isSubscribed,
    currentDeviceSubscribed,
    activeDevicesCount,
    isLoading,
    isTesting,
    error,
    needsIosInstall,
    enablePushNotifications,
    disablePushNotifications,
    unsubscribeAllDevices,
    sendTestNotification,
  } = usePushNotifications();

  const { setShowIosModal } = usePwa();
  const [showConfirmUnsubscribeAll, setShowConfirmUnsubscribeAll] = useState(false);

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1217] via-[#140e13] to-[#0d090c] p-5 sm:p-6 shadow-xl ${
        compact ? 'text-sm' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-burgundy-600 to-crimson-600 flex items-center justify-center text-white shadow-lg shadow-crimson-900/30">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Browser Push Notifications
            </h3>
            <p className="text-xs text-gray-400">
              Receive real-time alerts on desktop & mobile even when NOAH GAMING is closed
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {!isSupported ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
              Unsupported
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
              <ShieldAlert className="w-3.5 h-3.5" /> Blocked
            </span>
          ) : currentDeviceSubscribed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* iOS Home Screen Warning */}
      {needsIosInstall && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex items-start gap-2.5">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-300 mb-1">
              iOS Home Screen App Required
            </p>
            <p className="text-amber-200/80 leading-relaxed mb-2">
              Apple requires NOAH GAMING to be added to your Home Screen before Web Push notifications can be enabled on iPhone or iPad.
            </p>
            <button
              type="button"
              onClick={() => setShowIosModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
            >
              <span>View iOS Install Guide</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Permission Blocked Instructions */}
      {permission === 'denied' && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-300 mb-1">
              Notifications Blocked in Browser
            </p>
            <p className="text-red-200/80 leading-relaxed">
              Your browser is blocking notifications for NOAH GAMING. To enable:
            </p>
            <ol className="list-decimal list-inside mt-1.5 space-y-1 text-red-200/70 text-xs">
              <li>Click the lock or site settings icon in your browser address bar.</li>
              <li>Change <strong>Notifications</strong> from <em>Block</em> to <em>Allow</em>.</li>
              <li>Reload this page and click <strong>Enable Notifications</strong> below.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Device Info & Active Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-300">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-400">This Device</div>
            <div className="text-sm font-semibold text-white">
              {currentDeviceSubscribed ? 'Subscribed & Live' : 'Not Subscribed'}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-300">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-400">All Connected Devices</div>
            <div className="text-sm font-semibold text-white">
              {activeDevicesCount} {activeDevicesCount === 1 ? 'Device' : 'Devices'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!currentDeviceSubscribed ? (
          <button
            type="button"
            disabled={isLoading || !isSupported || permission === 'denied' || needsIosInstall}
            onClick={enablePushNotifications}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-burgundy-600 to-crimson-600 hover:from-burgundy-500 hover:to-crimson-500 text-white font-semibold text-sm shadow-lg shadow-crimson-900/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span>{isLoading ? 'Enabling...' : 'Enable Push Notifications'}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={disablePushNotifications}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <BellOff className="w-4 h-4" />
            <span>{isLoading ? 'Updating...' : 'Disable on this Device'}</span>
          </button>
        )}

        {/* Send Test Push Button */}
        {currentDeviceSubscribed && (
          <button
            type="button"
            disabled={isTesting || isLoading}
            onClick={sendTestNotification}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isTesting ? 'Sending Test...' : 'Send Test Notification'}</span>
          </button>
        )}

        {/* Unsubscribe All Devices */}
        {activeDevicesCount > 1 && (
          <div className="ml-auto">
            {!showConfirmUnsubscribeAll ? (
              <button
                type="button"
                onClick={() => setShowConfirmUnsubscribeAll(true)}
                className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors py-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove all devices</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Unsubscribe all devices?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await unsubscribeAllDevices();
                    setShowConfirmUnsubscribeAll(false);
                  }}
                  className="px-2 py-1 rounded bg-red-500/20 text-red-300 font-semibold hover:bg-red-500/30 transition-colors cursor-pointer"
                >
                  Yes, Remove All
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmUnsubscribeAll(false)}
                  className="px-2 py-1 rounded bg-white/10 text-gray-300 hover:bg-white/15 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
