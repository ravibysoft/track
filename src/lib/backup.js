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

export function buildJson(doc) {
  return JSON.stringify({ ...doc, exportedAt: new Date().toISOString() }, null, 2);
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(expenses) {
  const header = ["Date", "Category", "Note", "Paid by", "Amount"];
  const rows = sortExpenses(expenses).map((e) => [
    e.date,
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
