import { dayOfMonth, leadingBlanks, monthDays, todayKey, WEEKDAY_LABELS } from "../lib/dates.js";
import { formatCompact } from "../lib/money.js";

/**
 * Month grid with each day's spend in the cell — Money Manager's calendar screen.
 * Good for spotting the heavy days at a glance, which a flat list never shows.
 *
 * Tapping a day selects it; tapping it again clears the selection.
 */
export default function MonthCalendar({ monthKey, totals, currency, selectedDay, onSelectDay }) {
  const days = monthDays(monthKey);
  const blanks = leadingBlanks(monthKey);
  const today = todayKey();

  return (
    <div className="calendar card card--flat">
      <div className="calendar__head">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`} className="calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="calendar__grid">
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} className="calendar__cell calendar__cell--empty" />
        ))}

        {days.map((day) => {
          const cell = totals.get(day);
          const isToday = day === today;
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              className={`calendar__cell${isToday ? " is-today" : ""}${
                isSelected ? " is-selected" : ""
              }${cell ? "" : " is-quiet"}`}
              onClick={() => onSelectDay(isSelected ? null : day)}
              aria-pressed={isSelected}
              aria-label={`${dayOfMonth(day)} — ${
                cell ? `spent ${formatCompact(cell.expense, currency)}` : "nothing spent"
              }`}
            >
              <span className="calendar__day num">{dayOfMonth(day)}</span>
              {cell?.expense > 0 && (
                <span className="calendar__amount num">
                  {formatCompact(cell.expense, currency)}
                </span>
              )}
              {cell?.income > 0 && (
                <span className="calendar__amount calendar__amount--income num">
                  {formatCompact(cell.income, currency)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
