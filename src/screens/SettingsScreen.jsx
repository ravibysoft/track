import { useMemo, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
import { exportBackup, readBackupFile, shareBackup } from "../lib/backup.js";
import * as db from "../lib/db.js";
import { fullDayLabel } from "../lib/dates.js";
import { formatMoney, parseAmount } from "../lib/money.js";
import { isNative } from "../lib/storage.js";
import { useExpenses } from "../state/useExpenses.js";

const THEMES = [
  { id: "system", label: "System", icon: "contrast" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];

export default function SettingsScreen({ onToast, budgetSheetOpen, onBudgetSheetChange }) {
  const { doc, expenses, settings, currency, saveSettings, replaceDoc } = useExpenses();
  const [clearStep, setClearStep] = useState(0);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);

  const summary = useMemo(() => {
    const sorted = db.sortExpenses(expenses);
    return {
      count: expenses.length,
      total: db.total(expenses),
      since: sorted.length ? sorted[sorted.length - 1].date : null,
    };
  }, [expenses]);

  const run = async (key, task, done) => {
    setBusy(key);
    try {
      const result = await task();
      onToast(done(result));
    } catch (err) {
      onToast(err?.message || "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again later
    if (!file) return;
    await run(
      "import",
      async () => {
        const parsed = await readBackupFile(file);
        replaceDoc(parsed);
        return parsed;
      },
      (parsed) => `Restored ${parsed.expenses.length} expenses`,
    );
  };

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">Settings</h1>
          <p className="appbar__sub">Budget, backup and data</p>
        </div>
      </header>

      {/* Budget */}
      <h2 className="section-title">Budget</h2>
      <div className="card setting-list">
        <button
          type="button"
          className="setting-row"
          onClick={() => onBudgetSheetChange(true)}
        >
          <span className="cat cat--sm" style={{ "--cat-color": "var(--accent)" }}>
            <Icon name="target" />
          </span>
          <span className="grow setting-row__text">
            <span className="setting-row__label">Monthly budget</span>
            <span className="setting-row__hint">
              {settings.monthlyBudget > 0
                ? "Warns you at 80% and again when you cross it"
                : "Not set yet"}
            </span>
          </span>
          <span className="setting-row__value num">
            {settings.monthlyBudget > 0 ? formatMoney(settings.monthlyBudget, currency) : "Set"}
          </span>
          <Icon name="right" size={17} style={{ color: "var(--text-faint)" }} />
        </button>
      </div>

      {/* Appearance */}
      <h2 className="section-title">Appearance</h2>
      <div className="card card--pad">
        <div className="seg">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`seg__btn${settings.theme === t.id ? " is-active" : ""}`}
              onClick={() => saveSettings({ theme: t.id })}
              aria-pressed={settings.theme === t.id}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backup */}
      <h2 className="section-title">Backup</h2>
      <div className="card setting-list">
        <button
          type="button"
          className="setting-row"
          disabled={busy === "json" || summary.count === 0}
          onClick={() =>
            run(
              "json",
              () => exportBackup(doc, "json"),
              (r) => `Saved ${r.filename} to ${r.location}`,
            )
          }
        >
          <span className="cat cat--sm" style={{ "--cat-color": "var(--c-groceries)" }}>
            <Icon name="download" />
          </span>
          <span className="grow setting-row__text">
            <span className="setting-row__label">Export backup (.json)</span>
            <span className="setting-row__hint">
              {isNative() ? "Saved into Documents/ExpenseTracker" : "Downloads to this computer"}
            </span>
          </span>
          <Icon name="right" size={17} style={{ color: "var(--text-faint)" }} />
        </button>

        <div className="list__sep" />

        <button
          type="button"
          className="setting-row"
          disabled={busy === "csv" || summary.count === 0}
          onClick={() =>
            run(
              "csv",
              () => exportBackup(doc, "csv"),
              (r) => `Saved ${r.filename} to ${r.location}`,
            )
          }
        >
          <span className="cat cat--sm" style={{ "--cat-color": "var(--c-travel)" }}>
            <Icon name="history" />
          </span>
          <span className="grow setting-row__text">
            <span className="setting-row__label">Export for Excel (.csv)</span>
            <span className="setting-row__hint">Opens in Excel or Google Sheets</span>
          </span>
          <Icon name="right" size={17} style={{ color: "var(--text-faint)" }} />
        </button>

        {isNative() && (
          <>
            <div className="list__sep" />
            <button
              type="button"
              className="setting-row"
              disabled={busy === "share" || summary.count === 0}
              onClick={() =>
                run(
                  "share",
                  () => shareBackup(doc, "json"),
                  () => "Backup ready to share",
                )
              }
            >
              <span className="cat cat--sm" style={{ "--cat-color": "var(--c-entertainment)" }}>
                <Icon name="share" />
              </span>
              <span className="grow setting-row__text">
                <span className="setting-row__label">Share backup</span>
                <span className="setting-row__hint">Send to WhatsApp, Drive or email</span>
              </span>
              <Icon name="right" size={17} style={{ color: "var(--text-faint)" }} />
            </button>
          </>
        )}

        <div className="list__sep" />

        <button
          type="button"
          className="setting-row"
          disabled={busy === "import"}
          onClick={() => fileRef.current?.click()}
        >
          <span className="cat cat--sm" style={{ "--cat-color": "var(--c-bills)" }}>
            <Icon name="upload" />
          </span>
          <span className="grow setting-row__text">
            <span className="setting-row__label">Restore from backup</span>
            <span className="setting-row__hint">Replaces everything with the .json file</span>
          </span>
          <Icon name="right" size={17} style={{ color: "var(--text-faint)" }} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImport}
        />
      </div>

      {/* Data */}
      <h2 className="section-title">Your data</h2>
      <div className="card card--pad stack">
        <div className="hstack">
          <span className="grow setting-row__hint">Expenses recorded</span>
          <strong className="num">{summary.count}</strong>
        </div>
        <div className="hstack">
          <span className="grow setting-row__hint">Total tracked</span>
          <strong className="num">{formatMoney(summary.total, currency)}</strong>
        </div>
        {summary.since && (
          <div className="hstack">
            <span className="grow setting-row__hint">Tracking since</span>
            <strong>{fullDayLabel(summary.since)}</strong>
          </div>
        )}
        <button
          type="button"
          className="btn btn--danger btn--block"
          disabled={summary.count === 0}
          onClick={() => setClearStep(1)}
        >
          <Icon name="trash" size={17} />
          Clear all data
        </button>
      </div>

      <p className="footnote">
        Everything is stored on this phone only. No account, no internet, no sync.
        <br />
        Track · v1.0
      </p>

      {budgetSheetOpen && (
        <BudgetSheet
          current={settings.monthlyBudget}
          currency={currency}
          onClose={() => onBudgetSheetChange(false)}
          onSave={(value) => {
            saveSettings({ monthlyBudget: value });
            onToast(value > 0 ? "Budget updated" : "Budget removed");
          }}
        />
      )}

      {clearStep === 1 && (
        <ConfirmDialog
          title="Clear all data?"
          message={`This removes all ${summary.count} expenses from this phone. Export a backup first if you might want them back.`}
          confirmLabel="Continue"
          onCancel={() => setClearStep(0)}
          onConfirm={() => setClearStep(2)}
        />
      )}

      {clearStep === 2 && (
        <ConfirmDialog
          title="Really delete everything?"
          message="This cannot be undone."
          confirmLabel="Delete everything"
          onCancel={() => setClearStep(0)}
          onConfirm={() => {
            replaceDoc({ settings });
            setClearStep(0);
            onToast("All expenses deleted");
          }}
        />
      )}
    </div>
  );
}

function BudgetSheet({ current, currency, onSave, onClose }) {
  const [text, setText] = useState(current > 0 ? String(current) : "");
  const value = parseAmount(text) ?? 0;

  return (
    <Sheet
      title="Monthly budget"
      onClose={onClose}
      footer={({ close }) => (
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          onClick={() => {
            onSave(value);
            close();
          }}
        >
          {value > 0 ? "Save budget" : "Remove budget"}
        </button>
      )}
    >
      <p className="sheet__note">
        Set how much you plan to spend in a month. Home shows a bar with what's left.
      </p>
      <div className="amount-input">
        <span className="amount-input__symbol">{currency}</span>
        <input
          className="amount-input__field num"
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={text}
          maxLength={10}
          autoFocus
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
      <div className="chip-row" style={{ marginTop: "var(--sp-4)" }}>
        {[5000, 10000, 15000, 20000, 30000, 50000].map((preset) => (
          <button
            key={preset}
            type="button"
            className="chip"
            aria-pressed={value === preset}
            onClick={() => setText(String(preset))}
          >
            {formatMoney(preset, currency)}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
