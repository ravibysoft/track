import { currentMonthKey, monthLabel, shiftMonth } from "../lib/dates.js";
import Icon from "./Icon.jsx";

/** ‹ September 2026 › — forward is blocked past the current month. */
export default function MonthPicker({ value, onChange, right }) {
  const atLatest = value >= currentMonthKey();

  return (
    <div className="month-nav">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Previous month"
      >
        <Icon name="left" />
      </button>
      <span className="month-nav__label">{monthLabel(value)}</span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={atLatest}
        style={atLatest ? { opacity: 0.35, pointerEvents: "none" } : undefined}
        aria-label="Next month"
      >
        <Icon name="right" />
      </button>
      {right}
    </div>
  );
}
