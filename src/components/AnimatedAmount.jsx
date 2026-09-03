import useCountUp from "../hooks/useCountUp.js";
import { formatMoney } from "../lib/money.js";

/**
 * A money figure that counts up when it appears or changes.
 *
 * Mid-flight values are rounded to the *target's* precision — otherwise a whole
 * number like ₹1,499 would flicker through "₹843.27" and jump width on every frame.
 */
export default function AnimatedAmount({ value, currency, className = "" }) {
  const raw = useCountUp(value);
  const hasPaise = Math.round(Math.abs(value) * 100) % 100 !== 0;
  const shown = hasPaise ? raw : Math.round(raw);

  return <span className={`num ${className}`.trim()}>{formatMoney(shown, currency)}</span>;
}
