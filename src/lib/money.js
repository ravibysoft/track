/** ₹ formatting with Indian digit grouping (1,25,400) and safe input parsing. */

export const DEFAULT_CURRENCY = "₹";

/**
 * The currencies a person can pick. `system` decides how digits are grouped:
 * South Asian money is counted in lakhs and crores (1,25,400), everyone else in
 * thousands and millions (125,400) — so changing the symbol has to change the
 * grouping with it, or a dollar amount would read like a rupee one.
 */
export const CURRENCIES = [
  { symbol: "₹", label: "Indian rupee", system: "indian" },
  { symbol: "Rs", label: "Rupee (Pakistan, Sri Lanka, Nepal)", system: "indian" },
  { symbol: "৳", label: "Bangladeshi taka", system: "indian" },
  { symbol: "$", label: "Dollar", system: "western" },
  { symbol: "€", label: "Euro", system: "western" },
  { symbol: "£", label: "Pound", system: "western" },
  { symbol: "AED ", label: "UAE dirham", system: "western" },
  { symbol: "¥", label: "Yen / Yuan", system: "western" },
];

function systemOf(currency) {
  return CURRENCIES.find((c) => c.symbol === currency)?.system ?? "western";
}

const FORMATTERS = {
  indian: {
    plain: new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    cents: new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  western: {
    plain: new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    cents: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
};

function safe(n) {
  return Number.isFinite(n) ? n : 0;
}

/**
 * ₹1,25,400 for whole amounts, ₹250.50 when paise are present.
 * Paise are only shown when they exist, so lists stay clean.
 */
export function formatMoney(n, currency = DEFAULT_CURRENCY) {
  const v = safe(n);
  const hasPaise = Math.round(Math.abs(v) * 100) % 100 !== 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const f = FORMATTERS[systemOf(currency)];
  return sign + currency + (hasPaise ? f.cents : f.plain).format(abs);
}

/**
 * Compact form for chart axes and tight tiles: ₹1.2L / ₹12.5K for rupees,
 * $1.2M / $12.5K for everyone else. A dollar amount in lakhs would be unreadable
 * to the people who count in dollars.
 */
export function formatCompact(n, currency = DEFAULT_CURRENCY) {
  const v = Math.abs(safe(n));
  const sign = safe(n) < 0 ? "-" : "";
  if (systemOf(currency) === "indian") {
    if (v >= 1e7) return `${sign}${currency}${trim(v / 1e7)}Cr`;
    if (v >= 1e5) return `${sign}${currency}${trim(v / 1e5)}L`;
  } else {
    if (v >= 1e9) return `${sign}${currency}${trim(v / 1e9)}B`;
    if (v >= 1e6) return `${sign}${currency}${trim(v / 1e6)}M`;
  }
  if (v >= 1e3) return `${sign}${currency}${trim(v / 1e3)}K`;
  return sign + currency + FORMATTERS[systemOf(currency)].plain.format(Math.round(v));
}

function trim(n) {
  // One decimal keeps 12.5K readable; three digits don't need it. A trailing .0 is dropped.
  return n.toFixed(n < 100 ? 1 : 0).replace(/\.0$/, "");
}

/**
 * Turns typed text ("1,250.50", "₹300", "12.") into a number.
 * Returns null when there is no usable number, so callers can block Save.
 */
export function parseAmount(text) {
  if (typeof text === "number") return Number.isFinite(text) ? round2(text) : null;
  if (!text) return null;
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  // Keep only the first decimal point.
  const [head, ...rest] = cleaned.split(".");
  const normalised = rest.length ? `${head}.${rest.join("")}` : head;
  const n = Number.parseFloat(normalised);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Avoids 0.1 + 0.2 drift accumulating across many saved rows. */
export function round2(n) {
  return Math.round((safe(n) + Number.EPSILON) * 100) / 100;
}

export function sum(list, pick = (x) => x.amount) {
  return round2(list.reduce((total, item) => total + safe(pick(item)), 0));
}
