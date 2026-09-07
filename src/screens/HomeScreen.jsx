import { useMemo } from "react";
import ExpenseRow from "../components/ExpenseRow.jsx";
import Icon from "../components/Icon.jsx";
import InstallCard from "../components/InstallCard.jsx";
import * as db from "../lib/db.js";
import { currentMonthKey, dayLabel, monthLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

/** Greets by the clock, and the icon beside the headline follows it. */
function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return { greeting: "Good morning", icon: "sun" };
  if (h < 17) return { greeting: "Good afternoon", icon: "sun" };
  return { greeting: "Good evening", icon: "moon" };
}

export default function HomeScreen({ install, onAdd, onAddIncome, onEdit, onDelete, onSeeAll, onOpenSettings }) {
  const { expenses, settings, currency } = useExpenses();
  const month = currentMonthKey();
  const { greeting, icon } = timeOfDay();

  const stats = useMemo(() => {
    const items = db.inMonth(expenses, month);
    return {
      ...db.totals(items),
      latest: db.sortExpenses(expenses).slice(0, 5),
    };
  }, [expenses, month]);

  const budget = settings.monthlyBudget;
  const usedShare = budget > 0 ? Math.min(stats.expense / budget, 1) : 0;
  const overBudget = budget > 0 && stats.expense > budget;

  return (
    <div className="screen home">
      <header className="home__bar">
        <span className="home__badge">{currency}</span>
        <span className="grow">
          <span className="home__greeting">{greeting}</span>
          <span className="home__app">Roz Kharcha</span>
        </span>
        <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <Icon name="settings" />
        </button>
      </header>

      <p className="home__eyebrow">Your money, your way</p>
      <div className="home__headline">
        <h1>Here&rsquo;s your day at a glance.</h1>
        <span className={`home__sun home__sun--${icon}`}>
          <Icon name={icon} />
        </span>
      </div>

      {/* The month at a glance, on the dark card from the design */}
      <section className="balance">
        <div className="balance__head">
          <span>This month</span>
          <button type="button" className="balance__month" onClick={onSeeAll}>
            {monthLabel(month)}
            <Icon name="right" size={14} />
          </button>
        </div>

        <span className="balance__label">Available balance</span>
        <span className="balance__value num">{formatMoney(stats.net, currency)}</span>

        <div className="balance__split">
          <span className="balance__stat">
            <Icon name="arrow-in" size={14} />
            <span className="balance__statLabel">Income</span>
            <span className="balance__statValue balance__statValue--in num">
              {formatMoney(stats.income, currency)}
            </span>
          </span>
          <span className="balance__stat">
            <Icon name="arrow-out" size={14} />
            <span className="balance__statLabel">Spent</span>
            <span className="balance__statValue num">{formatMoney(stats.expense, currency)}</span>
          </span>
        </div>

        <div className="balance__track">
          <div
            className={`balance__fill${overBudget ? " is-over" : ""}`}
            style={{ width: `${Math.max(usedShare * 100, budget > 0 ? 2 : 0)}%` }}
          />
        </div>
        <div className="balance__foot">
          <span>Monthly budget</span>
          <button type="button" className="balance__budget num" onClick={onOpenSettings}>
            {budget > 0 ? formatMoney(budget, currency) : "Set a budget"}
          </button>
        </div>
      </section>

      <div className="home__actions">
        <button type="button" className="btn btn--primary btn--lg grow" onClick={onAdd}>
          <Icon name="plus" size={18} />
          Add expense
        </button>
        <button type="button" className="btn btn--ghost btn--lg grow" onClick={onAddIncome}>
          <Icon name="arrow-in" size={18} />
          Add income
        </button>
      </div>

      {install?.canInstall && <InstallCard onInstall={install.promptInstall} />}

      <div className="home__section">
        <span className="home__eyebrow">Recent activity</span>
        <div className="home__sectionHead">
          <h2>Latest entries</h2>
          <button type="button" className="home__seeAll" onClick={onSeeAll}>
            See all
            <Icon name="right" size={14} />
          </button>
        </div>
      </div>

      {stats.latest.length === 0 ? (
        <p className="home__empty">Nothing yet. Add your first entry with the button above.</p>
      ) : (
        <div className="card card--flat">
          <ul className="list">
            {stats.latest.map((entry, i) => (
              <li
                key={entry.id}
                className="row-item"
                style={{ animationDelay: `${Math.min(i, 6) * 20}ms` }}
              >
                {i > 0 && <div className="list__sep" />}
                <ExpenseRow
                  expense={entry}
                  currency={currency}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  trailing={dayLabel(entry.date)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
