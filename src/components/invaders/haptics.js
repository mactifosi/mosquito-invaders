/**
 * Haptic feedback, loaded lazily.
 *
 * The Capacitor plugin is pulled in with a dynamic import for two reasons: the
 * web build shouldn't carry native plugin code it can't use, and the headless
 * test harness (which drives update() in Node) shouldn't have to stub it.
 *
 * Everything here fails soft. A browser with no vibration support, a device
 * with haptics switched off, a rejected promise mid-frame — none of it should
 * ever interrupt the game loop.
 */

// Rapid fire can land several kills a second; below this gap the taps blur into
// one long buzz that reads as a malfunction rather than feedback.
const MIN_GAP_MS = 70;

let plugin = null;
let unavailable = false;
let lastFired = 0;

/** Call from a user gesture, alongside sfx.unlock(). */
export async function initHaptics() {
  if (plugin || unavailable) return;
  try {
    plugin = await import("@capacitor/haptics");
  } catch {
    unavailable = true;
  }
}

function throttled() {
  const now = performance.now();
  if (now - lastFired < MIN_GAP_MS) return false;
  lastFired = now;
  return true;
}

export const haptics = {
  /** A mosquito goes down: the lightest tap the device can make. */
  hit() {
    if (!plugin || unavailable || !throttled()) return;
    try {
      plugin.Haptics.impact({ style: plugin.ImpactStyle.Light }).catch(() => {});
    } catch {
      unavailable = true;
    }
  },

  /** A craft is lost: heavier, and never throttled away — this one matters. */
  loseCraft() {
    if (!plugin || unavailable) return;
    lastFired = performance.now();
    try {
      plugin.Haptics.notification({ type: plugin.NotificationType.Error }).catch(() => {});
    } catch {
      unavailable = true;
    }
  },
};
