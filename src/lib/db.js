/**
 * Pure document helpers — every function takes state and returns new state or a
 * derived value. No React, no I/O, so the rules stay easy to reason about and test.
 *
 * An entry is an expense or an income. Anything saved before income existed has no
 * `type`, so it is read as an expense — that keeps old backups and old installs
 * working untouched.
 */
import {
  defaultCategories,
  defaultCategoryFor,
  normalizeCategories,
} from "./categories.js";
import { isValidKey, monthKeyOf, todayKey } from "./dates.js";
import { collectDue, normalizeRules } from "./recurring.js";
import { DEFAULT_CURRENCY, round2, sum } from "./money.js";

export const DOC_VERSION = 1;

export const APP_NAME = "Roz Kharcha";

const VALID_MODE = new Set(["cash", "upi", "card"]);

export function emptyDoc() {
  return {
    version: DOC_VERSION,
    expenses: [],
    recurring: [],
    settings: {
      // Greets you by this on Home. Defaults to the app's own name, so it reads
      // as intended until someone puts their own there.
      name: APP_NAME,
      currency: DEFAULT_CURRENCY,
      monthlyBudget: 0,
      // Defaults to the white theme; System and Dark stay available in Settings.
      theme: "light",
      categories: defaultCategories(),
      autoBackup: true,
      // The day the last automatic snapshot was written, or "" for never.
      lastAutoBackup: "",
      // A nudge at the end of the day to log what was spent. Off until asked for.
      reminder: { ...DEFAULT_REMINDER },
      // Set once the first-launch setup has been finished or skipped.
      onboarded: false,
    },
  };
}

export const DEFAULT_REMINDER = { on: false, time: "21:00" };

/** "HH:MM", 24-hour. Anything else falls back to the default evening time. */
function cleanReminder(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const time =
    typeof r.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)
      ? r.time
      : DEFAULT_REMINDER.time;
  return { on: r.on === true, time };
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Accepts anything (old file, hand-edited backup, corrupt read) and returns a
 * document this app can safely render. Unusable rows are dropped, not guessed at.
 */
export function migrate(raw) {
  const base = emptyDoc();
  if (!raw || typeof raw !== "object") return base;

  const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const budget = Number(s.monthlyBudget);

  /* Categories are resolved first and handed to the sanitiser, rather than read
     from the live registry: an imported backup brings its own list, and its
     entries have to be checked against that list, not against whatever the app
     happened to be showing a moment earlier. */
  const categories = normalizeCategories(s.categories);

  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.map((e) => sanitizeEntry(e, categories)).filter(Boolean)
    : [];

  return {
    version: DOC_VERSION,
    expenses,
    recurring: normalizeRules(raw.recurring),
    settings: {
      name: cleanName(s.name) ?? base.settings.name,
      currency: typeof s.currency === "string" && s.currency ? s.currency : base.settings.currency,
      monthlyBudget: Number.isFinite(budget) && budget > 0 ? round2(budget) : 0,
      theme: ["system", "light", "dark"].includes(s.theme) ? s.theme : base.settings.theme,
      categories,
      autoBackup: s.autoBackup !== false,
      /* Kept across ordinary launches, so the daily copy really is daily. A backup
         being *restored* is different — it may come from another phone that
         wrote snapshots this one never had — and restoreDoc() clears it there. */
      lastAutoBackup: isValidKey(s.lastAutoBackup) ? s.lastAutoBackup : "",
      reminder: cleanReminder(s.reminder),
      /* Anyone who already has entries, or has already put their own name in,
         is past first launch — an update must never greet them with setup. */
      onboarded:
        s.onboarded === true ||
        expenses.length > 0 ||
        (cleanName(s.name) ?? APP_NAME) !== APP_NAME,
    },
  };
}

/**
 * migrate() for a file being restored rather than a store being reopened.
 *
 * The one difference is the snapshot day: a backup file can come from another
 * phone, and trusting its lastAutoBackup would let this phone skip a snapshot it
 * never actually wrote.
 */
export function restoreDoc(raw) {
  const doc = migrate(raw);
  return { ...doc, settings: { ...doc.settings, lastAutoBackup: "" } };
}

/** Trimmed and capped, or null when there is nothing usable to greet you by. */
export function cleanName(value) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ").slice(0, 24);
  return text || null;
}

