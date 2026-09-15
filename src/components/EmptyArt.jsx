/**
 * Line illustrations for the empty states.
 *
 * A single Lucide glyph in a tinted square said "no records in a table". These
 * are drawn from the app's own vocabulary instead — a till slip, a chart with
 * nothing in it, a date that comes round again — so an empty screen still looks
 * like a money tracker rather than an error.
 *
 * Two strokes only: the outline inherits `currentColor` at low opacity so it
 * settles into either theme, and the accent carries the one part worth looking
 * at. The slip shows whatever currency symbol is set, so it is the user's own
 * money sitting there and not a dollar by default.
 */
export default function EmptyArt({ name = "ledger", currency = "₹" }) {
  return (
    <svg className="art" viewBox="0 0 120 96" fill="none" aria-hidden="true" focusable="false">
      {name === "chart" ? (
        <Chart />
      ) : name === "repeat" ? (
        <Repeat />
      ) : (
        <Ledger currency={currency} />
      )}
    </svg>
  );
}

/** A till slip with a torn edge, empty of lines, and a coin resting on it. */
function Ledger({ currency }) {
  return (
    <>
      <path
        className="art__paper"
        d="M34 16h34a7 7 0 0 1 7 7v54l-7-5-7 5-7-5-7 5-7-5-7 5V23a7 7 0 0 1 7-7Z"
      />
      <path className="art__rule" d="M43 34h17M43 46h22M43 58h13" />

      <circle className="art__coinRing" cx="85" cy="63" r="19" />
      <circle className="art__coin" cx="85" cy="63" r="19" />
      <text className="art__glyph" x="85" y="63" textAnchor="middle" dominantBaseline="central">
        {currency}
      </text>
    </>
  );
}

/** Four columns, one of them still waiting to be filled. */
function Chart() {
  return (
    <>
      <path className="art__rule" d="M26 78h68" />
      <rect className="art__paper" x="34" y="54" width="13" height="20" rx="4" />
      <rect className="art__paper" x="53" y="42" width="13" height="32" rx="4" />
      <rect className="art__bar" x="72" y="26" width="13" height="48" rx="4" />
      {/* The gap in the row is the point: this is the period with nothing in it. */}
      <rect className="art__ghost" x="91" y="62" width="13" height="12" rx="4" />
    </>
  );
}

/** A date with an arrow returning to it. */
function Repeat() {
  return (
    <>
      <rect className="art__paper" x="30" y="24" width="60" height="54" rx="10" />
      <path className="art__rule" d="M30 40h60M44 18v12M76 18v12" />
      <path className="art__bar" d="M52 60a8 8 0 0 1 8-8h9" />
      <path className="art__bar" d="M65 47l5 5-5 5" />
    </>
  );
}
