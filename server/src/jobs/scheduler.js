import { executeMasterAutomationCycle } from '../services/automation.service.js';

let intervalTimer = null;
let isRunning = false;

/**
 * Initializes and starts the background automation scheduler
 * Executes every 10 seconds to ensure prompt session countdown reminders and expirations.
 */
export function startScheduler(intervalMs = 10000) {
  if (intervalTimer) {
    console.log('[Scheduler] Background automation scheduler is already running.');
    return;
  }

  console.log(`[Scheduler] Initializing automation engine (interval: ${intervalMs / 1000}s, timezone: Asia/Kolkata)...`);

  const runCycle = async () => {
    if (isRunning) return; // Prevent overlapping runs
    isRunning = true;
    try {
      await executeMasterAutomationCycle();
    } catch (err) {
      console.error('[Scheduler] Unexpected error during automation cycle:', err.message);
    } finally {
      isRunning = false;
    }
  };

  // Immediate initial run
  setTimeout(runCycle, 2000);

  // Standing interval
  intervalTimer = setInterval(runCycle, intervalMs);
}

/**
 * Halts the background scheduler
 */
export function stopScheduler() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    console.log('[Scheduler] Background automation scheduler halted.');
  }
}

/**
 * Forces an immediate automation cycle execution (used for tests and manual sync)
 */
export async function triggerAutomationNow() {
  return await executeMasterAutomationCycle();
}
