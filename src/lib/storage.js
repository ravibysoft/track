/**
 * Persistence adapter. The app never talks to a platform API directly — it calls
 * readDoc / scheduleSave / flushSave, and this module picks the backing store:
 *
 *   browser (dev + phone-over-WiFi testing) -> localStorage
 *   Android APK                             -> app-private expenses.json
 *
 * The Capacitor plugin is imported lazily so the web bundle never pulls it in.
 */
import { Capacitor } from "@capacitor/core";

const WEB_KEY = "track.v1";
const FILE = "expenses.json";
const SAVE_DELAY = 200;

export const isNative = () => Capacitor.isNativePlatform();

async function nativeFs() {
  const mod = await import("@capacitor/filesystem");
  return { Filesystem: mod.Filesystem, Directory: mod.Directory, Encoding: mod.Encoding };
}

/** Returns the stored document, or null on a first run / unreadable file. */
export async function readDoc() {
  try {
    if (isNative()) {
      const { Filesystem, Directory, Encoding } = await nativeFs();
      const res = await Filesystem.readFile({
        path: FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(res.data);
    }
    const raw = localStorage.getItem(WEB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Missing file on first launch, or corrupt JSON — the caller seeds a fresh doc.
    return null;
  }
}

export async function writeDoc(doc) {
  const json = JSON.stringify(doc);
  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await nativeFs();
    await Filesystem.writeFile({
      path: FILE,
      data: json,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return;
  }
  localStorage.setItem(WEB_KEY, json);
}

/* ---------- Debounced writer ---------- */

let timer = null;
let pending = null;
let inFlight = Promise.resolve();

/** Coalesces rapid edits into one write; the newest document always wins. */
export function scheduleSave(doc) {
  pending = doc;
  clearTimeout(timer);
  timer = setTimeout(() => {
    void flushSave();
  }, SAVE_DELAY);
}

/** Writes any pending document immediately. Safe to call when nothing is queued. */
export function flushSave() {
  clearTimeout(timer);
  timer = null;
  if (!pending) return inFlight;
  const doc = pending;
  pending = null;
  inFlight = inFlight.then(() => writeDoc(doc)).catch((err) => {
    console.error("[track] save failed", err);
  });
  return inFlight;
}

/**
 * Android kills backgrounded WebViews without warning, so commit the pending
 * write the moment the app is hidden rather than waiting out the debounce.
 */
export function installFlushHooks() {
  const flush = () => {
    if (document.visibilityState === "hidden") void flushSave();
  };
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", () => void flushSave());
  return () => {
    document.removeEventListener("visibilitychange", flush);
  };
}
