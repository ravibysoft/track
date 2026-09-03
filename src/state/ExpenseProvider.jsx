import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as db from "../lib/db.js";
import { flushSave, installFlushHooks, readDoc, scheduleSave } from "../lib/storage.js";
import { ExpenseContext } from "./useExpenses.js";

export function ExpenseProvider({ children }) {
  const [doc, setDoc] = useState(db.emptyDoc);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  /* Load once, then let every later change write itself back. */
  useEffect(() => {
    let alive = true;
    readDoc().then((raw) => {
      if (!alive) return;
      setDoc(db.migrate(raw));
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
      add,
      update,
      remove,
      restore,
      saveSettings,
      replaceDoc,
      flush: flushSave,
    }),
    [doc, loaded, add, update, remove, restore, saveSettings, replaceDoc],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}
