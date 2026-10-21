import CategoryIcon from "./CategoryIcon.jsx";
import Icon from "./Icon.jsx";
import { shortDayLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { describeLeg, formatKm, formatMileage } from "../lib/odometer.js";

/**
 * What one category's kilometre readings came to.
 *
 * Deliberately NOT tied to the period above it. Fills do not line up with weeks
 * and months — ask a month with one fill in it for a mileage figure and it has
 * to answer with half a leg. These are lifetime figures, with the latest leg
 * called out on top because that is the one you just did and the one you came
 * here to see.
 *
 * Rows with nothing to report are left out rather than printed as "—": a
 * service has no litres and so no mileage, and an empty row in its card would
 * read as a reading gone missing.
 */
export default function KmCard({ category, stats, currency }) {
  const rows = [
    stats.kmPerLitre !== null && { label: "Mileage", value: formatMileage(stats.kmPerLitre) },
    stats.costPerKm !== null && {
      label: "Cost per km",
      value: formatMoney(stats.costPerKm, currency),
    },
    stats.km > 0 && { label: "Distance measured", value: formatKm(stats.km) },
    stats.litres > 0 && { label: "Fuel", value: `${stats.litres.toLocaleString("en-IN")} L` },
  ].filter(Boolean);

  return (
    <div className="card card--pad km">
      <div className="km__head">
        <CategoryIcon id={category.id} size="sm" />
        <span className="km__name">{category.label}</span>
        <span className="km__reading num">{formatKm(stats.lastReading)}</span>
      </div>

      {stats.latest ? (
        <p className="km__lead">{describeLeg(stats.latest)}</p>
      ) : (
        <p className="km__lead is-quiet">
          {stats.count === 1
            ? `One reading so far, from ${shortDayLabel(stats.last.date)}. The next one gives you the distance.`
            : "No distance to measure yet."}
        </p>
      )}

      {rows.length > 0 && (
        <div className="km__grid">
          {rows.map((row) => (
            <div className="km__cell" key={row.label}>
              <span className="km__label">{row.label}</span>
              <span className="km__value num">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* A reading that did not go up cannot be measured from, so the figures
          above quietly exclude it. Saying so beats letting the distance look
          short for no visible reason. */}
      {stats.suspectCount > 0 && (
        <p className="km__warn">
          <Icon name="alert" size={14} />
          <span>
            {stats.suspectCount === 1
              ? "One reading is lower than the one before it, so that leg is left out."
              : `${stats.suspectCount} readings are lower than the one before them, so those legs are left out.`}
          </span>
        </p>
      )}
    </div>
  );
}
