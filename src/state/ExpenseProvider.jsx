import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runAutoBackup } from "../lib/backup.js";
import { setCategoryRegistry } from "../lib/categories.js";
import { todayKey } from "../lib/dates.js";
import * as db from "../lib/db.js";
import { flushSave, installFlushHooks, readDoc, scheduleSave } from "../lib/storage.js";
import { ExpenseContext } from "./useExpenses.js";

export function ExpenseProvider({ children }) {
  const [doc, setDoc] = useState(db.emptyDoc);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  /* Published during render, not from an effect: rows, chips and chart slices all
     read the category list synchronously as they render, so it has to be current
     before this provider's children run — an effect fires after they have already
     drawn with the old list. It is a plain assignment of derived data, so running
     it twice (StrictMode) changes nothing. */
  const categories = useMemo(
    () => setCategoryRegistry(doc.settings.categories),
    [doc.settings.categories],
  );

  /* Load once, then let every later change write itself back. */
  useEffect(() => {
    let alive = true;
    readDoc().then(async (raw) => {
      if (!alive) return;
      let next = db.migrate(raw);

      /* While developing, an empty store is seeded from samples/sample-data.json
         so the app has something to show. `import.meta.env.DEV` is compiled to
         `false` in a production build, so this branch — and the module it
         imports — are removed entirely from the shipped bundle. */
      if (import.meta.env.DEV && next.expenses.length === 0) {
        const { loadSampleData } = await import("../lib/devSample.js");
        const sample = await loadSampleData();
        if (!alive) return;
        if (sample) next = sample;
      }

      /* Anything the repeating rules owe is posted before the first paint, so
         the app never shows a month that is missing its rent for a moment. */
      setDoc(db.runRecurring(next).doc);
      loadedRef.current = true;
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Never persist before the first read lands, or an empty doc would wipe the file. */
  useEffect(() => {
    if (!loaded) return;
    scheduleSave(doc);
  }, [doc, loaded]);

  useEffect(() => installFlushHooks(), []);

  /* One snapshot a day into the public folder, so a lost phone is not a lost
     year. It runs after the first paint and never blocks it: the app opening is
     more urgent than the copy, and a failed write must not keep it shut. The
     day is recorded only once the file is actually on disk. */
  useEffect(() => {
    if (!loaded || !doc.settings.autoBackup) return;
    if (doc.settings.lastAutoBackup === todayKey()) return;
    if (doc.expenses.length === 0) return; // nothing worth a file yet

    let alive = true;
    runAutoBackup(doc, doc.settings.lastAutoBackup)
      .then((result) => {
        if (alive && result.written) {
          setDoc((d) => db.setSettings(d, { lastAutoBackup: result.day }));
        }
      })
      .catch(() => {
        // No public folder on this device. The manual export still works, and
        // saying so once a day would be nagging about something already visible
        // on the Backup screen.
      });
    return () => {
      alive = false;
    };
  }, [loaded, doc]);

  /* A phone is not restarted daily — it is unlocked. Rules are checked again
     whenever the app comes back to the foreground, so rent posted at midnight
     appears when it is next opened rather than at the next cold start. */
  useEffect(() => {
    if (!loaded) return undefined;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      setDoc((d) => {
        const { doc: next, added } = db.runRecurring(d);
        return added > 0 || next !== d ? next : d;
      });
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [loaded]);

  /* Theme: "system" leaves it to prefers-color-scheme, the others force a value. */
  useEffect(() => {
    const root = document.documentElement;
    if (doc.settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", doc.settings.theme);
  }, [doc.settings.theme]);

  const add = useCallback((input) => setDoc((d) => db.addExpense(d, input)), []);

  const update = useCallback(
    (id, patch) => setDoc((d) => db.updateExpense(d, id, patch)),
    [],
  );

  /**
   * Removes an expense and hands back what was removed plus its position, so the
   * caller can offer Undo without the data ever leaving the app.
   */
  const remove = useCallback((id) => {
    let snapshot = null;
    setDoc((d) => {
      const index = d.expenses.findIndex((e) => e.id === id);
      if (index === -1) return d;
      snapshot = { expense: d.expenses[index], index };
      return db.removeExpense(d, id);
    });
    return () => snapshot;
  }, []);

  const restore = useCallback(
    (expense, index) => setDoc((d) => db.restoreExpense(d, expense, index)),
    [],
  );

  const saveRules = useCallback((rules) => setDoc((d) => db.setRules(d, rules)), []);

  const addRule = useCallback((rule) => setDoc((d) => db.addRule(d, rule)), []);

  const saveSettings = useCallback(
    (patch) => setDoc((d) => db.setSettings(d, patch)),
    [],
  );

  /** Used by Import (replace everything) and by Clear all data. */
  const replaceDoc = useCallback((raw) => setDoc(db.migrate(raw)), []);

  const value = useMemo(
    () => ({
      doc,
      loaded,
      expenses: doc.expenses,
      settings: doc.settings,
      currency: doc.settings.currency,
      categories,
      rules: doc.recurring,
      add,
      update,
      remove,
      restore,
      saveSettings,
      saveRules,
      addRule,
      replaceDoc,
      flush: flushSave,
    }),
    [
      doc,
      loaded,
      categories,
      add,
      update,
      remove,
      restore,
      saveSettings,
      saveRules,
      addRule,
      replaceDoc,
    ],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}
