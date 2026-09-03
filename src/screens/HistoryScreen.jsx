import { useMemo, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ExpenseRow from "../components/ExpenseRow.jsx";
import Icon from "../components/Icon.jsx";
import MonthPicker from "../components/MonthPicker.jsx";
import { CATEGORIES, getCategory } from "../lib/categories.js";
import * as db from "../lib/db.js";
import { currentMonthKey, dayLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

const labelOf = (id) => getCategory(id).label;

export default function HistoryScreen({ onEdit, onDelete }) {
  const { expenses, currency } = useExpenses();

  const [scope, setScope] = useState("month"); // "month" | "all"
  const [month, setMonth] = useState(currentMonthKey);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(null);

  const { groups, filteredTotal, filteredCount } = useMemo(() => {
    let list = scope === "month" ? db.inMonth(expenses, month) : expenses;
    if (categoryId) list = list.filter((e) => e.categoryId === categoryId);
    list = db.search(list, query, labelOf);
    return {
      groups: db.groupByDay(list),
      filteredTotal: db.total(list),
      filteredCount: list.length,
    };
  }, [expenses, scope, month, categoryId, query]);

  const hasAny = expenses.length > 0;

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">History</h1>
          <p className="appbar__sub">
            {filteredCount} {filteredCount === 1 ? "expense" : "expenses"} ·{" "}
            <span className="num">{formatMoney(filteredTotal, currency)}</span>
          </p>
        </div>
      </header>

      <div className="seg seg--sm">
        <button
          type="button"
          className={`seg__btn${scope === "month" ? " is-active" : ""}`}
          onClick={() => setScope("month")}
        >
          By month
        </button>
        <button
          type="button"
          className={`seg__btn${scope === "all" ? " is-active" : ""}`}
          onClick={() => setScope("all")}
        >
          All time
        </button>
      </div>

      {scope === "month" && (
        <div style={{ marginTop: "var(--sp-3)" }}>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      )}

      <label className="search-bar">
        <Icon name="search" size={17} />
        <input
          className="grow"
          type="search"
          placeholder="Search note, amount or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search expenses"
        />
        {query && (
          <button type="button" className="icon-btn" onClick={() => setQuery("")} aria-label="Clear search">
            <Icon name="close" />
          </button>
        )}
      </label>

      <div className="chip-row">
        <button
          type="button"
          className="chip"
          aria-pressed={categoryId === null}
          onClick={() => setCategoryId(null)}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip"
            aria-pressed={categoryId === c.id}
            onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
          >
            <CategoryIcon id={c.id} size="sm" />
            {c.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card" style={{ marginTop: "var(--sp-4)" }}>
          <EmptyState
            icon={hasAny ? "search" : "wallet"}
            title={hasAny ? "Nothing matches" : "No history yet"}
            text={
              hasAny
                ? "Try another month, clear the search, or pick a different category."
                : "Every expense you add shows up here, grouped day by day."
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.day}>
            <div className="day-head">
              <span className="day-head__label">{dayLabel(group.day)}</span>
              <span className="day-head__total num">{formatMoney(group.total, currency)}</span>
            </div>
            <div className="card">
              <ul className="list">
                {group.items.map((expense, i) => (
                  <li
                    key={expense.id}
                    className="row-item"
                    style={{ animationDelay: `${Math.min(i, 8) * 32}ms` }}
                  >
                    {i > 0 && <div className="list__sep" />}
                    <ExpenseRow
                      expense={expense}
                      currency={currency}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
