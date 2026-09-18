import { useMemo, useState } from "react";
import AnimatedAmount from "../components/AnimatedAmount.jsx";
import BarChart from "../components/BarChart.jsx";
import CategoryIcon from "../components/CategoryIcon.jsx";
import DonutChart from "../components/DonutChart.jsx";
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
  shortDayLabel,
  shiftYear,
  todayKey,
  weekDays,
  weekLabel,
  weekRange,
  yearMonths,
  yearRange,
} from "../lib/dates.js";
import { formatCompact, formatMoney, round2 } from "../lib/money.js";
import { shareSummary, summaryModel } from "../lib/summaryImage.js";
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
      buckets: days.map((day, i) => ({
        key: day,
        label: DAY_INITIALS[i],
        // The axis has room for one letter; the selection line has room for a date.
        longLabel: shortDayLabel(day),
        match: (e) => e.date === day,
      })),
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
        longLabel: monthLabel(m, true),
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
      longLabel: shortDayLabel(day),
      match: (e) => e.date === day,
    })),
    axisInterval: 4,
  };
}

export default function StatsScreen({ onSettings, onToast }) {
  const { expenses, currency } = useExpenses();
  const colors = useThemeColors();
  const [sharing, setSharing] = useState(false);

  const [period, setPeriod] = useState("month");
  const [anchors, setAnchors] = useState(() => ({
    week: todayKey(),
    month: currentMonthKey(),
    year: currentYear(),
  }));

  /* Tapping a slice or a bar is how you read a chart on a phone — there is no
     hover. Both selections are cleared whenever the period moves, so a stale
     highlight never survives into a span it doesn't belong to. */
  const [activeSlice, setActiveSlice] = useState(null);
  const [activeBar, setActiveBar] = useState(null);

  /* Which side of the ledger the breakdown is showing. Spending is the default
     because that is what the screen is for; income only becomes a question once
     there is some. */
  const [side, setSide] = useState("expense");

  const shape = useMemo(() => buildPeriod(period, anchors), [period, anchors]);

  /* Cleared by whatever moved the period, rather than by an effect watching it —
     an effect would render the stale highlight once before wiping it. */
  const clearSelection = () => {
    setActiveSlice(null);
    setActiveBar(null);
  };

  const showSide = (next) => {
    // The slice ids belong to the other side's categories, so the highlight goes.
    setActiveSlice(null);
    setSide(next);
  };

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
      breakdownIncome: db.byCategory(items, "income"),
      average: active > 0 ? round2(totals.expense / active) : 0,
    };
  }, [expenses, shape, period, anchors]);

  const change =
    data.previousSpent > 0 ? (data.totals.expense - data.previousSpent) / data.previousSpent : null;

  const step = (delta) => {
    clearSelection();
    setAnchors((a) => ({
      ...a,
      week: period === "week" ? shiftWeek(a.week, delta) : a.week,
      month: period === "month" ? shiftMonth(a.month, delta) : a.month,
      year: period === "year" ? shiftYear(a.year, delta) : a.year,
    }));
  };

  const atLatest =
    period === "week"
      ? weekRange(anchors.week).end >= weekRange(todayKey()).end
      : period === "year"
        ? anchors.year >= currentYear()
        : anchors.month >= currentMonthKey();

  const unit = period === "year" ? "month" : "day";
  /* The side is a preference, not a command: it gives way whenever the other one
     is the only one with anything in it. Stepping back into a month with no
     income must not leave an empty ring, and neither must a month where money
     only came in — which is exactly what a payday-only week looks like. */
  const earning =
    data.totals.income > 0 && (side === "income" || data.totals.expense === 0);
  const breakdown = earning ? data.breakdownIncome : data.breakdown;
  const sideTotal = earning ? data.totals.income : data.totals.expense;

  const share = async () => {
    setSharing(true);
    try {
      const stem = shape.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const outcome = await shareSummary(summaryModel(data.items, shape.label), currency, stem);
      if (outcome === "downloaded") onToast?.("Summary saved as a picture");
    } catch (err) {
      onToast?.(err?.message || "Couldn't share the summary");
    } finally {
      setSharing(false);
    }
  };

  const selectedSlice = breakdown.find((s) => s.categoryId === activeSlice) ?? null;
  const selectedBar = data.series.find((s) => s.key === activeBar) ?? null;

  return (
    <div className="screen">
      <header className="appbar">
        <div>
          <h1 className="appbar__title">Stats</h1>
          <p className="appbar__sub">Where your money went</p>
        </div>
        <div className="appbar__tools">
          {/* Sends whatever period is on screen — a week, a month or a year. */}
          {data.items.length > 0 && (
            <button
              type="button"
              className="icon-btn"
              onClick={share}
              disabled={sharing}
              aria-label={`Share ${shape.label} as a picture`}
            >
              <Icon name="share" />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onSettings}
            aria-label="Settings"
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <div
        className="seg"
        style={{
          "--seg-index": PERIODS.findIndex((p) => p.id === period),
          "--seg-count": PERIODS.length,
        }}
      >
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`seg__btn${period === p.id ? " is-active" : ""}`}
            onClick={() => {
              clearSelection();
              setPeriod(p.id);
            }}
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
            art="chart"
            currency={currency}
            title={`Nothing in ${shape.label}`}
            text="Charts need something to draw. Add an entry in this period, or step back to one that has some."
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

          {/* No Expense column: the hero right above it is that same number, and
              printing it twice, forty pixels apart, taught the reader nothing. */}
          {data.totals.income > 0 && (
            <div className="ledger ledger--pair card">
              <div className="ledger__col">
                <span className="ledger__label">Income</span>
                <span className="ledger__value ledger__value--income num">
                  {formatMoney(data.totals.income, currency)}
                </span>
              </div>
              <div className="ledger__col">
                <span className="ledger__label">
                  {data.totals.net < 0 ? "Overspent by" : "Left over"}
                </span>
                <span
                  className={`ledger__value num${data.totals.net < 0 ? " ledger__value--expense" : ""}`}
                >
                  {formatMoney(Math.abs(data.totals.net), currency)}
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

          <div className="section-head">
            <h2 className="section-title">By category</h2>
            {/* Only worth asking once both sides exist. With no income recorded
                this is an expense tracker and the question has one answer. */}
            {data.totals.income > 0 && (
              <div className="seg seg--mini" style={{ "--seg-index": earning ? 1 : 0, "--seg-count": 2 }}>
                <button
                  type="button"
                  className={`seg__btn${!earning ? " is-active" : ""}`}
                  onClick={() => showSide("expense")}
                  aria-pressed={!earning}
                >
                  Spending
                </button>
                <button
                  type="button"
                  className={`seg__btn${earning ? " is-active" : ""}`}
                  onClick={() => showSide("income")}
                  aria-pressed={earning}
                >
                  Income
                </button>
              </div>
            )}
          </div>
          <div className="card card--pad">
            <div className="donut">
              <DonutChart
                data={breakdown}
                colorOf={(s) => colors[s.categoryId]}
                labelOf={(s) => getCategory(s.categoryId).label}
                valueOf={(s) => formatMoney(s.amount, currency)}
                selected={activeSlice}
                onSelect={setActiveSlice}
              />
              {/* The middle of a donut is the natural place for the detail, so a
                  tapped slice reports itself there instead of in a tooltip that
                  would have to float clear of the ring on a narrow screen. */}
              <div className="donut__center">
                <span className="donut__label">
                  {selectedSlice
                    ? getCategory(selectedSlice.categoryId).label
                    : earning
                      ? "Earned"
                      : "Spent"}
                </span>
                <span className="donut__value num">
                  {formatCompact(selectedSlice ? selectedSlice.amount : sideTotal, currency)}
                </span>
                {selectedSlice && (
                  <span className="donut__share num">
                    {Math.round(selectedSlice.share * 100)}% of {earning ? "income" : "spending"}
                  </span>
                )}
              </div>
            </div>

            <ul className="breakdown">
              {breakdown.map((slice) => {
                const category = getCategory(slice.categoryId);
                return (
                  <li key={slice.categoryId}>
                    <button
                      type="button"
                      className={`bd-row${activeSlice === slice.categoryId ? " is-active" : ""}`}
                      aria-pressed={activeSlice === slice.categoryId}
                      onClick={() =>
                        setActiveSlice(activeSlice === slice.categoryId ? null : slice.categoryId)
                      }
                    >
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
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="section-head">
            <h2 className="section-title">Spending by {unit}</h2>
            {/* A tapped bar reports here rather than in a floating tooltip: at 31
                bars across a phone, a tip over the first or last one would hang
                off the card. */}
            <span className="section-head__note num">
              {selectedBar
                ? `${shape.buckets.find((b) => b.key === selectedBar.key)?.longLabel ?? selectedBar.label} · ${formatMoney(selectedBar.amount, currency)}`
                : `Tap a ${unit}`}
            </span>
          </div>
          <div className="card card--pad">
            <BarChart
              data={data.series}
              color={colors.accent}
              labelInterval={shape.axisInterval}
              selected={activeBar}
              onSelect={setActiveBar}
              format={(n) => formatMoney(n, currency)}
            />
          </div>
        </>
      )}
    </div>
  );
}

