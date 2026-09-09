import { useCallback, useEffect, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Icon from "../components/Icon.jsx";
import { getCategory, getPaymentLabel } from "../lib/categories.js";
import { dayLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { describeRule } from "../lib/recurring.js";
import { useExpenses } from "../state/useExpenses.js";

/**
 * The repeating rules: what they post, when they next post it, and how to pause
 * or stop them.
 *
 * There is no editor here on purpose. A rule is created by ticking Repeat while
 * adding the entry — where the amount, category and note are already being typed
 * — so this screen only has to answer "what is going to happen, and can I stop
 * it". Changing an amount means stopping the old rule and adding the new one,
 * which is also the honest thing to record: last year's rent really was lower.
 */
export default function RecurringPage({ onClose, onToast }) {
  const { rules, currency, saveRules } = useExpenses();

  const [confirmStop, setConfirmStop] = useState(null);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(onClose, 200);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const togglePause = (rule) => {
    saveRules(rules.map((r) => (r.id === rule.id ? { ...r, paused: !r.paused } : r)));
    onToast?.(rule.paused ? "Repeating again" : "Paused");
  };

  const stop = (rule) => {
    saveRules(rules.filter((r) => r.id !== rule.id));
    setConfirmStop(null);
    onToast?.("Stopped repeating");
  };

  return (
    <div className={`page${closing ? " is-closing" : ""}`} role="dialog" aria-label="Repeating entries">
      <header className="page__bar">
        <button type="button" className="icon-btn" onClick={close} aria-label="Back">
          <Icon name="left" />
        </button>
        <h1 className="page__title">Repeating</h1>
      </header>

      <div className="page__body">
        {rules.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="calendar"
              title="Nothing repeats yet"
              text="Rent, salary, an EMI — add the entry once and pick Every month, and it saves itself from then on."
            />
          </div>
        ) : (
          <>
            <p className="hint">
              Each one saves a normal entry on its day. Entries already saved stay
              exactly as they are, whatever you do here.
            </p>

            <div className="card card--flat setting-list">
              {rules.map((rule, i) => {
                const category = getCategory(rule.categoryId);
                return (
                  <div key={rule.id} className={`rule${rule.paused ? " is-paused" : ""}`}>
                    {i > 0 && <div className="list__sep" />}

                    <CategoryIcon id={rule.categoryId} size="sm" />

                    <span className="grow rule__body">
                      <span className="rule__title">
                        {rule.note?.trim() || category.label}
                      </span>
                      <span className="rule__meta">
                        {describeRule(rule)} · {getPaymentLabel(rule.paymentMode)}
                      </span>
                      <span className="rule__next">
                        {rule.paused ? "Paused" : `Next ${dayLabel(rule.nextDate)}`}
                      </span>
                    </span>

                    <span className="rule__side">
                      <span
                        className={`rule__amount num${rule.type === "income" ? " row__amount--income" : " row__amount--expense"}`}
                      >
                        {rule.type === "income" ? "+" : "−"}
                        {formatMoney(rule.amount, currency)}
                      </span>
                      <span className="rule__tools">
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => togglePause(rule)}
                          aria-label={rule.paused ? "Resume" : "Pause"}
                        >
                          <Icon name={rule.paused ? "undo" : "close"} size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => setConfirmStop(rule)}
                          aria-label="Stop repeating"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {confirmStop && (
        <ConfirmDialog
          title="Stop repeating?"
          message={`No more entries will be created for ${confirmStop.note?.trim() || getCategory(confirmStop.categoryId).label}. Everything it has already saved stays untouched.`}
          confirmLabel="Stop"
          onCancel={() => setConfirmStop(null)}
          onConfirm={() => stop(confirmStop)}
        />
      )}
    </div>
  );
}
