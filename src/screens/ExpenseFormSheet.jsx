import { useEffect, useRef, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
import { PAYMENT_MODES, categoriesFor, defaultCategoryFor } from "../lib/categories.js";
import { shortDayLabel, todayKey, toKey } from "../lib/dates.js";
import { formatMoney, parseAmount } from "../lib/money.js";

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toKey(d);
}

/**
 * Add / edit sheet. `entry` null means "add"; otherwise the fields are prefilled
 * and a Delete button appears in the footer.
 *
 * The amount uses the phone's own numeric keyboard (inputMode="decimal") and is
 * focused on open, so the keyboard is already up and the first tap is a digit.
 */
export default function ExpenseFormSheet({ expense, currency, onSave, onDelete, onClose }) {
  const editing = Boolean(expense);

  const [type, setType] = useState(expense?.type ?? "expense");
  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : "");
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? defaultCategoryFor("expense"),
  );
  const [date, setDate] = useState(expense?.date ?? todayKey());
  const [note, setNote] = useState(expense?.note ?? "");
  const [paymentMode, setPaymentMode] = useState(expense?.paymentMode ?? "cash");

  const amountRef = useRef(null);
  const value = parseAmount(amountText);
  const valid = value !== null && value > 0;
  const income = type === "income";

  /* Open the numeric keyboard straight away when adding — the amount is the point. */
  useEffect(() => {
    if (editing) return undefined;
    const t = setTimeout(() => amountRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [editing]);

  /* Switching type swaps the whole category set, so the old pick cannot survive. */
  const switchType = (next) => {
    if (next === type) return;
    setType(next);
    setCategoryId(defaultCategoryFor(next));
  };

  const submit = (close) => {
    if (!valid) return;
    onSave({ type, amount: value, categoryId, date, note: note.trim(), paymentMode });
    close();
  };

  const today = todayKey();
  const yesterday = yesterdayKey();
  const noun = income ? "income" : "expense";

  return (
    <Sheet
      title={`${editing ? "Edit" : "Add"} ${noun}`}
      onClose={onClose}
      footer={({ close }) => (
        <>
          {editing && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onDelete(expense);
                close();
              }}
              aria-label={`Delete ${noun}`}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button
            type="button"
            className={`btn btn--lg grow ${income ? "btn--income" : "btn--primary"}`}
            disabled={!valid}
            onClick={() => submit(close)}
          >
            {editing ? "Save changes" : `Add ${noun}`}
          </button>
        </>
      )}
    >
      {({ close }) => (
        <>
          {/* Expense / Income */}
          <div className="seg seg--type">
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

          {/* Amount — a labelled row, the way Money Manager lays the form out */}
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
              onKeyDown={(e) => e.key === "Enter" && valid && submit(close)}
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
            <div className="seg">
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
        </>
      )}
    </Sheet>
  );
}
