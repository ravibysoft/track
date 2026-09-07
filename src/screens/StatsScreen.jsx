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
import AnimatedAmount from "../components/AnimatedAmount.jsx";
import CategoryIcon from "../components/CategoryIcon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Icon from "../components/Icon.jsx";
import useThemeColors from "../hooks/useThemeColors.js";
import { getCategory } from "../lib/categories.js";
import * as db from "../lib/db.js";
import {
  currentMonthKey,
  currentYear,
  dayOfMonth,
  monthDays,
  monthLabel,
  monthRange,
  monthShortLabel,
  monthKeyOf,
  shiftMonth,
  shiftWeek,
  shiftYear,
  todayKey,
  weekDays,
  weekLabel,
  weekRange,
  yearMonths,
  yearRange,
} from "../lib/dates.js";
import { formatCompact, formatMoney, round2 } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

const PERIODS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/** Everything the screen needs for one period, so the JSX stays declarative. */
function buildPeriod(period, anchors) {
  if (period === "week") {
    const days = weekDays(anchors.week);
    const { start, end } = weekRange(anchors.week);
    return {
      start,
      end,
      label: weekLabel(anchors.week),
      previousLabel: "last week",
      buckets: days.map((day, i) => ({ key: day, label: DAY_INITIALS[i], match: (e) => e.date === day })),
      axisInterval: 0,
    };
  }
  if (period === "year") {
    const months = yearMonths(anchors.year);
    const { start, end } = yearRange(anchors.year);
    return {
      start,
      end,
      label: anchors.year,
      previousLabel: `${Number(anchors.year) - 1}`,
      buckets: months.map((m) => ({
        key: m,
        label: monthShortLabel(m),
        match: (e) => monthKeyOf(e.date) === m,
      })),
      axisInterval: 1,
    };
  }
  const days = monthDays(anchors.month);
  const { start, end } = monthRange(anchors.month);
  return {
    start,
    end,
    label: monthLabel(anchors.month),
    previousLabel: monthLabel(shiftMonth(anchors.month, -1), true),
    buckets: days.map((day) => ({
      key: day,
      label: String(dayOfMonth(day)),
      match: (e) => e.date === day,
    })),
    axisInterval: 4,
  };
}

