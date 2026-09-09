import { useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { AUTO_KEEP, FOLDER, exportBackup, readBackupFile, shareBackup } from "../lib/backup.js";
import * as db from "../lib/db.js";
import { dayLabel, fullDayLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { isNative } from "../lib/storage.js";
import { useExpenses } from "../state/useExpenses.js";

/**
 * Backup earned its own tab in the redesign. It used to be a section inside
 * Settings, where the one thing standing between you and losing everything was
 * buried three scrolls down.
 */
export default function BackupScreen({ onToast }) {
  const { doc, expenses, settings, currency, saveSettings, replaceDoc } = useExpenses();
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);

  const summary = useMemo(() => {
    const sorted = db.sortExpenses(expenses);
    return {
      count: expenses.length,
      spent: db.spent(expenses),
      earned: db.earned(expenses),
      since: sorted.length ? sorted[sorted.length - 1].date : null,
    };
  }, [expenses]);

  const run = async (key, task, done) => {
    setBusy(key);
    try {
      onToast(done(await task()));
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
      (parsed) => `Restored ${parsed.expenses.length} entries`,
    );
  };

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <p className="home__eyebrow">Your data</p>
          <h1 className="appbar__title">Backup</h1>
        </div>
      </header>

      <div className="card card--pad stack">
        <div className="hstack">
          <span className="grow setting-row__hint">Entries recorded</span>
          <strong className="num">{summary.count}</strong>
        </div>
        <div className="hstack">
          <span className="grow setting-row__hint">Total spent</span>
          <strong className="num">{formatMoney(summary.spent, currency)}</strong>
        </div>
        {summary.earned > 0 && (
          <div className="hstack">
            <span className="grow setting-row__hint">Total income</span>
            <strong className="num ledger__value--income">
              {formatMoney(summary.earned, currency)}
            </strong>
          </div>
        )}
        {summary.since && (
          <div className="hstack">
            <span className="grow setting-row__hint">Tracking since</span>
            <strong>{fullDayLabel(summary.since)}</strong>
          </div>
        )}
      </div>

      {/* Automatic first, because it is the one that works when you forget. */}
      <h2 className="section-title">Automatic</h2>
      <div className="card setting-list">
        <div className="setting-row">
          <span
            className="cat cat--sm"
            style={{ "--cat-color": settings.autoBackup ? "var(--ok)" : "var(--text-faint)" }}
          >
            <Icon name="calendar" />
          </span>
          <span className="grow setting-row__text">
            <span className="setting-row__label">Daily copy on this device</span>
            <span className="setting-row__hint">
              {!isNative()
                ? "Only in the installed app — a browser cannot save a file on its own"
                : !settings.autoBackup
                  ? "Off. Nothing is saved unless you export it yourself."
                  : settings.lastAutoBackup
                    ? `Last saved ${dayLabel(settings.lastAutoBackup).toLowerCase()} · keeps ${AUTO_KEEP} days`
                    : `Saves once a day into Documents/${FOLDER}`}
            </span>
          </span>
          <button
            type="button"
            className={`toggle${settings.autoBackup ? " is-on" : ""}`}
            role="switch"
            aria-checked={settings.autoBackup}
            aria-label="Daily copy on this device"
            disabled={!isNative()}
            onClick={() => {
              saveSettings({ autoBackup: !settings.autoBackup });
              onToast(settings.autoBackup ? "Automatic backup off" : "Automatic backup on");
            }}
          >
            <span className="toggle__knob" />
          </button>
        </div>
      </div>

      <h2 className="section-title">Save a copy</h2>
      <div className="card setting-list">
        <button
          type="button"
          className="setting-row"
          disabled={busy === "json" || summary.count === 0}
          onClick={() =>
            run("json", () => exportBackup(doc, "json"), (r) => `Saved ${r.filename} to ${r.location}`)
          }
        >
          <span className="cat cat--sm" style={{ "--cat-color": "var(--ok)" }}>
            <Icon name="download" />
          </span>
          <span className="grow setting-row__text">
            <span className="setting-row__label">Export backup (.json)</span>
            <span className="setting-row__hint">
              {isNative() ? "Saved into Documents/ExpenseTracker" : "Downloads to this device"}
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
            run("csv", () => exportBackup(doc, "csv"), (r) => `Saved ${r.filename} to ${r.location}`)
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
              onClick={() => run("share", () => shareBackup(doc, "json"), () => "Backup ready to share")}
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
      </div>

      <h2 className="section-title">Bring data back</h2>
      <div className="card setting-list">
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
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
      </div>

      <p className="footnote">
        Everything is stored on this device only. No account, no internet, no sync.
      </p>
    </div>
  );
}
