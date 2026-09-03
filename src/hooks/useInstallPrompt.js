import { useCallback, useEffect, useState } from "react";

/** True once the app is running from the home screen rather than a browser tab. */
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator?.standalone === true
  );
}

/** iOS has no install prompt event — Safari needs Share → Add to Home Screen. */
function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Wraps the `beforeinstallprompt` flow. Chrome fires that event only once the PWA
 * criteria are met (manifest + service worker + https), and only if the app is not
 * already installed — so `canInstall` doubles as "is it worth showing the button".
 */
export default function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onBeforePrompt = (event) => {
      // Stop Chrome's own mini-infobar so the app can ask at a sensible moment.
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforePrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforePrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable";
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event can only be used once; Chrome re-fires it if the user declines.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return {
    canInstall: Boolean(deferred) && !installed,
    installed,
    needsManualInstall: isIos() && !installed,
    promptInstall,
  };
}
