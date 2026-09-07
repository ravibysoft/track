import { useCallback, useEffect, useRef, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import Icon from "../components/Icon.jsx";
import { PAYMENT_MODES, categoriesFor, defaultCategoryFor } from "../lib/categories.js";
import { shortDayLabel, todayKey, toKey } from "../lib/dates.js";
import { formatMoney, parseAmount } from "../lib/money.js";

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toKey(d);
}

/**
 * Add / edit screen. A full page rather than a bottom sheet: it pushes in from the
 * right over the tab bar, the way a native screen does, so the whole form has room
 * and nothing is squeezed into a panel.
 *
 * `expense` null means "add"; otherwise the fields are prefilled and Delete appears.
 */
export default function ExpenseFormPage({ expense, currency, onSave, onDelete, onClose }) {
  const editing = Boolean(expense);

  const [type, setType] = useState(expense?.type ?? "expense");
  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : "");
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? defaultCategoryFor("expense"),
  );
  const [date, setDate] = useState(expense?.date ?? todayKey());
  const [note, setNote] = useState(expense?.note ?? "");
  const [paymentMode, setPaymentMode] = useState(expense?.paymentMode ?? "cash");
  const [closing, setClosing] = useState(false);

  const amountRef = useRef(null);
  const value = parseAmount(amountText);
  const valid = value !== null && value > 0;
  const income = type === "income";
  const noun = income ? "income" : "expense";

  /* Plays the slide-out before handing control back, like the sheet used to. */
  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(onClose, 200);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  /* Open the numeric keyboard straight away when adding — the amount is the point. */
  useEffect(() => {
    if (editing) return undefined;
    const t = setTimeout(() => amountRef.current?.focus(), 280);
    return () => clearTimeout(t);
  }, [editing]);

  /* The page covers the app, so stop what is behind it from scrolling too. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const switchType = (next) => {
    if (next === type) return;
    setType(next);
    setCategoryId(defaultCategoryFor(next));
  };

  const values = () => ({
    type,
    amount: value,
    categoryId,
    date,
    note: note.trim(),
    paymentMode,
  });

  const save = () => {
    if (!valid) return;
    onSave(values());
    close();
  };

  /**
   * Save and stay put for the next entry — the category, date and payment mode are
   * usually the same for a run of entries, so only the amount and note are cleared.
   */
  const saveAndContinue = () => {
    if (!valid) return;
    onSave(values());
    setAmountText("");
    setNote("");
    amountRef.current?.focus();
  };

  const today = todayKey();
  const yesterday = yesterdayKey();

  return (
    <div className={`page${closing ? " is-closing" : ""}`} role="dialog" aria-label={`${editing ? "Edit" : "Add"} ${noun}`}>
      <header className="page__bar">
        <button type="button" className="icon-btn" onClick={close} aria-label="Back">
          <Icon name="left" />
        </button>
        <h1 className="page__title">
          {editing ? "Edit" : "Add"} {noun}
        </h1>
        {editing && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              onDelete(expense);
              close();
            }}
            aria-label={`Delete ${noun}`}
          >
            <Icon name="trash" />
          </button>
        )}
      </header>

      <div className="page__body">
        {/* Expense / Income */}
        <div className="seg seg--type" style={{ "--seg-index": income ? 1 : 0, "--seg-count": 2 }}>
          <button
            type="button"
            className={`seg__btn${!income ? " is-active" : ""}`}
            onClick={() => switchType("expense")}
            aria-pressed={!income}
          >
            Expense
          </button>
          <button
            type="button"
            className={`seg__btn seg__btn--income${income ? " is-active" : ""}`}
            onClick={() => switchType("income")}
            aria-pressed={income}
          >
            Income
          </button>
        </div>

        {/* Amount */}
        <div className={`form-row form-row--amount${income ? " is-income" : ""}`}>
          <span className="form-row__label">Amount</span>
          <span className="form-row__symbol">
            {income ? "+" : "−"}
            {currency}
          </span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="0"
            value={amountText}
            maxLength={12}
            className="num"
            onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            aria-label="Amount"
          />
        </div>

        {/* Date */}
        <label className="form-row date-row">
          <span className="form-row__label">Date</span>
          <span className="form-row__value">{shortDayLabel(date)}</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Pick a date"
          />
        </label>

        <div className="hstack" style={{ gap: "var(--sp-2)", padding: "var(--sp-3) 0" }}>
          <button type="button" className="chip" aria-pressed={date === today} onClick={() => setDate(today)}>
            Today
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={date === yesterday}
            onClick={() => setDate(yesterday)}
          >
            Yesterday
          </button>
        </div>

        {/* Category */}
        <div className="field">
          <span className="field__label">Category</span>
          <div className="cat-grid">
            {categoriesFor(type).map((c) => (
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

        {/* Note */}
        <div className="form-row">
          <span className="form-row__label">Note</span>
          <input
            type="text"
            placeholder={income ? "August salary" : "Lunch at office"}
            value={note}
            maxLength={120}
            enterKeyHint="done"
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note"
          />
        </div>

        {/* Payment mode */}
        <div className="field" style={{ marginTop: "var(--sp-5)" }}>
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

        {valid && value >= 1000 && (
          <p className="amount-input__echo num">{formatMoney(value, currency)}</p>
        )}
      </div>

      <div className="page__foot">
        <button
          type="button"
          className={`btn btn--lg grow ${income ? "btn--income" : "btn--primary"}`}
          disabled={!valid}
          onClick={save}
        >
          {editing ? "Save changes" : "Save"}
        </button>
        {!editing && (
          <button
            type="button"
            className="btn btn--lg btn--ghost"
            disabled={!valid}
            onClick={saveAndContinue}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
