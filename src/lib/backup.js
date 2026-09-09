/**
 * Backup / restore.
 *
 * On Android the files are written into the phone's public **Documents/ExpenseTracker**
 * folder, so they show up in any File Manager app and survive uninstalling the app.
 * On the web the same bytes come down as a normal browser download, which keeps the
 * feature testable before the APK exists.
 */
import { getCategory, getPaymentLabel } from "./categories.js";
import { sortExpenses } from "./db.js";
import { todayKey } from "./dates.js";
import { isNative } from "./storage.js";

export const FOLDER = "ExpenseTracker";

export function jsonFilename() {
  return `expenses-${todayKey()}.json`;
}

export function csvFilename() {
  return `expenses-${todayKey()}.csv`;
}

/* Automatic snapshots are named apart from the ones you asked for, so a manual
   export is never pruned and an automatic one is never mistaken for a keepsake. */
export const AUTO_PREFIX = "auto-";

export function autoFilename(day = todayKey()) {
  return `${AUTO_PREFIX}${day}.json`;
}

/** How many days of automatic snapshots to keep before pruning the oldest. */
export const AUTO_KEEP = 7;

export function buildJson(doc) {
  return JSON.stringify({ ...doc, exportedAt: new Date().toISOString() }, null, 2);
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(expenses) {
  const header = ["Date", "Type", "Category", "Note", "Paid by", "Amount"];
  const rows = sortExpenses(expenses).map((e) => [
    e.date,
    e.type === "income" ? "Income" : "Expense",
    getCategory(e.categoryId).label,
    e.note,
    getPaymentLabel(e.paymentMode),
    e.amount,
  ]);
  // The BOM makes Excel open the file as UTF-8 instead of mangling accents.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/* Ordered fallbacks: the public Documents folder is the goal, but a locked-down
   device can refuse it, and losing the export entirely would be worse. */
const TARGETS = ["Documents", "External", "Data"];

async function writeNative(filename, data) {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  let lastError;

  for (const key of TARGETS) {
    const directory = Directory[key];
    if (!directory) continue;
    const path = `${FOLDER}/${filename}`;
    try {
      await Filesystem.mkdir({ path: FOLDER, directory, recursive: true }).catch(() => {});
      await Filesystem.writeFile({ path, data, directory, encoding: Encoding.UTF8 });
      const { uri } = await Filesystem.getUri({ path, directory });
      return {
        uri,
        location: key === "Documents" ? `Documents/${FOLDER}` : `${key}/${FOLDER}`,
        public: key !== "Data",
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Could not write the backup file");
}

function downloadWeb(filename, data, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { uri: null, location: "your Downloads folder", public: true };
}

/** kind: "json" (full backup, re-importable) or "csv" (spreadsheet friendly). */
export async function exportBackup(doc, kind = "json") {
  const isJson = kind === "json";
  const filename = isJson ? jsonFilename() : csvFilename();
  const data = isJson ? buildJson(doc) : buildCsv(doc.expenses);
  const mime = isJson ? "application/json" : "text/csv";

  if (isNative()) return { ...(await writeNative(filename, data)), filename };
  return { ...downloadWeb(filename, data, mime), filename };
}

/** Writes the backup, then hands it to the Android share sheet. */
export async function shareBackup(doc, kind = "json") {
  const result = await exportBackup(doc, kind);

  if (isNative() && result.uri) {
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: "Expense backup",
      text: `Expense backup — ${result.filename}`,
      url: result.uri,
      dialogTitle: "Share backup",
    });
  }
  return result;
}

/* ---------- Automatic daily snapshot ---------- */

/**
 * Writes one snapshot a day into the same public folder, and prunes to the last
 * `AUTO_KEEP` days.
 *
 * Native only, and not a limitation worth apologising for: a browser cannot
 * write a file without the person choosing where it goes, and a download prompt
 * appearing by itself once a day would be worse than no automatic backup.
 *
 * `lastDay` is what the document remembers writing. It is checked against the
 * folder as well, because a restored backup can claim a snapshot that the
 * phone it is now running on never had.
 */
export async function runAutoBackup(doc, lastDay, today = todayKey()) {
  if (!isNative()) return { written: false, reason: "web" };
  if (lastDay === today) return { written: false, reason: "already today" };

  const filename = autoFilename(today);
  const result = await writeNative(filename, buildJson(doc));
  await pruneAutoBackups(today).catch(() => {});
  return { written: true, day: today, filename, location: result.location };
}

/**
 * Deletes automatic snapshots older than the newest `AUTO_KEEP`. Only files this
 * app named `auto-*.json` are ever considered — a manual export, or anything
 * else the person keeps in that folder, is never touched.
 */
async function pruneAutoBackups(today) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");

  for (const key of TARGETS) {
    const directory = Directory[key];
    if (!directory) continue;
    try {
      const { files } = await Filesystem.readdir({ path: FOLDER, directory });
      const mine = files
        .map((f) => (typeof f === "string" ? f : f.name))
        .filter((name) => name.startsWith(AUTO_PREFIX) && name.endsWith(".json"))
        .sort();

      const doomed = mine.slice(0, Math.max(mine.length - AUTO_KEEP, 0));
      for (const name of doomed) {
        if (name === autoFilename(today)) continue;
        await Filesystem.deleteFile({ path: `${FOLDER}/${name}`, directory }).catch(() => {});
      }
      return doomed.length;
    } catch {
      // That target has no folder yet — try the next.
    }
  }
  return 0;
}

/**
 * Reads a picked .json backup. Throws a readable message for anything that isn't
 * one, so the UI can show it verbatim.
 */
export async function readBackupFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a valid backup. Pick the .json file, not the .csv one.");
  }
  if (!parsed || !Array.isArray(parsed.expenses)) {
    throw new Error("That backup has no expenses in it.");
  }
  return parsed;
}