export default function StatsScreen() {
  const { expenses, currency } = useExpenses();
  const colors = useThemeColors();

  const [period, setPeriod] = useState("month");
  const [anchors, setAnchors] = useState(() => ({
    week: todayKey(),
    month: currentMonthKey(),
    year: currentYear(),
  }));

  const shape = useMemo(() => buildPeriod(period, anchors), [period, anchors]);

  const data = useMemo(() => {
    const items = db.betweenDays(expenses, shape.start, shape.end);
    const totals = db.totals(items);

    const series = shape.buckets.map((b) => ({
      key: b.key,
      label: b.label,
      amount: db.spent(items.filter(b.match)),
    }));

    const active = series.filter((s) => s.amount > 0).length;
    const busiest = series.reduce((max, s) => (s.amount > max.amount ? s : max), {
      key: null,
      amount: 0,
    });

    // The same span, one period earlier — for the "less than last month" line.
    const previous =
      period === "week"
        ? weekRange(shiftWeek(anchors.week, -1))
        : period === "year"
          ? yearRange(shiftYear(anchors.year, -1))
          : monthRange(shiftMonth(anchors.month, -1));
    const previousSpent = db.spent(db.betweenDays(expenses, previous.start, previous.end));

    return {
      items,
      totals,
      series,
      active,
      busiest,
      previousSpent,
      breakdown: db.byCategory(items, "expense"),
      average: active > 0 ? round2(totals.expense / active) : 0,
    };
  }, [expenses, shape, period, anchors]);

  const change =
    data.previousSpent > 0 ? (data.totals.expense - data.previousSpent) / data.previousSpent : null;

  const step = (delta) =>
    setAnchors((a) => ({
      ...a,
      week: period === "week" ? shiftWeek(a.week, delta) : a.week,
      month: period === "month" ? shiftMonth(a.month, delta) : a.month,
      year: period === "year" ? shiftYear(a.year, delta) : a.year,
    }));

  const atLatest =
    period === "week"
      ? weekRange(anchors.week).end >= weekRange(todayKey()).end
      : period === "year"
        ? anchors.year >= currentYear()
        : anchors.month >= currentMonthKey();

  const unit = period === "year" ? "month" : "day";

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">Stats</h1>
          <p className="appbar__sub">Where your money went</p>
        </div>
      </header>

      <div className="seg">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`seg__btn${period === p.id ? " is-active" : ""}`}
            onClick={() => setPeriod(p.id)}
            aria-pressed={period === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="month-nav">
        <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
          <Icon name="left" />
        </button>
        <span className="month-nav__label">{shape.label}</span>
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
      </div>

      {data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="stats"
            title={`Nothing in ${shape.label}`}
            text="Add an entry in this period and the charts will fill in."
          />
        </div>
      ) : (
        <>
          <section className="hero card">
            <span className="hero__label">Total spent</span>
            <AnimatedAmount
              className="hero__amount"
              value={data.totals.expense}
              currency={currency}
            />
            <span className="hero__meta">
              {change === null ? (
                `${data.items.length} entries across ${data.active} ${unit}s`
              ) : (
                <span
                  className="trend"
                  style={{ color: change > 0 ? "var(--danger)" : "var(--ok)" }}
                >
                  <Icon name={change > 0 ? "stats" : "down"} size={14} />
                  {Math.abs(change * 100).toFixed(0)}% {change > 0 ? "more" : "less"} than{" "}
                  {shape.previousLabel}
                </span>
              )}
            </span>
          </section>

          {data.totals.income > 0 && (
            <div className="ledger card">
              <div className="ledger__col">
                <span className="ledger__label">Income</span>
                <span className="ledger__value ledger__value--income num">
                  {formatMoney(data.totals.income, currency)}
                </span>
              </div>
              <div className="ledger__col">
                <span className="ledger__label">Expense</span>
                <span className="ledger__value ledger__value--expense num">
                  {formatMoney(data.totals.expense, currency)}
                </span>
              </div>
              <div className="ledger__col">
                <span className="ledger__label">Balance</span>
                <span
                  className={`ledger__value num${data.totals.net < 0 ? " ledger__value--expense" : ""}`}
                >
                  {formatMoney(data.totals.net, currency)}
                </span>
              </div>
            </div>
          )}

          <div className="tiles">
            <div className="tile card">
              <span className="tile__label">Avg / active {unit}</span>
              <span className="tile__value num">{formatMoney(data.average, currency)}</span>
            </div>
            <div className="tile card">
              <span className="tile__label">Highest {unit}</span>
              <span className="tile__value num">{formatMoney(data.busiest.amount, currency)}</span>
            </div>
          </div>

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
                    animationDuration={620}
                  >
                    {data.breakdown.map((slice) => (
                      <Cell key={slice.categoryId} fill={colors[slice.categoryId]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip currency={currency} kind="category" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut__center">
                <span className="donut__label">Spent</span>
                <span className="donut__value num">
                  {formatCompact(data.totals.expense, currency)}
                </span>
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

          <h2 className="section-title">Spending by {unit}</h2>
          <div className="card card--pad">
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={data.series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  interval={shape.axisInterval}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors["text-faint"], fontSize: 11 }}
                  dy={4}
                />
                <Tooltip
                  cursor={{ fill: colors.border }}
                  content={<ChartTooltip currency={currency} kind="bucket" unit={unit} />}
                />
                <Bar
                  dataKey="amount"
                  fill={colors.accent}
                  radius={[4, 4, 2, 2]}
                  animationDuration={620}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, currency, kind, unit }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const title =
    kind === "category"
      ? getCategory(item.categoryId).label
      : `${unit === "month" ? "" : `${unit} `}${item.label}`.trim();
  return (
    <div className="chart-tip">
      <span className="chart-tip__title">{title}</span>
      <span className="chart-tip__value num">{formatMoney(item.amount, currency)}</span>
    </div>
  );
}
