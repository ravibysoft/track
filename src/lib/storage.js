/**
 * Persistence adapter. The app never talks to a platform API directly — it calls
 * readDoc / scheduleSave / flushSave, and this module decides where the bytes go.
 *
 * IndexedDB is the store, in the browser and inside the APK alike. It replaced
 * localStorage, which is synchronous (every save blocked the main thread, which
 * is felt on a phone), capped at around 5 MB, and stores only strings — so every
 * read and write paid for a full JSON parse or stringify of the whole document.
 * IndexedDB is asynchronous, has no practical cap here, and stores the object
 * itself through structured cloning.
 *
 * Nothing is thrown away. Two older stores still exist in the wild — a
 * localStorage key on the web, and expenses.json inside the APK — and both are
 * read once on first launch and carried into IndexedDB. Neither is deleted: if
 * IndexedDB is ever cleared, the old copy is still there to be found. On Android
 * the JSON file also keeps being written as a mirror, because a file in the app's
 * own directory survives things that evict web storage.
 */
import { Capacitor } from "@capacitor/core";
import { openDB } from "idb";

const DB_NAME = "rozkharcha";
const DB_VERSION = 1;
const STORE = "doc";
const DOC_KEY = "main";

const WEB_KEY = "rozkharcha.v1";
/* The app shipped as "Track" first; anything saved under the old key is moved over
   on first read so a rename never costs someone their expenses. */
const LEGACY_WEB_KEY = "track.v1";
const FILE = "expenses.json";
const SAVE_DELAY = 200;

export const isNative = () => Capacitor.isNativePlatform();

let dbPromise = null;

function db() {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    },
    blocking() {
      /* Another tab is upgrading or deleting the database: let go of the handle
         so it is not blocked waiting on this one. */
      dbPromise?.then((d) => d.close()).catch(() => {});
      dbPromise = null;
    },
  });
  return dbPromise;
}

async function nativeFs() {
  const mod = await import("@capacitor/filesystem");
  return { Filesystem: mod.Filesystem, Directory: mod.Directory, Encoding: mod.Encoding };
}

/** The stores that predate IndexedDB, newest first. Read-only after migration. */
async function readLegacy() {
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await nativeFs();
      const res = await Filesystem.readFile({
        path: FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(res.data);
    } catch {
      return null; // No file: a first launch, or a build that never wrote one.
    }
  }

  try {
    let raw = localStorage.getItem(WEB_KEY);
    if (raw === null) {
      const older = localStorage.getItem(LEGACY_WEB_KEY);
      if (older !== null) {
        localStorage.setItem(WEB_KEY, older);
        localStorage.removeItem(LEGACY_WEB_KEY);
        raw = older;
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns the stored document, or null on a first run / unreadable store. */
export async function readDoc() {
  try {
    const stored = await (await db()).get(STORE, DOC_KEY);
    if (stored) return stored;
  } catch (err) {
    /* Private-mode browsers and locked-down WebViews can refuse IndexedDB
       outright. That is survivable — the old store still answers. */
    console.warn("[rozkharcha] IndexedDB unavailable, falling back", err);
  }

  const legacy = await readLegacy();
  // Adopt it, so the next launch reads from IndexedDB like everyone else.
  if (legacy) await writeDoc(legacy);
  return legacy;
}

export async function writeDoc(doc) {
  let saved = false;
  try {
    await (await db()).put(STORE, doc, DOC_KEY);
    saved = true;
  } catch (err) {
    console.warn("[rozkharcha] IndexedDB write failed", err);
  }

  /* On Android the file is a second copy, written whether or not IndexedDB
     worked. On the web it is the fallback, written only if IndexedDB did not. */
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await nativeFs();
      await Filesystem.writeFile({
        path: FILE,
        data: JSON.stringify(doc),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      saved = true;
    } catch (err) {
      console.warn("[rozkharcha] file mirror failed", err);
    }
  } else if (!saved) {
    localStorage.setItem(WEB_KEY, JSON.stringify(doc));
    saved = true;
  }

  if (!saved) throw new Error("Could not save — no storage is available.");
}

/**
 * Asks the browser not to evict this origin's storage when space runs short.
 * Best effort and silent: it is a request, and a declined one changes nothing.
 */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Not supported here; the data is no less safe than it was before.
  }
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
    console.error("[rozkharcha] save failed", err);
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
