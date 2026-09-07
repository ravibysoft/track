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

export async function loadSampleData() {
  try {
    // Seed once only: after this, clearing the data in dev leaves it cleared,
    // which is what you want when testing empty states.
    if (localStorage.getItem(SEEDED_KEY)) return null;

    const res = await fetch("/sample-data.json");
    if (!res.ok) return null;

    const doc = migrate(await res.json());
    localStorage.setItem(SEEDED_KEY, "1");
    console.info(
      `[rozkharcha] dev: seeded ${doc.expenses.length} sample entries. ` +
        "Clear all data in Settings to start empty; run `npm run sample` to regenerate.",
    );
    return doc;
  } catch {
    // No sample file yet (or it is unreadable) — an empty app is fine.
    return null;
  }
}
