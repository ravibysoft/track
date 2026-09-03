/**
 * Pure document helpers — every function takes state and returns new state or a
 * derived value. No React, no I/O, so the rules stay easy to reason about and test.
 */
import { CATEGORIES, DEFAULT_CATEGORY } from "./categories.js";
import { isValidKey, monthKeyOf, todayKey } from "./dates.js";
import { DEFAULT_CURRENCY, round2, sum } from "./money.js";

export const DOC_VERSION = 1;

const VALID_CATEGORY = new Set(CATEGORIES.map((c) => c.id));
const VALID_MODE = new Set(["cash", "upi", "card"]);

export function emptyDoc() {
  return {
    version: DOC_VERSION,
    expenses: [],
    settings: {
      currency: DEFAULT_CURRENCY,
      monthlyBudget: 0,
      theme: "system",
    },
  };
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

  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.map(sanitizeExpense).filter(Boolean)
    : [];

  const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const budget = Number(s.monthlyBudget);

  return {
    version: DOC_VERSION,
    expenses,
    settings: {
      currency: typeof s.currency === "string" && s.currency ? s.currency : base.settings.currency,
      monthlyBudget: Number.isFinite(budget) && budget > 0 ? round2(budget) : 0,
      theme: ["system", "light", "dark"].includes(s.theme) ? s.theme : "system",
    },
  };
}

function sanitizeExpense(raw) {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const date = isValidKey(raw.date) ? raw.date : todayKey();
  const now = new Date().toISOString();

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    amount: round2(amount),
    categoryId: VALID_CATEGORY.has(raw.categoryId) ? raw.categoryId : DEFAULT_CATEGORY,
    note: typeof raw.note === "string" ? raw.note.slice(0, 200) : "",
    date,
    paymentMode: VALID_MODE.has(raw.paymentMode) ? raw.paymentMode : "cash",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

/* ---------- Mutations ---------- */

export function buildExpense(input) {
  const now = new Date().toISOString();
  return sanitizeExpense({ ...input, id: newId(), createdAt: now, updatedAt: now });
}

export function addExpense(doc, input) {
  const expense = buildExpense(input);
  if (!expense) return doc;
  return { ...doc, expenses: [expense, ...doc.expenses] };
}

export function updateExpense(doc, id, patch) {
  return {
    ...doc,
    expenses: doc.expenses.map((e) =>
      e.id === id
        ? (sanitizeExpense({ ...e, ...patch, updatedAt: new Date().toISOString() }) ?? e)
        : e,
    ),
  };
}

export function removeExpense(doc, id) {
  return { ...doc, expenses: doc.expenses.filter((e) => e.id !== id) };
}

/** Puts a deleted expense back where it was — powers the undo snackbar. */
export function restoreExpense(doc, expense, index) {
  const next = doc.expenses.slice();
  next.splice(Math.min(Math.max(index, 0), next.length), 0, expense);
  return { ...doc, expenses: next };
}

export function setSettings(doc, patch) {
  return { ...doc, settings: { ...doc.settings, ...patch } };
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

export function total(expenses) {
  return sum(expenses);
}

/** [{ day, label-ready key, items, total }] for the grouped history list. */
export function groupByDay(expenses) {
  const map = new Map();
  for (const e of sortExpenses(expenses)) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return [...map.entries()].map(([day, items]) => ({
    day,
    items,
    total: sum(items),
  }));
}

/** Category totals, biggest first, with each share of the period. */
export function byCategory(expenses) {
  const grand = sum(expenses);
  const map = new Map();
  for (const e of expenses) {
    map.set(e.categoryId, round2((map.get(e.categoryId) ?? 0) + e.amount));
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      share: grand > 0 ? amount / grand : 0,
      count: expenses.filter((e) => e.categoryId === categoryId).length,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Totals per day key, for the month bar chart. Missing days come back as 0. */
export function dailyTotals(expenses, dayKeys) {
  const map = new Map();
  for (const e of expenses) {
    map.set(e.date, round2((map.get(e.date) ?? 0) + e.amount));
  }
  return dayKeys.map((day) => ({ day, amount: map.get(day) ?? 0 }));
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
