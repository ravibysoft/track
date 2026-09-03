import { useEffect, useRef, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
import { CATEGORIES, DEFAULT_CATEGORY, PAYMENT_MODES } from "../lib/categories.js";
import { dayLabel, todayKey, toKey } from "../lib/dates.js";
import { formatMoney, parseAmount } from "../lib/money.js";

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toKey(d);
}

/**
 * Add / edit sheet. `expense` null means "add"; otherwise the fields are prefilled
 * and a Delete button appears in the footer.
 */
export default function ExpenseFormSheet({ expense, currency, onSave, onDelete, onClose }) {
  const editing = Boolean(expense);

  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : "");
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? DEFAULT_CATEGORY);
  const [date, setDate] = useState(expense?.date ?? todayKey());
  const [note, setNote] = useState(expense?.note ?? "");
  const [paymentMode, setPaymentMode] = useState(expense?.paymentMode ?? "cash");

  const amountRef = useRef(null);
  const amount = parseAmount(amountText);
  const valid = amount !== null && amount > 0;

  /* Open the numeric keypad straight away when adding — the amount is the point. */
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => amountRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [editing]);

  const submit = (close) => {
    if (!valid) return;
    onSave({ amount, categoryId, date, note: note.trim(), paymentMode });
    close();
  };

  const today = todayKey();
  const yesterday = yesterdayKey();

  return (
    <Sheet
      title={editing ? "Edit expense" : "Add expense"}
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
              aria-label="Delete expense"
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--lg grow"
            disabled={!valid}
            onClick={() => submit(close)}
          >
            {editing ? "Save changes" : "Add expense"}
          </button>
        </>
      )}
    >
      {({ close }) => (
        <>
          {/* Amount */}
          <div className="amount-input">
            <span className="amount-input__symbol">{currency}</span>
            <input
              ref={amountRef}
              className="amount-input__field num"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0"
              value={amountText}
              maxLength={12}
              onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submit(close)}
              aria-label="Amount"
            />
          </div>
          {valid && amount >= 1000 && (
            <p className="amount-input__echo num">{formatMoney(amount, currency)}</p>
          )}

          {/* Category */}
          <div className="field" style={{ marginTop: "var(--sp-5)" }}>
            <span className="field__label">Category</span>
            <div className="cat-grid">
              {CATEGORIES.map((c) => (
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
                <span className="grow">{dayLabel(date)}</span>
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
              placeholder="Lunch at office"
              value={note}
              maxLength={120}
              enterKeyHint="done"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(close)}
            />
          </div>

          {/* Payment mode */}
          <div className="field">
            <span className="field__label">Paid by</span>
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
        </>
      )}
    </Sheet>
  );
}
