/**
 * How a budget bar should read at a glance: neutral while there is room, amber
 * from 80% so the warning arrives before the limit does, red once it is passed.
 *
 * Its own module rather than living beside BudgetBar: a file that exports both a
 * component and a plain function loses fast refresh.
 */
export function toneFor(ratio) {
  if (ratio >= 1) return { key: "over", color: "var(--danger)" };
  if (ratio >= 0.8) return { key: "warn", color: "var(--warn)" };
  return { key: "ok", color: "var(--accent)" };
}
