import { useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import Icon from "../components/Icon.jsx";
import Keypad from "../components/Keypad.jsx";
import Sheet from "../components/Sheet.jsx";
import { PAYMENT_MODES, categoriesFor, defaultCategoryFor } from "../lib/categories.js";
import * as calc from "../lib/calc.js";
import { shortDayLabel, todayKey, toKey } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toKey(d);
}

/**
 * Add / edit sheet. `entry` null means "add"; otherwise the fields are prefilled
 * and a Delete button appears in the footer.
 *
 * The amount is driven by the keypad rather than an <input>, so the system
 * keyboard never opens and the sheet never resizes underneath you.
 */
export default function ExpenseFormSheet({ expense, currency, onSave, onDelete, onClose }) {
  const editing = Boolean(expense);

  const [type, setType] = useState(expense?.type ?? "expense");
  const [amount, setAmount] = useState(() =>
    expense ? calc.fromAmount(expense.amount) : calc.emptyCalc(),
  );
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? defaultCategoryFor("expense"),
  );
  const [date, setDate] = useState(expense?.date ?? todayKey());
  const [note, setNote] = useState(expense?.note ?? "");
  const [paymentMode, setPaymentMode] = useState(expense?.paymentMode ?? "cash");

  const value = calc.calcValue(amount);
  const valid = value !== null && value > 0;
  const pending = calc.isPending(amount);
  const income = type === "income";

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
          {/* While an operator is waiting, the primary button resolves the sum
              instead of saving — one button, no separate "=" key to hunt for. */}
          {pending ? (
            <button
              type="button"
              className="btn btn--primary btn--lg grow"
              onClick={() => setAmount(calc.pressEquals(amount))}
            >
              <Icon name="equals" size={18} />
              Equals
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn--lg grow ${income ? "btn--income" : "btn--primary"}`}
              disabled={!valid}
              onClick={() => submit(close)}
            >
              {editing ? "Save changes" : `Add ${noun}`}
            </button>
          )}
        </>
      )}
    >
      {() => (
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

          {/* Amount */}
          <div className={`amount-display${income ? " amount-display--income" : ""}`}>
            <span className="amount-display__pending num">{calc.pendingText(amount)}</span>
            <span className="amount-display__row">
              {/* Hidden mid-calculation: a "−" beside 80 while adding 250 + 80 reads
                  as "minus 80" rather than "this is an expense". */}
              {!pending && <span className="amount-display__sign">{income ? "+" : "−"}</span>}
              <span className="amount-display__symbol">{currency}</span>
              <span className="amount-display__value num">{calc.displayText(amount)}</span>
            </span>
          </div>

          <Keypad
            activeOperator={amount.entry === "" ? amount.op : null}
            onDigit={(d) => setAmount(calc.pressDigit(amount, d))}
            onDot={() => setAmount(calc.pressDot(amount))}
            onOperator={(op) => setAmount(calc.pressOperator(amount, op))}
            onBackspace={() => setAmount(calc.pressBackspace(amount))}
          />

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

          {/* Date */}
          <div className="field">
            <span className="field__label">Date</span>
            <div className="hstack" style={{ gap: "var(--sp-2)" }}>
              <button
                type="button"
                className="chip"
                aria-pressed={date === today}
                onClick={() => setDate(today)}
              >
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
              <label className="date-field grow">
                <Icon name="calendar" size={16} />
                <span className="grow">{shortDayLabel(date)}</span>
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  aria-label="Pick a date"
                />
              </label>
            </div>
          </div>

          {/* Note */}
          <div className="field">
            <span className="field__label">Note (optional)</span>
            <input
              className="input"
              type="text"
              placeholder={income ? "August salary" : "Lunch at office"}
              value={note}
              maxLength={120}
              enterKeyHint="done"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Payment mode */}
          <div className="field">
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
            <p className="amount-echo num">{formatMoney(value, currency)}</p>
          )}
        </>
      )}
    </Sheet>
  );
}
