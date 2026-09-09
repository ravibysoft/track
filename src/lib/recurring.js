import { addMonths, addWeeks, getDaysInMonth, parseISO } from "date-fns";
import { fromKey, isValidKey, toKey, todayKey } from "./dates.js";
import { round2 } from "./money.js";

/**
 * Repeating entries — rent, salary, an EMI, a weekly allowance.
 *
 * A rule does not *show* anything. It creates real entries on the days they fall
 * due, which are then ordinary entries: editable, deletable, and counted like
 * everything else. That is the whole design. A "virtual" entry that only exists
 * while its rule does would vanish from last year's totals the moment the rent
 * changed, and could not be corrected the month the landlord asked for extra.
 *
 * `nextDate` is the rule's memory of where it has got to, so opening the app
 * twice in a day cannot post the rent twice, and opening it after three months
 * away posts the three that were missed — each on its own date.
 */
export const FREQUENCIES = [
  { id: "month", label: "Every month" },
  { id: "week", label: "Every week" },
];

/** A guard against a corrupt date, not a policy: nobody has 400 rents pending. */
const MAX_CATCH_UP = 120;

export function isFrequency(value) {
  return FREQUENCIES.some((f) => f.id === value);
}

/**
 * The next date after `dayKey`.
 *
 * Monthly repeats count from `anchorDay`, not from the previous occurrence: a
 * rent due on the 31st lands on the 28th in February, and must go back to the
 * 31st in March rather than staying on the 28th forever.
 */
export function advance(dayKey, every, anchorDay) {
  const date = fromKey(dayKey);
  if (every === "week") return toKey(addWeeks(date, 1));

  const next = addMonths(parseISO(`${dayKey.slice(0, 7)}-01`), 1);
  const month = toKey(next).slice(0, 7);
  const day = Math.min(anchorDay || Number(dayKey.slice(8, 10)), getDaysInMonth(next));
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function sanitizeRule(raw) {
  if (!raw || typeof raw !== "object") return null;

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!isFrequency(raw.every)) return null;
  if (!isValidKey(raw.nextDate)) return null;

  const anchorDay = Number(raw.anchorDay);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `r${Math.random().toString(36).slice(2, 10)}`,
    type: raw.type === "income" ? "income" : "expense",
    amount: round2(amount),
    categoryId: typeof raw.categoryId === "string" && raw.categoryId ? raw.categoryId : "other",
    note: typeof raw.note === "string" ? raw.note.slice(0, 200) : "",
    paymentMode: ["cash", "upi", "card"].includes(raw.paymentMode) ? raw.paymentMode : "cash",
    every: raw.every,
    anchorDay:
      Number.isFinite(anchorDay) && anchorDay >= 1 && anchorDay <= 31
        ? Math.trunc(anchorDay)
        : Number(raw.nextDate.slice(8, 10)),
    nextDate: raw.nextDate,
    // Paused rules stay in the list, and stop posting, until they are resumed.
    paused: raw.paused === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

export function normalizeRules(raw) {
  return Array.isArray(raw) ? raw.map(sanitizeRule).filter(Boolean) : [];
}

/** Builds the rule an entry implies: the entry is occurrence one, this is two. */
export function ruleFromEntry(entry, every) {
  if (!isFrequency(every)) return null;
  const anchorDay = Number(entry.date.slice(8, 10));
  return sanitizeRule({
    type: entry.type,
    amount: entry.amount,
    categoryId: entry.categoryId,
    note: entry.note,
    paymentMode: entry.paymentMode,
    every,
    anchorDay,
    nextDate: advance(entry.date, every, anchorDay),
  });
}

/**
 * Everything a rule owes up to and including today, and the rules moved on past
 * it. Pure: the caller decides what to do with the entries, which keeps this
 * testable without a document or a clock.
 */
export function collectDue(rules, today = todayKey()) {
  const due = [];
  let changed = false;

  const next = rules.map((rule) => {
    if (rule.paused) return rule;

    let cursor = rule.nextDate;
    let guard = 0;
    while (cursor <= today && guard < MAX_CATCH_UP) {
      due.push({
        type: rule.type,
        amount: rule.amount,
        categoryId: rule.categoryId,
        note: rule.note,
        paymentMode: rule.paymentMode,
        date: cursor,
        // Marks the entry as posted by a rule, so the same rule is not asked to
        // post it again if a backup from before the posting is ever restored.
        ruleId: rule.id,
      });
      cursor = advance(cursor, rule.every, rule.anchorDay);
      guard += 1;
    }

    if (cursor === rule.nextDate) return rule;
    changed = true;
    return { ...rule, nextDate: cursor };
  });

  return { due, rules: changed ? next : rules, changed };
}

/** "Every month on the 5th" / "Every week on Monday" — for the rule list. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function describeRule(rule) {
  if (rule.every === "week") {
    return `Every week on ${WEEKDAYS[fromKey(rule.nextDate).getDay()]}`;
  }
  const day = rule.anchorDay;
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `Every month on the ${day}${suffix}`;
}
