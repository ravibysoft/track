import { useMemo, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ExpenseRow from "../components/ExpenseRow.jsx";
import Icon from "../components/Icon.jsx";
import MonthCalendar from "../components/MonthCalendar.jsx";
import MonthPicker from "../components/MonthPicker.jsx";
import { EXPENSE_CATEGORIES, getCategory } from "../lib/categories.js";
import * as db from "../lib/db.js";
import { currentMonthKey, dayLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

const labelOf = (id) => getCategory(id).label;

export default function HistoryScreen({ onEdit, onDelete }) {
  const { expenses, currency } = useExpenses();

  const [view, setView] = useState("list"); // "list" | "calendar"
  const [scope, setScope] = useState("month"); // "month" | "all"
  const [month, setMonth] = useState(currentMonthKey);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  /* The calendar is inherently one month, so it pins the scope to that month. */
  const calendar = view === "calendar";
  const monthItems = useMemo(() => db.inMonth(expenses, month), [expenses, month]);

  const { groups, periodTotals } = useMemo(() => {
    let list = calendar || scope === "month" ? monthItems : expenses;
    if (calendar && selectedDay) list = list.filter((e) => e.date === selectedDay);
    if (categoryId) list = list.filter((e) => e.categoryId === categoryId);
    list = db.search(list, query, labelOf);
    return { groups: db.groupByDay(list), periodTotals: db.totals(list) };
  }, [expenses, monthItems, calendar, scope, selectedDay, categoryId, query]);

  const dayTotals = useMemo(() => db.dayTotalsMap(monthItems), [monthItems]);
  const entryCount = groups.reduce((n, g) => n + g.items.length, 0);
  const hasAny = expenses.length > 0;

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">History</h1>
          <p className="appbar__sub">
            {entryCount} {entryCount === 1 ? "entry" : "entries"} ·{" "}
            <span className="num">{formatMoney(periodTotals.expense, currency)}</span> spent
            {periodTotals.income > 0 && (
              <>
                {" · "}
                <span className="num ledger__value--income">
                  {formatMoney(periodTotals.income, currency)}
                </span>{" "}
                in
              </>
            )}
          </p>
        </div>
      </header>

      <div className="seg">
        <button
          type="button"
          className={`seg__btn${!calendar && scope === "month" ? " is-active" : ""}`}
          onClick={() => {
            setView("list");
            setScope("month");
          }}
        >
          <Icon name="history" size={15} />
          Month
        </button>
        <button
          type="button"
          className={`seg__btn${calendar ? " is-active" : ""}`}
          onClick={() => setView("calendar")}
        >
          <Icon name="calendar_grid" size={15} />
          Calendar
        </button>
        <button
          type="button"
          className={`seg__btn${!calendar && scope === "all" ? " is-active" : ""}`}
          onClick={() => {
            setView("list");
            setScope("all");
          }}
        >
          All time
        </button>
      </div>

      {(calendar || scope === "month") && (
        <MonthPicker
          value={month}
          onChange={(next) => {
            setMonth(next);
            setSelectedDay(null);
          }}
        />
      )}

      {calendar && (
        <MonthCalendar
          monthKey={month}
          totals={dayTotals}
          currency={currency}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}

      <label className="search-bar">
        <Icon name="search" size={17} />
        <input
          className="grow"
          type="search"
          placeholder="Search note, amount or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search entries"
        />
        {query && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
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
        {EXPENSE_CATEGORIES.map((c) => (
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
        <div className="card">
          <EmptyState
            icon={hasAny ? "search" : "wallet"}
            title={
              calendar && selectedDay
                ? "Nothing on this day"
                : hasAny
                  ? "Nothing matches"
                  : "No history yet"
            }
            text={
              hasAny
                ? "Try another month, clear the search, or pick a different category."
                : "Every entry you add shows up here, grouped day by day."
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.day}>
            <div className="day-head">
              <span className="day-head__label">{dayLabel(group.day)}</span>
              <span className="day-head__totals">
                {group.income > 0 && (
                  <span className="day-head__total ledger__value--income num">
                    +{formatMoney(group.income, currency)}
                  </span>
                )}
                {group.expense > 0 && (
                  <span className="day-head__total num">{formatMoney(group.expense, currency)}</span>
                )}
              </span>
            </div>
            <div className="card">
              <ul className="list">
                {group.items.map((expense, i) => (
                  <li
                    key={expense.id}
                    className="row-item"
                    style={{ animationDelay: `${Math.min(i, 6) * 20}ms` }}
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
