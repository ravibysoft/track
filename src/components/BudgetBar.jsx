import { formatMoney } from "../lib/money.js";
import Icon from "./Icon.jsx";

/** Neutral while comfortable, amber from 80%, red once the limit is passed. */
function toneFor(ratio) {
  if (ratio >= 1) return { key: "over", color: "var(--danger)" };
  if (ratio >= 0.8) return { key: "warn", color: "var(--warn)" };
  return { key: "ok", color: "var(--accent)" };
}

export default function BudgetBar({ spent, budget, currency, onSetBudget }) {
  if (!budget || budget <= 0) {
    return (
      <button type="button" className="card budget budget--empty" onClick={onSetBudget}>
        <span className="cat cat--sm" style={{ "--cat-color": "var(--accent)" }}>
          <Icon name="target" />
        </span>
        <span className="grow" style={{ textAlign: "left" }}>
          <span className="budget__cta">Set a monthly budget</span>
          <span className="budget__hint">Track how much of your limit is left</span>
        </span>
        <Icon name="right" size={18} style={{ color: "var(--text-faint)" }} />
      </button>
    );
  }

  const ratio = spent / budget;
  const tone = toneFor(ratio);
  const remaining = budget - spent;

  return (
    <div className="card budget">
      <div className="budget__head">
        <span className="budget__label">Monthly budget</span>
        <span className="budget__label num">
          {formatMoney(spent, currency)} / {formatMoney(budget, currency)}
        </span>
      </div>
      <div className="budget__track">
        <div
          className="budget__fill"
          style={{
            width: `${Math.min(ratio, 1) * 100}%`,
            background: tone.color,
          }}
        />
      </div>
      <div className="budget__meta" style={{ color: tone.key === "ok" ? undefined : tone.color }}>
        {remaining >= 0 ? (
          <>
            <strong className="num">{formatMoney(remaining, currency)}</strong> left this month
          </>
        ) : (
          <>
            <Icon name="alert" size={14} />
            <strong className="num">{formatMoney(-remaining, currency)}</strong> over budget
          </>
        )}
      </div>
    </div>
  );
}
