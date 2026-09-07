import { useRef } from "react";
import { getCategory, getPaymentLabel } from "../lib/categories.js";
import { formatMoney } from "../lib/money.js";
import CategoryIcon from "./CategoryIcon.jsx";

const LONG_PRESS_MS = 500;

/**
 * One expense line. Tap opens the edit sheet; a long press jumps straight to
 * delete, which is the gesture people expect on Android list rows.
 */
export default function ExpenseRow({ expense, currency, onEdit, onDelete, trailing }) {
  const timer = useRef(null);
  const longPressed = useRef(false);
  const origin = useRef({ x: 0, y: 0 });

  const income = expense.type === "income";
  const category = getCategory(expense.categoryId);
  const title = expense.note?.trim() || category.label;
  /* The title already carries the note (or the category), so the meta line shows
     whatever is left: the category when a note took the title, then how it was paid. */
  const meta = [
    expense.note?.trim() ? category.label : null,
    getPaymentLabel(expense.paymentMode),
  ].filter(Boolean);

  const startPress = (e) => {
    longPressed.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onDelete?.(expense);
    }, LONG_PRESS_MS);
  };

  const endPress = () => clearTimeout(timer.current);

  /* A finger that travels is scrolling the list, not holding the row. Without this
     a long scroll that starts on a row would delete it. */
  const movePress = (e) => {
    const { x, y } = origin.current;
    if (Math.abs(e.clientX - x) > 8 || Math.abs(e.clientY - y) > 8) endPress();
  };

  return (
    <button
      type="button"
      className="row"
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerMove={movePress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (longPressed.current) return; // the long press already acted
        onEdit?.(expense);
      }}
    >
      <CategoryIcon id={expense.categoryId} />
      <span className="row__body">
        <span className="row__title">{title}</span>
        <span className="row__meta">
          {meta.map((m, i) => (
            <span key={m} className={i > 0 ? "dot" : undefined}>
              {m}
            </span>
          ))}
        </span>
      </span>
      {/* Signed and coloured, per the redesign: income reads +green, spending
          -red, so a mixed list is scannable without reading the category. */}
      <span className="row__trail">
        <span className={`row__amount num${income ? " row__amount--income" : " row__amount--expense"}`}>
          {income ? "+" : "−"}
          {formatMoney(expense.amount, currency)}
        </span>
        {trailing && <span className="row__when">{trailing}</span>}
      </span>
    </button>
  );
}
