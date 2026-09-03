/** Fixed category set. `color` points at a token in tokens.css so both themes work. */
export const CATEGORIES = [
  { id: "food", label: "Food & Drinks", color: "var(--c-food)" },
  { id: "groceries", label: "Groceries", color: "var(--c-groceries)" },
  { id: "travel", label: "Travel", color: "var(--c-travel)" },
  { id: "bills", label: "Bills & Recharge", color: "var(--c-bills)" },
  { id: "shopping", label: "Shopping", color: "var(--c-shopping)" },
  { id: "health", label: "Health", color: "var(--c-health)" },
  { id: "entertainment", label: "Entertainment", color: "var(--c-entertainment)" },
  { id: "other", label: "Other", color: "var(--c-other)" },
];

export const DEFAULT_CATEGORY = "other";

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Never returns undefined — an unknown id falls back to "Other". */
export function getCategory(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_CATEGORY);
}

export const PAYMENT_MODES = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
];

export function getPaymentLabel(id) {
  return PAYMENT_MODES.find((m) => m.id === id)?.label ?? "";
}
