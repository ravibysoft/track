import { addDays, differenceInCalendarDays } from "date-fns";
import { fromKey, toKey } from "./dates.js";
import { migrate } from "./db.js";

/**
 * Loads samples/sample-data.json into an empty store while developing, so
 * `npm run dev` shows a populated app instead of an empty one.
 *
 * This module is only ever reached from behind an `import.meta.env.DEV` check,
 * and it is imported dynamically — Vite replaces that flag with `false` in a
 * production build, so Rollup drops the branch and this file never enters the
 * bundle, the deployed site or the APK.
 */
const SEEDED_KEY = "rozkharcha.devSeeded";

/**
 * The sample file is generated once and then sits in the repo, so its dates fall
 * a day further behind every day that passes — and a demo whose newest entry is
 * last week opens on an empty Daily tab. Sliding the whole set forward so the
 * newest entry lands on today keeps the shape of the data (the gaps between
 * entries, the spread across months) while always covering "now".
 */
export function shiftSampleToToday(doc) {
  const newest = doc.expenses.reduce((max, e) => (e.date > max ? e.date : max), "");
  if (!newest) return doc;

  const offset = differenceInCalendarDays(new Date(), fromKey(newest));
  if (offset <= 0) return doc; // already reaches today, or the clock is behind

  return {
    ...doc,
    expenses: doc.expenses.map((e) => ({
      ...e,
      date: toKey(addDays(fromKey(e.date), offset)),
    })),
  };
}

export async function loadSampleData() {
  try {
    // Seed once only: after this, clearing the data in dev leaves it cleared,
    // which is what you want when testing empty states.
    if (localStorage.getItem(SEEDED_KEY)) return null;

    const res = await fetch("/sample-data.json");
    if (!res.ok) return null;

    const doc = shiftSampleToToday(migrate(await res.json()));
    localStorage.setItem(SEEDED_KEY, "1");
    console.info(
      `[rozkharcha] dev: seeded ${doc.expenses.length} sample entries, shifted to today. ` +
        "Clear all data in Settings to start empty; run `npm run sample` to regenerate.",
    );
    return doc;
  } catch {
    // No sample file yet (or it is unreadable) — an empty app is fine.
    return null;
  }
}
