import { useMemo, useState } from "react";
import CategoryIcon from "../components/CategoryIcon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ExpenseRow from "../components/ExpenseRow.jsx";
import Icon from "../components/Icon.jsx";
import MonthCalendar from "../components/MonthCalendar.jsx";
import SummaryBar from "../components/SummaryBar.jsx";
import { EXPENSE_CATEGORIES, getCategory } from "../lib/categories.js";
import * as db from "../lib/db.js";
import {
  currentMonthKey,
  currentYear,
  dayLabel,
  monthLabel,
  monthRange,
  shiftMonth,
  shiftYear,
  yearMonths,
} from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

const TABS = [
  { id: "daily", label: "Daily" },
  { id: "calendar", label: "Calendar" },
  { id: "monthly", label: "Monthly" },
  { id: "total", label: "Total" },
];

const labelOf = (id) => getCategory(id).label;

export default function HistoryScreen({ onEdit, onDelete }) {
  const { expenses, settings, currency } = useExpenses();

  const [tab, setTab] = useState("daily");
  const [month, setMonth] = useState(currentMonthKey);
  const [year, setYear] = useState(currentYear);
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [categoryId, setCategoryId] = useState(null);

  /* Monthly lists a whole year; the other tabs work a single month. */
  const yearly = tab === "monthly";

  const monthItems = useMemo(() => db.inMonth(expenses, month), [expenses, month]);
  const yearItems = useMemo(
    () => db.betweenDays(expenses, `${year}-01-01`, `${year}-12-31`),
    [expenses, year],
  );

  const periodItems = yearly ? yearItems : monthItems;
  const summary = useMemo(() => db.totals(periodItems), [periodItems]);

  /* Daily is the only tab that filters, so its list is derived separately. */
  const dailyGroups = useMemo(() => {
    let list = monthItems;
    if (selectedDay) list = list.filter((e) => e.date === selectedDay);
    if (categoryId) list = list.filter((e) => e.categoryId === categoryId);
    return db.groupByDay(db.search(list, query, labelOf));
  }, [monthItems, selectedDay, categoryId, query]);

  const dayTotals = useMemo(() => db.dayTotalsMap(monthItems), [monthItems]);

  const months = useMemo(
    () =>
      yearMonths(year).map((key) => {
        const items = db.inMonth(expenses, key);
        return { key, label: monthLabel(key).split(" ")[0], ...db.totals(items) };
      }),
    [expenses, year],
  );

  const step = (delta) =>
    yearly ? setYear((y) => shiftYear(y, delta)) : setMonth((m) => shiftMonth(m, delta));

  /* Spelled out rather than spreading Object.values(range) — that would silently
     depend on key order. */
  const previousSpent = useMemo(() => {
    const previous = monthRange(shiftMonth(month, -1));
    return db.spent(db.betweenDays(expenses, previous.start, previous.end));
  }, [expenses, month]);

  const atLatest = yearly ? year >= currentYear() : month >= currentMonthKey();
  const periodLabel = yearly ? year : monthLabel(month);

  return (
    <div className="screen">
      {/* Period bar — the month (or the year, on Monthly) */}
      <header className="period-bar">
        <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
          <Icon name="left" />
        </button>
        <span className="period-bar__label">{periodLabel}</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => step(1)}
          disabled={atLatest}
          style={atLatest ? { opacity: 0.35, pointerEvents: "none" } : undefined}
          aria-label="Next"
        >
          <Icon name="right" />
        </button>
      </header>

      {/* Daily / Calendar / Monthly / Total */}
      <nav className="tabstrip">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tabstrip__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => {
              setTab(t.id);
              setSelectedDay(null);
            }}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <SummaryBar totals={summary} currency={currency} />

      {tab === "daily" && (
        <>
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

          {dailyGroups.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="wallet"
                title="No data available"
                text={
                  expenses.length
                    ? "Nothing in this month matches. Try another month or clear the search."
                    : "Everything you add shows up here, grouped day by day."
                }
              />
            </div>
          ) : (
            dailyGroups.map((group) => (
              <section key={group.day}>
                <div className="day-head">
                  <span className="day-head__label">{dayLabel(group.day)}</span>
                  <span className="day-head__totals">
                    {group.income > 0 && (
                      <span className="day-head__total ledger__value--income num">
                        {formatMoney(group.income, currency)}
                      </span>
                    )}
                    {group.expense > 0 && (
                      <span className="day-head__total ledger__value--expense num">
                        {formatMoney(group.expense, currency)}
                      </span>
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
        </>
      )}

      {tab === "calendar" && (
        <>
          <MonthCalendar
            monthKey={month}
            totals={dayTotals}
            currency={currency}
            selectedDay={selectedDay}
            onSelectDay={(day) => {
              setSelectedDay(day);
              if (day) setTab("daily");
            }}
          />
          <p className="hint">Tap a day to see what it holds.</p>
        </>
      )}

      {tab === "monthly" && (
        <div className="card setting-list">
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              className="month-row"
              onClick={() => {
                setMonth(m.key);
                setTab("daily");
              }}
            >
              <span className="month-row__name">{m.label}</span>
              <span className="month-row__figures">
                <span className="month-row__income num">{formatMoney(m.income, currency)}</span>
                <span className="month-row__expense num">{formatMoney(m.expense, currency)}</span>
                <span className="month-row__net num">{formatMoney(m.net, currency)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === "total" && (
        <TotalTab
          items={periodItems}
          summary={summary}
          budget={settings.monthlyBudget}
          currency={currency}
          previousSpent={previousSpent}
        />
      )}
    </div>
  );
}

function TotalTab({ items, summary, budget, currency, previousSpent }) {
  const byMode = useMemo(() => {
    const map = new Map();
    for (const e of db.spending(items)) {
      map.set(e.paymentMode, (map.get(e.paymentMode) ?? 0) + e.amount);
    }
    return map;
  }, [items]);

  const compared = previousSpent > 0 ? Math.round((summary.expense / previousSpent) * 100) : null;

  return (
    <>
      <h2 className="section-title">Budget</h2>
      <div className="card card--pad stack">
        {budget > 0 ? (
          <>
            <div className="hstack">
              <span className="grow setting-row__hint">Monthly budget</span>
              <strong className="num">{formatMoney(budget, currency)}</strong>
            </div>
            <div className="hstack">
              <span className="grow setting-row__hint">Left to spend</span>
              <strong className={`num${budget - summary.expense < 0 ? " ledger__value--expense" : ""}`}>
                {formatMoney(budget - summary.expense, currency)}
              </strong>
            </div>
          </>
        ) : (
          <span className="setting-row__hint">No budget set — add one in Settings.</span>
        )}
      </div>

      <h2 className="section-title">This period</h2>
      <div className="card card--pad stack">
        {compared !== null && (
          <div className="hstack">
            <span className="grow setting-row__hint">Compared with last month</span>
            <strong className="num">{compared}%</strong>
          </div>
        )}
        <div className="hstack">
          <span className="grow setting-row__hint">Spent by cash</span>
          <strong className="num">{formatMoney(byMode.get("cash") ?? 0, currency)}</strong>
        </div>
        <div className="hstack">
          <span className="grow setting-row__hint">Spent by UPI</span>
          <strong className="num">{formatMoney(byMode.get("upi") ?? 0, currency)}</strong>
        </div>
        <div className="hstack">
          <span className="grow setting-row__hint">Spent by card</span>
          <strong className="num">{formatMoney(byMode.get("card") ?? 0, currency)}</strong>
        </div>
      </div>
    </>
  );
}
