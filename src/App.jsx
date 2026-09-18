import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LockScreen from "./components/LockScreen.jsx";
import Snackbar from "./components/Snackbar.jsx";
import TabBar from "./components/TabBar.jsx";
import WelcomeScreen from "./components/WelcomeScreen.jsx";
import useInstallPrompt from "./hooks/useInstallPrompt.js";
import { getCategory } from "./lib/categories.js";
import { todayKey } from "./lib/dates.js";
import * as db from "./lib/db.js";
import { RELOCK_AFTER_MS, lockStatus } from "./lib/lock.js";
import { formatMoney } from "./lib/money.js";
import { ruleFromEntry } from "./lib/recurring.js";
import { syncReminder } from "./lib/reminder.js";
import { isNative } from "./lib/storage.js";
import BackupScreen from "./screens/BackupScreen.jsx";
import CategoriesPage from "./screens/CategoriesPage.jsx";
import RecurringPage from "./screens/RecurringPage.jsx";
import HistoryScreen from "./screens/HistoryScreen.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import ExpenseFormPage from "./screens/ExpenseFormPage.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import { useExpenses } from "./state/useExpenses.js";

/* Charts pull in a large charting library — keep it out of the first paint and
   load it the first time Stats is opened. */
const StatsScreen = lazy(() => import("./screens/StatsScreen.jsx"));

/** Left-to-right order of the tab bar, used to pick the slide direction. */
const TAB_ORDER = ["home", "trans", "stats", "backup", "settings"];

