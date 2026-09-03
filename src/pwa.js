import { Capacitor } from "@capacitor/core";

/**
 * Registers the Workbox service worker that makes the hosted version installable
 * and fully offline.
 *
 * Skipped inside the Android APK: Capacitor already serves every asset from the
 * device, so a second cache layer would only add a way for the app to get stuck
 * on a stale build.
 */
export function setupServiceWorker() {
  if (Capacitor.isNativePlatform()) return;
  if (!("serviceWorker" in navigator)) return;

  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch((err) => console.warn("[rozkharcha] service worker not registered", err));
}
