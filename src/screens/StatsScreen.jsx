import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import CategoryIcon from "../components/CategoryIcon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Icon from "../components/Icon.jsx";
import MonthPicker from "../components/MonthPicker.jsx";
import useThemeColors from "../hooks/useThemeColors.js";
import { getCategory } from "../lib/categories.js";
import * as db from "../lib/db.js";
import { currentMonthKey, dayOfMonth, monthDays, monthLabel, shiftMonth } from "../lib/dates.js";
import { formatCompact, formatMoney } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

export default function StatsScreen() {
  const { expenses, currency } = useExpenses();
  const colors = useThemeColors();
  const [month, setMonth] = useState(currentMonthKey);

  const data = useMemo(() => {
    const items = db.inMonth(expenses, month);
    const total = db.total(items);
    const previousMonth = shiftMonth(month, -1);
    const previousTotal = db.total(db.inMonth(expenses, previousMonth));
    const days = monthDays(month);
    const daily = db.dailyTotals(items, days);
    const activeDays = daily.filter((d) => d.amount > 0).length;
    const busiest = daily.reduce((max, d) => (d.amount > max.amount ? d : max), {
      day: null,
      amount: 0,
    });
    return {
      items,
      total,
      previousMonth,
      previousTotal,
      breakdown: db.byCategory(items),
      daily,
      activeDays,
      busiest,
      average: activeDays > 0 ? total / activeDays : 0,
    };
  }, [expenses, month]);

  const change =
    data.previousTotal > 0 ? (data.total - data.previousTotal) / data.previousTotal : null;

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">Stats</h1>
          <p className="appbar__sub">Where your money went</p>
        </div>
      </header>

      <MonthPicker value={month} onChange={setMonth} />

      {data.items.length === 0 ? (
        <div className="card" style={{ marginTop: "var(--sp-4)" }}>
          <EmptyState
            icon="stats"
            title={`Nothing in ${monthLabel(month, true)}`}
            text="Add an expense in this month and the charts will fill in."
          />
        </div>
      ) : (
        <>
          {/* Total + trend */}
          <section className="hero card" style={{ marginTop: "var(--sp-4)" }}>
            <span className="hero__label">Total spent</span>
            <span className="hero__amount num">{formatMoney(data.total, currency)}</span>
            <span className="hero__meta">
              {change === null ? (
                `${data.items.length} expenses across ${data.activeDays} days`
              ) : (
                <span
                  className="trend"
                  style={{ color: change > 0 ? "var(--danger)" : "var(--ok)" }}
                >
                  <Icon name={change > 0 ? "stats" : "down"} size={14} />
                  {Math.abs(change * 100).toFixed(0)}% {change > 0 ? "more" : "less"} than{" "}
                  {monthLabel(data.previousMonth, true)}
                </span>
              )}
            </span>
          </section>

          <div className="tiles">
            <div className="tile card">
              <span className="tile__label">Avg / active day</span>
              <span className="tile__value num">{formatMoney(data.average, currency)}</span>
            </div>
            <div className="tile card">
              <span className="tile__label">Highest day</span>
              <span className="tile__value num">{formatMoney(data.busiest.amount, currency)}</span>
            </div>
          </div>

          {/* Donut by category */}
          <h2 className="section-title">By category</h2>
          <div className="card card--pad">
            <div className="donut">
              <ResponsiveContainer width="100%" height={196}>
                <PieChart>
                  <Pie
                    data={data.breakdown}
                    dataKey="amount"
                    nameKey="categoryId"
                    innerRadius="62%"
                    outerRadius="94%"
                    paddingAngle={data.breakdown.length > 1 ? 2 : 0}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {data.breakdown.map((slice) => (
                      <Cell key={slice.categoryId} fill={colors[slice.categoryId]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<ChartTooltip currency={currency} kind="category" />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut__center">
                <span className="donut__label">Total</span>
                <span className="donut__value num">{formatCompact(data.total, currency)}</span>
              </div>
            </div>

            <ul className="breakdown">
              {data.breakdown.map((slice) => {
                const category = getCategory(slice.categoryId);
                return (
                  <li key={slice.categoryId} className="bd-row">
                    <CategoryIcon id={slice.categoryId} size="sm" />
                    <span className="grow">
                      <span className="bd-row__head">
                        <span className="bd-row__label">{category.label}</span>
                        <span className="bd-row__amount num">
                          {formatMoney(slice.amount, currency)}
                        </span>
                      </span>
                      <span className="bd-bar">
                        <span
                          className="bd-bar__fill"
                          style={{
                            width: `${Math.max(slice.share * 100, 2)}%`,
                            background: category.color,
                          }}
                        />
                      </span>
                    </span>
                    <span className="bd-row__pct num">{Math.round(slice.share * 100)}%</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Daily bars */}
          <h2 className="section-title">Daily spending</h2>
          <div className="card card--pad">
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={data.daily} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="day"
                  tickFormatter={dayOfMonth}
                  interval={4}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors["text-faint"], fontSize: 11 }}
                  dy={4}
                />
                <Tooltip
                  cursor={{ fill: colors.border }}
                  content={<ChartTooltip currency={currency} kind="day" />}
                />
                <Bar
                  dataKey="amount"
                  fill={colors.accent}
                  radius={[4, 4, 2, 2]}
                  isAnimationActive={false}
                  minPointSize={0}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, currency, kind }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const title =
    kind === "category" ? getCategory(item.categoryId).label : `Day ${dayOfMonth(item.day)}`;
  return (
    <div className="chart-tip">
      <span className="chart-tip__title">{title}</span>
      <span className="chart-tip__value num">{formatMoney(item.amount, currency)}</span>
    </div>
  );
}
