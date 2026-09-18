/**
 * The daily "did you log today?" notification.
 *
 * Forgetting is how expense trackers die: nobody decides to stop, they just miss
 * a day, then a week, and the numbers stop meaning anything. One quiet nudge at a
 * time the person chose is the cheapest defence there is.
 *
 * Native only. A browser can show notifications, but not on a schedule once the
 * tab is closed, and a reminder that only works while the app is open is not a
 * reminder. On the web every call here reports that plainly instead.
 */
import { isNative } from "./storage.js";

/** One fixed id, so rescheduling replaces the old reminder instead of stacking. */
export const REMINDER_ID = 4101;

export function parseTime(time) {
  const [hour, minute] = String(time).split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return { hour: 21, minute: 0 };
  return { hour: Math.min(Math.max(hour, 0), 23), minute: Math.min(Math.max(minute, 0), 59) };
}

/** "9:00 pm" — how the time reads in Settings. */
export function formatTime(time) {
  const { hour, minute } = parseTime(time);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/**
 * Makes the phone's schedule match the setting. Safe to call as often as the
 * setting changes: it always cancels first, so there is never more than one.
 *
 * Resolves to { ok: true } or { ok: false, reason } where reason is "web" or
 * "denied" — the caller turns the toggle back off and says why.
 */
export async function syncReminder(reminder) {
  if (!isNative()) return { ok: false, reason: "web" };

  const { LocalNotifications } = await import("@capacitor/local-notifications");

  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
  if (!reminder?.on) return { ok: true };

  // Android 13+ asks the person; before that this resolves as granted.
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return { ok: false, reason: "denied" };

  const { hour, minute } = parseTime(reminder.time);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: "Anything spent today?",
        body: "Log it now while you still remember — it takes ten seconds.",
        // `on` with only hour and minute repeats every day at that time.
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        smallIcon: "ic_stat_rozkharcha",
        iconColor: "#14513c",
      },
    ],
  });
  return { ok: true };
}
