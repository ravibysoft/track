/**
 * The daily/monthly spending bars.
 *
 * Deliberately HTML and CSS rather than SVG: bars are rectangles in a row, which
 * is what flexbox already is. Percentage heights make it responsive with no
 * container measuring, and each bar is a real <button>, so it is reachable by
 * keyboard and reads out its own value — neither of which came free from the
 * charting library this replaced.
 *
 * `labelInterval` matches the axis convention it replaced: 0 labels every bar,
 * 4 labels every fifth.
 */
export default function BarChart({
  data,
  color,
  labelInterval = 0,
  selected,
  onSelect,
  format,
  height = 168,
}) {
  const max = data.reduce((m, d) => (d.amount > m ? d.amount : m), 0);

  return (
    <div className="bars" style={{ "--bars-h": `${height}px` }}>
      {data.map((d, i) => {
        const share = max > 0 ? d.amount / max : 0;
        const active = selected === d.key;
        return (
          <button
            key={d.key}
            type="button"
            className={`bars__col${active ? " is-active" : ""}`}
            aria-pressed={active}
            aria-label={`${d.label}: ${format(d.amount)}`}
            onClick={() => onSelect?.(active ? null : d.key)}
          >
            <span className="bars__track">
              <span
                className="bars__fill"
                style={{
                  // A day with nothing spent still shows a sliver, so the row of
                  // bars reads as a timeline rather than as gaps.
                  height: `${Math.max(share * 100, d.amount > 0 ? 2 : 0)}%`,
                  background: color,
                  "--i": i,
                }}
              />
            </span>
            <span className="bars__label">
              {i % (labelInterval + 1) === 0 ? d.label : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
