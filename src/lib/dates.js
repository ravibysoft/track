/**
 * All dates are stored as local "YYYY-MM-DD" day keys, never as timestamps —
 * an expense belongs to the day you were standing in, regardless of timezone.
 * date-fns `parseISO` reads a date-only string as local midnight (unlike
 * `new Date("2026-09-03")`, which would be UTC and can shift the day back).
 */
import {
  addMonths,
  differenceInCalendarDays,
  endOfWeek,
  format,
  getDaysInMonth,
  parseISO,
  startOfWeek,
} from "date-fns";

/** Monday-start weeks. */
const WEEK_OPTS = { weekStartsOn: 1 };

export function toKey(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function fromKey(key) {
  return parseISO(key);
}

export function todayKey() {
  return toKey(new Date());
}

export function monthKeyOf(dayKey) {
  return dayKey.slice(0, 7);
}

export function currentMonthKey() {
  return monthKeyOf(todayKey());
}

/** "2026-09" -> "September 2026" (short: "Sep 2026"). */
export function monthLabel(monthKey, short = false) {
  return format(parseISO(`${monthKey}-01`), short ? "MMM yyyy" : "MMMM yyyy");
}

/** Shifts a month key by whole months: ("2026-01", -1) -> "2025-12". */
export function shiftMonth(monthKey, delta) {
  return format(addMonths(parseISO(`${monthKey}-01`), delta), "yyyy-MM");
}

/** "Today" / "Yesterday" / "Mon, 2 Sep" — the year is added only when it differs. */
export function dayLabel(dayKey) {
  const date = fromKey(dayKey);
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "EEE, d MMM" : "EEE, d MMM yyyy");
}

export function fullDayLabel(dayKey) {
  return format(fromKey(dayKey), "d MMMM yyyy");
}

/** Inclusive [start, end] day keys of the week containing `dayKey`. */
export function weekRange(dayKey = todayKey()) {
  const date = fromKey(dayKey);
  return {
    start: toKey(startOfWeek(date, WEEK_OPTS)),
    end: toKey(endOfWeek(date, WEEK_OPTS)),
  };
}

/** Every day key in a month, in order — used as the x-axis of the daily chart. */
export function monthDays(monthKey) {
  const total = getDaysInMonth(parseISO(`${monthKey}-01`));
  return Array.from(
    { length: total },
    (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`,
  );
}

/** Day-of-month number, for compact chart labels. */
export function dayOfMonth(dayKey) {
  return Number(dayKey.slice(8, 10));
}

/** Day keys sort correctly as plain strings, so range checks stay cheap. */
export function inRange(dayKey, start, end) {
  return dayKey >= start && dayKey <= end;
}

export function isValidKey(key) {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key);
}
