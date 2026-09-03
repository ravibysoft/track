import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Icon from "./components/Icon.jsx";
import Snackbar from "./components/Snackbar.jsx";
import TabBar from "./components/TabBar.jsx";
import { isNative } from "./lib/storage.js";
import HistoryScreen from "./screens/HistoryScreen.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import ExpenseFormSheet from "./screens/ExpenseFormSheet.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import { useExpenses } from "./state/useExpenses.js";

/* Charts pull in a large charting library — keep it out of the first paint and
   load it the first time Stats is opened. */
const StatsScreen = lazy(() => import("./screens/StatsScreen.jsx"));

export default function App() {
  const { loaded, currency, add, update, remove, restore, settings } = useExpenses();

  const [tab, setTab] = useState("home");
  const [form, setForm] = useState(null); // null | { expense: Expense | null }
  const [budgetSheet, setBudgetSheet] = useState(false);
  const [toast, setToast] = useState(null);

  /* Switching tabs dismisses the budget sheet, so it never reappears on return. */
  const changeTab = useCallback((next) => {
    setTab(next);
    setBudgetSheet(false);
  }, []);

  const notify = useCallback((message) => setToast({ id: Date.now(), message }), []);
  const closeToast = useCallback(() => setToast(null), []);

  /* Each open gets its own id. The sheet plays a 190ms close animation before it
     calls back, so without this a quick re-open would be shut by the *previous*
     sheet's pending close — and would reuse its stale field values. */
  const formSeq = useRef(0);
  const openAdd = useCallback(() => setForm({ id: ++formSeq.current, expense: null }), []);
  const openEdit = useCallback(
    (expense) => setForm({ id: ++formSeq.current, expense }),
    [],
  );
  const closeForm = useCallback(
    (id) => setForm((current) => (current && (id === undefined || current.id === id) ? null : current)),
    [],
  );

  /** Delete now, offer Undo for a few seconds — no confirmation dialog in the way. */
  const deleteWithUndo = useCallback(
    (expense) => {
      const snapshot = remove(expense.id)();
      setToast({
        id: Date.now(),
        message: "Expense deleted",
        actionLabel: "Undo",
        onAction: () => snapshot && restore(snapshot.expense, snapshot.index),
      });
    },
    [remove, restore],
  );

  const handleSave = useCallback(
    (values) => {
      if (form?.expense) {
        update(form.expense.id, values);
        notify("Expense updated");
      } else {
        add(values);
        notify("Expense added");
      }
    },
    [form, add, update, notify],
  );

  /* Android hardware Back: close what's on top, then fall back to Home, then exit.
     The handler lives in a ref so the native listener is registered only once. */
  const backRef = useRef(() => false);
  useEffect(() => {
    backRef.current = () => {
      if (form) {
        closeForm();
        return true;
      }
      if (budgetSheet) {
        setBudgetSheet(false);
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    };
  }, [form, budgetSheet, tab, closeForm]);

  useEffect(() => {
    if (!isNative()) return undefined;
    let handle;
    let cancelled = false;

    import("@capacitor/app").then(async ({ App: CapacitorApp }) => {
      const listener = await CapacitorApp.addListener("backButton", () => {
        if (!backRef.current()) CapacitorApp.exitApp();
      });
      if (cancelled) listener.remove();
      else handle = listener;
    });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, []);

  /* Match the status bar icons to the active theme. */
  useEffect(() => {
    if (!isNative()) return;
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    });
  }, [settings.theme]);

  if (!loaded) {
    return (
      <div className="app">
        <div className="boot" />
      </div>
    );
  }

  return (
    <div className="app">
      {tab === "home" && (
        <HomeScreen
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={deleteWithUndo}
          onOpenSettings={() => {
            changeTab("settings");
            setBudgetSheet(true);
          }}
        />
      )}
      {tab === "history" && <HistoryScreen onEdit={openEdit} onDelete={deleteWithUndo} />}
      {tab === "stats" && (
        <Suspense fallback={<div className="screen"><div className="boot" /></div>}>
          <StatsScreen />
        </Suspense>
      )}
      {tab === "settings" && (
        <SettingsScreen
          onToast={notify}
          budgetSheetOpen={budgetSheet}
          onBudgetSheetChange={setBudgetSheet}
        />
      )}

      {tab !== "settings" && (
        <button type="button" className="fab" onClick={openAdd} aria-label="Add expense">
          <Icon name="plus" />
        </button>
      )}

      <TabBar active={tab} onChange={changeTab} />

      {form && (
        <ExpenseFormSheet
          key={form.id}
          expense={form.expense}
          currency={currency}
          onSave={handleSave}
          onDelete={deleteWithUndo}
          onClose={() => closeForm(form.id)}
        />
      )}

      {toast && (
        <Snackbar
          key={toast.id}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={closeToast}
          duration={toast.actionLabel ? 6000 : 2600}
        />
      )}
    </div>
  );
}
