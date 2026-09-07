import { formatMoney } from "../lib/money.js";

/**
 * The Income / Expenses / Total strip that sits under the tabs on every period
 * view — the one thing Money Manager keeps on screen no matter which tab you are on.
 */
export default function SummaryBar({ totals, currency }) {
  return (
    <div className="summary-bar">
      <div className="summary-bar__col">
        <span className="summary-bar__label">Income</span>
        <span className="summary-bar__value summary-bar__value--income num">
          {formatMoney(totals.income, currency)}
        </span>
      </div>
      <div className="summary-bar__col">
        <span className="summary-bar__label">Expenses</span>
        <span className="summary-bar__value summary-bar__value--expense num">
          {formatMoney(totals.expense, currency)}
        </span>
      </div>
      <div className="summary-bar__col">
        <span className="summary-bar__label">Total</span>
        <span
          className={`summary-bar__value num${totals.net < 0 ? " summary-bar__value--expense" : ""}`}
        >
          {formatMoney(totals.net, currency)}
        </span>
      </div>
    </div>
  );
}
