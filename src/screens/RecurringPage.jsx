import { useCallback, useEffect, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
import {
  PAYMENT_MODES,
  categoriesFor,
  getCategory,
  getPaymentLabel,
} from "../lib/categories.js";
import { dayLabel } from "../lib/dates.js";
import { formatMoney, parseAmount } from "../lib/money.js";
import { FREQUENCIES, describeRule } from "../lib/recurring.js";
import { useExpenses } from "../state/useExpenses.js";

/**
 * The repeating rules: what they post, when they next post it, and how to
 * change, pause or stop them.
 *
 * Editing only ever changes what happens *next*. Entries a rule has already
 * posted are ordinary entries and are left exactly alone, so raising the rent
 * here does not quietly rewrite last year into having cost more — which is why
 * this can be a plain edit rather than stop-and-recreate.
 *
 * `nextDate` and `anchorDay` are deliberately not editable. They are the rule's
 * memory of where it has got to, and letting them be typed over is how you post
 * the rent twice.
 */
export default function RecurringPage({ onClose, onToast }) {
  const { rules, currency, saveRules } = useExpenses();

  const [editing, setEditing] = useState(null);
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

  const save = (draft) => {
    saveRules(rules.map((r) => (r.id === draft.id ? { ...r, ...draft } : r)));
    setEditing(null);
    onToast?.("Repeating entry updated");
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
              art="repeat"
              currency={currency}
              title="Nothing repeats yet"
              text="Rent, salary, an EMI — add the entry once and pick Every month, and it saves itself from then on."
            />
          </div>
        ) : (
          <>
            <p className="hint">
              Tap one to change what it posts. Entries already saved stay exactly
              as they are, whatever you do here.
            </p>

            <div className="card card--flat setting-list">
              {rules.map((rule, i) => {
                const category = getCategory(rule.categoryId);
                return (
                  <div key={rule.id} className={`rule${rule.paused ? " is-paused" : ""}`}>
                    {i > 0 && <div className="list__sep" />}

                    <CategoryIcon id={rule.categoryId} size="sm" />

                    <button
                      type="button"
                      className="grow rule__body"
                      onClick={() => setEditing(rule)}
                    >
                      <span className="rule__title">
                        {rule.note?.trim() || category.label}
                      </span>
                      <span className="rule__meta">
                        {describeRule(rule)} · {getPaymentLabel(rule.paymentMode)}
                      </span>
                      <span className="rule__next">
                        {rule.paused ? "Paused" : `Next ${dayLabel(rule.nextDate)}`}
                      </span>
                    </button>

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

      {editing && (
        <RuleEditor
          key={editing.id}
          rule={editing}
          currency={currency}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

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

function RuleEditor({ rule, currency, onSave, onClose }) {
  const [amountText, setAmountText] = useState(String(rule.amount));
  const [categoryId, setCategoryId] = useState(rule.categoryId);
  const [note, setNote] = useState(rule.note ?? "");
  const [paymentMode, setPaymentMode] = useState(rule.paymentMode);
  const [every, setEvery] = useState(rule.every);

  const amount = parseAmount(amountText);
  const valid = amount !== null && amount > 0;
  const income = rule.type === "income";

  return (
    <Sheet
      title={income ? "Repeating income" : "Repeating expense"}
      onClose={onClose}
      footer={({ close }) => (
        <button
          type="button"
          className={`btn btn--lg btn--block ${income ? "btn--income" : "btn--primary"}`}
          disabled={!valid}
          onClick={() => {
            onSave({ id: rule.id, amount, categoryId, note: note.trim(), paymentMode, every });
            close();
          }}
        >
          Save changes
        </button>
      )}
    >
      <div className="amount-input">
        <span className="amount-input__symbol">{currency}</span>
        <input
          className="amount-input__field num"
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amountText}
          maxLength={10}
          autoFocus
          aria-label="Amount"
          onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>

      <label className="field">
        <span className="field__label">Note</span>
        <input
          className="input"
          type="text"
          value={note}
          maxLength={120}
          placeholder={income ? "Monthly salary" : "House rent"}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field__label">Category</span>
        <div className="cat-grid">
          {categoriesFor(rule.type).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cat-option${categoryId === c.id ? " is-active" : ""}`}
              style={{ "--cat-color": c.color }}
              onClick={() => setCategoryId(c.id)}
              aria-pressed={categoryId === c.id}
            >
              <CategoryIcon id={c.id} />
              <span className="cat-option__label">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">{income ? "Received in" : "Paid by"}</span>
        <div
          className="seg"
          style={{
            "--seg-index": PAYMENT_MODES.findIndex((m) => m.id === paymentMode),
            "--seg-count": PAYMENT_MODES.length,
          }}
        >
          {PAYMENT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`seg__btn${paymentMode === m.id ? " is-active" : ""}`}
              onClick={() => setPaymentMode(m.id)}
              aria-pressed={paymentMode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Repeat</span>
        <div className="hstack" style={{ gap: "var(--sp-2)", flexWrap: "wrap" }}>
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={every === f.id}
              onClick={() => setEvery(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* The schedule itself is not editable: nextDate is how the rule knows
            what it has already posted, and typing over it posts the rent twice. */}
        <span className="field__hint">
          Next on {dayLabel(rule.nextDate).toLowerCase()}. Changes apply from then on —
          entries already saved are untouched.
        </span>
      </div>
    </Sheet>
  );
}
