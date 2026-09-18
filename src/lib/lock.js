/**
 * App lock: a 4-digit PIN, optionally unlocked by fingerprint or face instead.
 *
 * What this is for is honest privacy, not security against a determined attacker:
 * a phone gets handed to a child, left on a table, passed round to show a photo,
 * and spending is personal. A PIN keeps casual eyes out.
 *
 * Where it lives matters. The PIN is kept in the WebView's own storage, NOT in
 * the document — the document is what gets exported, shared on WhatsApp and
 * restored onto other phones, and a lock that travelled inside the backup would
 * either leak or lock someone out of their own restore. Only a salted SHA-256
 * hash is stored, never the digits.
 */
import { isNative } from "./storage.js";

const KEY = "rozkharcha.lock";

export const PIN_LENGTH = 4;
/** Wrong guesses allowed before a cool-down. */
export const MAX_ATTEMPTS = 5;
export const COOLDOWN_MS = 30_000;
/** How long the app can sit in the background before it asks again. */
export const RELOCK_AFTER_MS = 60_000;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    return raw && typeof raw.pinHash === "string" && typeof raw.salt === "string" ? raw : null;
  } catch {
    return null;
  }
}

function write(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the lock simply stays off rather than half-applied.
  }
}

async function hash(pin, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidPin(pin) {
  return typeof pin === "string" && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** { on, biometric } — never the hash. */
export function lockStatus() {
  const lock = read();
  return { on: !!lock, biometric: !!lock?.biometric };
}

export async function setPin(pin, { biometric = false } = {}) {
  if (!isValidPin(pin)) throw new Error(`The PIN must be ${PIN_LENGTH} digits.`);
  const salt = newSalt();
  write({ pinHash: await hash(pin, salt), salt, biometric, failures: 0, lockedUntil: 0 });
}

export function setBiometric(on) {
  const lock = read();
  if (lock) write({ ...lock, biometric: !!on });
}

export function clearLock() {
  write(null);
}

/** Milliseconds left in a cool-down, or 0. Survives a reload, so reopening the
    app is not a way round the limit. */
export function cooldownLeft(now = Date.now()) {
  const lock = read();
  return lock?.lockedUntil > now ? lock.lockedUntil - now : 0;
}

/**
 * Checks a PIN. Resolves to { ok } on success, or { ok: false, left, cooldown }
 * where `left` is the guesses remaining and `cooldown` the wait in ms.
 */
export async function verifyPin(pin, now = Date.now()) {
  const lock = read();
  if (!lock) return { ok: true };

  const wait = cooldownLeft(now);
  if (wait) return { ok: false, left: 0, cooldown: wait };

  if (isValidPin(pin) && (await hash(pin, lock.salt)) === lock.pinHash) {
    write({ ...lock, failures: 0, lockedUntil: 0 });
    return { ok: true };
  }

  const failures = (lock.failures ?? 0) + 1;
  if (failures >= MAX_ATTEMPTS) {
    write({ ...lock, failures: 0, lockedUntil: now + COOLDOWN_MS });
    return { ok: false, left: 0, cooldown: COOLDOWN_MS };
  }
  write({ ...lock, failures });
  return { ok: false, left: MAX_ATTEMPTS - failures, cooldown: 0 };
}

/* ---------- Fingerprint / face (installed app only) ---------- */

export async function biometricAvailable() {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const { isAvailable } = await NativeBiometric.isAvailable();
    return isAvailable;
  } catch {
    return false;
  }
}

/** Resolves true when the person proved it was them, false for any refusal. */
export async function verifyBiometric() {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      title: "Unlock Roz Kharcha",
      subtitle: "Your spending stays private",
      negativeButtonText: "Use PIN",
    });
    return true;
  } catch {
    return false;
  }
}