function sanitizeEntry(raw, categories) {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Missing type means the row predates income support, so it is an expense.
  const type = raw.type === "income" ? "income" : "expense";
  const date = isValidKey(raw.date) ? raw.date : todayKey();
  const now = new Date().toISOString();

  /* A category from the wrong set would render with the wrong icon and pollute
     the breakdown, so it falls back to that type's default. An id nobody knows
     is left alone: it is most likely a custom category that was deleted while
     entries still pointed at it, and rewriting those would lose what the entry
     actually said. getCategory renders it neutrally. */
  const categoryId = resolveCategory(raw.categoryId, type, categories);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    type,
    amount: round2(amount),
    categoryId,
    note: typeof raw.note === "string" ? raw.note.slice(0, 200) : "",
    date,
    paymentMode: VALID_MODE.has(raw.paymentMode) ? raw.paymentMode : "cash",
    // Set only on entries a repeating rule posted; see lib/recurring.js.
    ...(typeof raw.ruleId === "string" && raw.ruleId ? { ruleId: raw.ruleId } : {}),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

function resolveCategory(id, type, categories) {
  if (typeof id !== "string" || !id) return defaultCategoryFor(type);
  const known = categories?.find((c) => c.id === id);
  if (!known) return id;
  return known.kind === type ? id : defaultCategoryFor(type);
}

/* ---------- Mutations ---------- */

/**
 * `input.id` is honoured when given, so a caller that needs to take the entry
 * back — quick-add's Undo — knows its id before it exists. Otherwise one is made.
 */
export function buildEntry(input, categories) {
  const now = new Date().toISOString();
  const id = typeof input?.id === "string" && input.id ? input.id : newId();
  return sanitizeEntry({ ...input, id, createdAt: now, updatedAt: now }, categories);
}

export function addExpense(doc, input) {
  let entry = buildEntry(input, doc.settings.categories);
  if (!entry) return doc;
  // A caller-supplied id must never shadow an entry that already has it.
  if (doc.expenses.some((e) => e.id === entry.id)) entry = { ...entry, id: newId() };
  return { ...doc, expenses: [entry, ...doc.expenses] };
}

export function updateExpense(doc, id, patch) {
  return {
    ...doc,
    expenses: doc.expenses.map((e) =>
      e.id === id
        ? (sanitizeEntry(
            { ...e, ...patch, updatedAt: new Date().toISOString() },
            doc.settings.categories,
          ) ?? e)
        : e,
    ),
  };
}

export function removeExpense(doc, id) {
  return { ...doc, expenses: doc.expenses.filter((e) => e.id !== id) };
}

/** Puts a deleted entry back where it was — powers the undo snackbar. */
export function restoreExpense(doc, expense, index) {
  const next = doc.expenses.slice();
  next.splice(Math.min(Math.max(index, 0), next.length), 0, expense);
  return { ...doc, expenses: next };
}

/* ---------- Repeating entries ---------- */

export function setRules(doc, rules) {
  return { ...doc, recurring: normalizeRules(rules) };
}

export function addRule(doc, rule) {
  const clean = normalizeRules([rule]);
  return clean.length ? { ...doc, recurring: [...doc.recurring, clean[0]] } : doc;
}

/**
 * Posts everything the rules owe, up to and including today.
 *
 * An entry a rule already posted carries its ruleId and its date, so restoring a
 * backup taken *before* a posting cannot post it twice: the pair is checked
 * before anything is written.
 */
export function runRecurring(doc, today = todayKey()) {
  if (!doc.recurring?.length) return { doc, added: 0 };

  const { due, rules, changed } = collectDue(doc.recurring, today);
  if (!due.length) return { doc: changed ? { ...doc, recurring: rules } : doc, added: 0 };

  const already = new Set(
    doc.expenses.filter((e) => e.ruleId).map((e) => `${e.ruleId}@${e.date}`),
  );

  const posted = due
    .filter((d) => !already.has(`${d.ruleId}@${d.date}`))
    .map((d) => buildEntry(d, doc.settings.categories))
    .filter(Boolean);

  return {
    doc: { ...doc, recurring: rules, expenses: [...posted, ...doc.expenses] },
    added: posted.length,
  };
}

export function setSettings(doc, patch) {
  return { ...doc, settings: { ...doc.settings, ...patch } };
}

/* ---------- Type helpers ---------- */

export const isIncome = (entry) => entry.type === "income";

export const spending = (list) => list.filter((e) => !isIncome(e));
export const earnings = (list) => list.filter(isIncome);

/** { expense, income, net } for a set of entries. */
export function totals(list) {
  const expense = sum(spending(list));
  const income = sum(earnings(list));
  return { expense, income, net: round2(income - expense) };
}

/** Spending only — what "how much did I spend" means everywhere in the UI. */
export function spent(list) {
  return sum(spending(list));
}

export function earned(list) {
  return sum(earnings(list));
}

/* ---------- Selectors ---------- */

/** Newest day first; within a day the most recently added entry leads. */
export function sortExpenses(expenses) {
  return expenses
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export function onDay(expenses, dayKey) {
  return expenses.filter((e) => e.date === dayKey);
}

export function inMonth(expenses, monthKey) {
  return expenses.filter((e) => monthKeyOf(e.date) === monthKey);
}

export function betweenDays(expenses, start, end) {
  return expenses.filter((e) => e.date >= start && e.date <= end);
}

/** [{ day, items, expense, income }] for the grouped history list. */
export function groupByDay(expenses) {
  const map = new Map();
  for (const e of sortExpenses(expenses)) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return [...map.entries()].map(([day, items]) => ({
    day,
    items,
    expense: spent(items),
    income: earned(items),
  }));
}

/**
 * Category totals for one type, biggest first, with each share of the period.
 * Mixing income into a spending breakdown would make every share meaningless,
 * so the type is always explicit.
 */
export function byCategory(entries, type = "expense") {
  const list = type === "income" ? earnings(entries) : spending(entries);
  const grand = sum(list);
  const map = new Map();
  for (const e of list) {
    map.set(e.categoryId, round2((map.get(e.categoryId) ?? 0) + e.amount));
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      share: grand > 0 ? amount / grand : 0,
      count: list.filter((e) => e.categoryId === categoryId).length,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Spending per day key, for the bar chart. Missing days come back as 0. */
export function dailyTotals(entries, dayKeys) {
  const map = new Map();
  for (const e of spending(entries)) {
    map.set(e.date, round2((map.get(e.date) ?? 0) + e.amount));
  }
  return dayKeys.map((day) => ({ day, amount: map.get(day) ?? 0 }));
}

/**
 * The entries a person keeps typing in — chai ₹20, the auto to work ₹40 — as
 * templates for one-tap "add again" on Home.
 *
 * Two entries count as the same when type, category, note and amount all match
 * (the note compared case-blind). Only things that happened at least twice in
 * the window qualify: one lunch is not a habit, and offering it back would just
 * clutter Home. The most frequent come first, recency breaking ties, and each
 * template carries the payment mode used most recently.
 */
export function frequentEntries(expenses, today = todayKey(), { days = 45, limit = 6 } = {}) {
  const since = new Date(`${today}T00:00:00`);
  since.setDate(since.getDate() - days);
  const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;

  const groups = new Map();
  for (const e of expenses) {
    if (e.date < from || e.date > today) continue;
    const key = `${e.type}|${e.categoryId}|${e.note.trim().toLowerCase()}|${e.amount}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { count: 1, latest: e });
    } else {
      g.count += 1;
      if (e.date > g.latest.date || (e.date === g.latest.date && e.createdAt > g.latest.createdAt)) {
        g.latest = e;
      }
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.latest.date.localeCompare(a.latest.date))
    .slice(0, limit)
    .map(({ count, latest }) => ({
      key: `${latest.type}|${latest.categoryId}|${latest.note.trim().toLowerCase()}|${latest.amount}`,
      count,
      type: latest.type,
      amount: latest.amount,
      categoryId: latest.categoryId,
      note: latest.note.trim(),
      paymentMode: latest.paymentMode,
    }));
}

/** Spending and income per day, for the calendar grid. */
export function dayTotalsMap(entries) {
  const map = new Map();
  for (const e of entries) {
    const cell = map.get(e.date) ?? { expense: 0, income: 0 };
    if (isIncome(e)) cell.income = round2(cell.income + e.amount);
    else cell.expense = round2(cell.expense + e.amount);
    map.set(e.date, cell);
  }
  return map;
}

/** Case-insensitive match across the note, the amount and the category label. */
export function search(expenses, query, categoryLabelOf) {
  const q = query.trim().toLowerCase();
  if (!q) return expenses;
  return expenses.filter((e) => {
    const label = categoryLabelOf ? categoryLabelOf(e.categoryId).toLowerCase() : "";
    return (
      e.note.toLowerCase().includes(q) ||
      String(e.amount).includes(q) ||
      label.includes(q)
    );
  });
}

/* `total` used to mean "sum of everything" when everything was an expense.
   It now resolves to spending, which is what every existing caller meant. */
export const total = spent;
