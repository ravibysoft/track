import { useMemo } from "react";

/**
 * A donut drawn as plain SVG arcs.
 *
 * This replaced Recharts, which cost 371 kB — more than the entire rest of the
 * app — to draw this ring and one bar chart, while everything else it carries
 * (axes, legends, brushes, cartesian grids, responsive containers) went unused.
 *
 * Coordinates live in a 0–100 viewBox, so the ring scales to any width without
 * measuring the container: a circle stretches uniformly, unlike bars.
 */
const TAU = Math.PI * 2;
const CX = 50;
const CY = 50;
const R_OUTER = 46;
const R_INNER = 30.5;
/** Radians trimmed from both ends of a slice so neighbours read as separate. */
const GAP = 0.03;
/** How far the selected slice lifts out of the ring. */
const LIFT = 2;

function point(radius, angle) {
  // Angles run clockwise from 12 o'clock, which is where a donut is read from.
  return `${(CX + radius * Math.sin(angle)).toFixed(3)} ${(CY - radius * Math.cos(angle)).toFixed(3)}`;
}

function arcPath(from, to, rOuter, rInner) {
  const large = to - from > Math.PI ? 1 : 0;
  return [
    `M${point(rOuter, from)}`,
    `A${rOuter} ${rOuter} 0 ${large} 1 ${point(rOuter, to)}`,
    `L${point(rInner, to)}`,
    `A${rInner} ${rInner} 0 ${large} 0 ${point(rInner, from)}`,
    "Z",
  ].join("");
}

export default function DonutChart({
  data,
  colorOf,
  labelOf,
  valueOf,
  selected,
  onSelect,
  height = 196,
}) {
  const slices = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.amount, 0);
    if (total <= 0) return [];
    let angle = 0;
    return data.map((d) => {
      const from = angle;
      angle += (d.amount / total) * TAU;
      return { ...d, from, to: angle };
    });
  }, [data]);

  if (slices.length === 0) return null;

  /* One slice sweeps the full circle, where an arc from 0 to 2π starts and ends
     at the same point and collapses to nothing. A stroked circle is the ring. */
  const whole = slices.length === 1;

  return (
    <svg
      className="donut__svg"
      viewBox="0 0 100 100"
      style={{ height }}
      role="img"
      aria-label={slices.map((s) => `${labelOf(s)} ${valueOf(s)}`).join(", ")}
    >
      {whole ? (
        <circle
          cx={CX}
          cy={CY}
          r={(R_OUTER + R_INNER) / 2}
          fill="none"
          stroke={colorOf(slices[0])}
          strokeWidth={R_OUTER - R_INNER}
          className="donut__slice"
        />
      ) : (
        slices.map((slice, i) => {
          // A hair-thin slice would vanish entirely if it lost the full gap.
          const pad = Math.min(GAP, (slice.to - slice.from) / 3);
          const active = selected === slice.categoryId;
          const lift = active ? LIFT : 0;
          return (
            <path
              key={slice.categoryId}
              className={`donut__slice${active ? " is-active" : ""}`}
              style={{ "--i": i }}
              d={arcPath(
                slice.from + pad,
                slice.to - pad,
                R_OUTER + lift,
                R_INNER + lift / 2,
              )}
              fill={colorOf(slice)}
              onClick={() => onSelect?.(active ? null : slice.categoryId)}
            />
          );
        })
      )}
    </svg>
  );
}