export default function App() {
  const { loaded, currency, expenses, add, addRule, update, remove, restore, settings, saveSettings } =
    useExpenses();
  const install = useInstallPrompt();

  /* Locked from the very first paint when a PIN is set — reading it lazily here,
     rather than in an effect, means the app never flashes its numbers before the
     lock screen covers them. */
  const [locked, setLocked] = useState(() => lockStatus().on);
  const hiddenAt = useRef(0);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      /* Back after more than a minute away: ask again. A quick trip to copy an
         amount from a bank SMS, or to pick a backup file, is not worth a PIN. */
      if (lockStatus().on && hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
      hiddenAt.current = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const [tab, setTab] = useState("home");
  const [form, setForm] = useState(null); // null | { expense: Expense | null }
  const [budgetSheet, setBudgetSheet] = useState(false);
  const [categoriesPage, setCategoriesPage] = useState(false);
  const [recurringPage, setRecurringPage] = useState(false);
  const [toast, setToast] = useState(null);

  /* +1 when moving right along the tab bar, -1 when moving left. The screen slides
     in from that side, so the motion matches the direction you travelled. */
  const [direction, setDirection] = useState(1);

  /* Switching tabs dismisses the budget sheet, so it never reappears on return. */
  const changeTab = useCallback(
    (next) => {
      setDirection(TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1);
      setTab(next);
      setBudgetSheet(false);
    },
    [tab],
  );

  const notify = useCallback((message) => setToast({ id: Date.now(), message }), []);
  const closeToast = useCallback(() => setToast(null), []);

  /* Each open gets its own id. The sheet plays a 190ms close animation before it
     calls back, so without this a quick re-open would be shut by the *previous*
     sheet's pending close — and would reuse its stale field values. */
  const formSeq = useRef(0);
  const openAdd = useCallback(
    (type = "expense") => setForm({ id: ++formSeq.current, expense: null, type }),
    [],
  );
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
    (values, repeat) => {
      if (form?.expense) {
        update(form.expense.id, values);
        notify("Expense updated");
        return;
      }

      add(values);
      if (!repeat) {
        notify("Expense added");
        return;
      }

      /* The entry just saved is occurrence one; the rule schedules the rest. It
         is built from the sanitised entry rather than the raw form values, so a
         rule can never carry an amount or a category the entry itself refused. */
      const entry = db.buildEntry(values, settings.categories);
      const rule = entry && ruleFromEntry(entry, repeat);
      if (rule) {
        addRule(rule);
        notify(repeat === "week" ? "Saved, and repeating weekly" : "Saved, and repeating monthly");
      } else {
        notify("Expense added");
      }
    },
    [form, add, update, addRule, notify, settings.categories],
  );

  /**
   * One tap from Home's "Add again" row. The id is made here, before the entry
   * exists, so Undo can take back exactly this entry and nothing else.
   */
  const handleQuickAdd = useCallback(
    (t) => {
      const id = db.newId();
      add({
        id,
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryId,
        note: t.note,
        paymentMode: t.paymentMode,
        date: todayKey(),
      });
      setToast({
        id: Date.now(),
        message: `Added ${t.note || getCategory(t.categoryId).label} · ${formatMoney(t.amount, currency)}`,
        actionLabel: "Undo",
        onAction: () => remove(id),
      });
    },
    [add, remove, currency],
  );

  /* The phone's reminder schedule follows the setting. If Android refuses the
     permission, the switch goes back off and says why — a reminder that silently
     never fires is worse than none. */
  const reminderOn = settings.reminder?.on;
  const reminderTime = settings.reminder?.time;
  useEffect(() => {
    if (!loaded || !isNative()) return undefined;
    let alive = true;
    syncReminder({ on: reminderOn, time: reminderTime })
      .then((result) => {
        if (!alive || result.ok) return;
        if (result.reason === "denied") {
          saveSettings({ reminder: { on: false, time: reminderTime } });
          notify("Notifications are blocked. Allow them for Roz Kharcha in Android settings.");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loaded, reminderOn, reminderTime, saveSettings, notify]);

  /* A new tab always opens at the top. Without this the body keeps the previous
     screen's scroll offset, so a shorter page appears already scrolled down. */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  /* Long-pressing the installed icon offers "Add expense", which launches the app
     at /?action=add (declared as a manifest shortcut). Honour it, then strip the
     parameter so a later reload doesn't pop the form open again. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "add") return;
    params.delete("action");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
    openAdd("expense");
  }, [openAdd]);

  /* Android hardware Back: close what's on top, then fall back to Trans., then exit.
     The handler lives in a ref so the native listener is registered only once. */
  const backRef = useRef(() => false);
  useEffect(() => {
    backRef.current = () => {
      /* Back must never be a way past the lock: it leaves the app instead. */
      if (locked) return false;
      if (form) {
        closeForm();
        return true;
      }
      if (categoriesPage) {
        setCategoriesPage(false);
        return true;
      }
      if (recurringPage) {
        setRecurringPage(false);
        return true;
      }
      if (budgetSheet) {
        setBudgetSheet(false);
        return true;
      }
      if (tab !== "home") {
        // changeTab, not setTab — otherwise going Back keeps the last forward
        // direction and the screen slides in from the wrong side.
        changeTab("home");
        return true;
      }
      return false;
    };
  }, [locked, form, budgetSheet, categoriesPage, recurringPage, tab, closeForm, changeTab]);

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

  /* Match the status bar to the active theme — Style.Light means dark icons on a
     light bar, which is what the white theme needs. */
  useEffect(() => {
    if (!isNative()) return;
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: dark ? "#0b0c10" : "#ffffff" }).catch(() => {});
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
      {/* Keyed on the tab so switching remounts the host and replays its slide-in.
          That remount also resets the boundary, so a screen that failed once gets
          a clean attempt the next time you come back to it. */}
      <div className="screen-host" key={tab} data-direction={direction}>
        <ErrorBoundary scope="screen">
          {tab === "home" && (
            <HomeScreen
              install={install}
              onAdd={() => openAdd("expense")}
              onAddIncome={() => openAdd("income")}
              onQuickAdd={handleQuickAdd}
              onEdit={openEdit}
              onDelete={deleteWithUndo}
              onSeeAll={() => changeTab("trans")}
              onOpenSettings={() => changeTab("settings")}
            />
          )}
          {tab === "trans" && (
            <HistoryScreen
              onAdd={() => openAdd("expense")}
              onEdit={openEdit}
              onDelete={deleteWithUndo}
              onSettings={() => changeTab("settings")}
              onOpenSettings={() => {
                changeTab("settings");
                setBudgetSheet(true);
              }}
            />
          )}
          {tab === "backup" && (
            <BackupScreen onToast={notify} onSettings={() => changeTab("settings")} />
          )}
          {tab === "stats" && (
            <Suspense fallback={<div className="screen"><div className="boot" /></div>}>
              <StatsScreen onSettings={() => changeTab("settings")} onToast={notify} />
            </Suspense>
          )}
          {tab === "settings" && (
            <SettingsScreen
              install={install}
              onToast={notify}
              onOpenBackup={() => changeTab("backup")}
              onOpenCategories={() => setCategoriesPage(true)}
              onOpenRecurring={() => setRecurringPage(true)}
              budgetSheetOpen={budgetSheet}
              onBudgetSheetChange={setBudgetSheet}
            />
          )}
        </ErrorBoundary>
      </div>

      <TabBar active={tab} onChange={changeTab} onAdd={() => openAdd("expense")} />

      {form && (
        <ExpenseFormPage
          key={form.id}
          expense={form.expense}
          initialType={form.type}
          currency={currency}
          onSave={handleSave}
          onDelete={deleteWithUndo}
          onClose={() => closeForm(form.id)}
        />
      )}

      {categoriesPage && (
        <CategoriesPage onToast={notify} onClose={() => setCategoriesPage(false)} />
      )}

      {recurringPage && (
        <RecurringPage onToast={notify} onClose={() => setRecurringPage(false)} />
      )}

      {/* First launch only: nobody with entries, or who has already set a name,
          ever sees this — including everyone updating from an older version. */}
      {!settings.onboarded && expenses.length === 0 && !locked && (
        <WelcomeScreen
          onDone={(values) => {
            saveSettings({ ...values, onboarded: true });
            notify(values.name !== db.APP_NAME ? `Welcome, ${values.name}` : "You're all set");
          }}
        />
      )}

      {locked && (
        <LockScreen biometric={lockStatus().biometric} onUnlock={() => setLocked(false)} />
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
