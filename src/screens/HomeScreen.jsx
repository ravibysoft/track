import { useMemo } from "react";
import AnimatedAmount from "../components/AnimatedAmount.jsx";
import BudgetBar from "../components/BudgetBar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ExpenseRow from "../components/ExpenseRow.jsx";
import Icon from "../components/Icon.jsx";
import InstallCard from "../components/InstallCard.jsx";
import * as db from "../lib/db.js";
import { currentMonthKey, fullDayLabel, todayKey, weekRange } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

export default function HomeScreen({ install, onAdd, onEdit, onDelete, onOpenSettings }) {
  const { expenses, settings, currency } = useExpenses();

  const stats = useMemo(() => {
    const today = todayKey();
    const week = weekRange(today);
    const month = currentMonthKey();
    const todayItems = db.sortExpenses(db.onDay(expenses, today));
    const monthItems = db.inMonth(expenses, month);
    return {
      today,
      todayItems,
      todayTotal: db.total(todayItems),
      weekTotal: db.total(db.betweenDays(expenses, week.start, week.end)),
      monthTotal: db.total(monthItems),
      monthCount: monthItems.length,
    };
  }, [expenses]);

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">Today</h1>
          <p className="appbar__sub">{fullDayLabel(stats.today)}</p>
        </div>
      </header>

      <section className="hero card">
        <span className="hero__label">Spent today</span>
        <AnimatedAmount className="hero__amount" value={stats.todayTotal} currency={currency} />
        <span className="hero__meta">
          {stats.todayItems.length === 0
            ? "Nothing logged yet"
            : `${stats.todayItems.length} ${stats.todayItems.length === 1 ? "expense" : "expenses"} today`}
        </span>
      </section>

      <div className="tiles">
        <div className="tile card">
          <span className="tile__label">This week</span>
          <span className="tile__value num">{formatMoney(stats.weekTotal, currency)}</span>
        </div>
        <div className="tile card">
          <span className="tile__label">This month</span>
          <span className="tile__value num">{formatMoney(stats.monthTotal, currency)}</span>
        </div>
      </div>

      <div style={{ marginTop: "var(--sp-3)" }}>
        <BudgetBar
          spent={stats.monthTotal}
          budget={settings.monthlyBudget}
          currency={currency}
          onSetBudget={onOpenSettings}
        />
      </div>

      {install?.canInstall && (
        <div style={{ marginTop: "var(--sp-3)" }}>
          <InstallCard onInstall={install.promptInstall} />
        </div>
      )}

      <h2 className="section-title">
        <span>Today's expenses</span>
        {stats.todayItems.length > 0 && (
          <span className="num">{formatMoney(stats.todayTotal, currency)}</span>
        )}
      </h2>

      {stats.todayItems.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="wallet"
            title="No expenses today"
            text="Tap the + button to log what you spent. It stays on this phone."
            action={
              <button type="button" className="btn btn--primary" onClick={onAdd}>
                <Icon name="plus" size={18} />
                Add expense
              </button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <ul className="list">
            {stats.todayItems.map((expense, i) => (
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
      )}
    </div>
  );
}
