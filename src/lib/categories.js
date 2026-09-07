/**
 * Two fixed category sets. `color` points at a token in tokens.css so both themes
 * work, and every id is unique across both sets so a single lookup map is enough.
 */
export const EXPENSE_CATEGORIES = [
  { id: "food", label: "Food & Drinks", color: "var(--c-food)", kind: "expense" },
  { id: "groceries", label: "Groceries", color: "var(--c-groceries)", kind: "expense" },
  { id: "travel", label: "Travel", color: "var(--c-travel)", kind: "expense" },
  { id: "bills", label: "Bills & Recharge", color: "var(--c-bills)", kind: "expense" },
  { id: "shopping", label: "Shopping", color: "var(--c-shopping)", kind: "expense" },
  { id: "health", label: "Health", color: "var(--c-health)", kind: "expense" },
  { id: "entertainment", label: "Entertainment", color: "var(--c-entertainment)", kind: "expense" },
  { id: "other", label: "Other", color: "var(--c-other)", kind: "expense" },
];

export const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", color: "var(--c-groceries)", kind: "income" },
  { id: "business", label: "Business", color: "var(--c-travel)", kind: "income" },
  { id: "freelance", label: "Freelance", color: "var(--c-health)", kind: "income" },
  { id: "gift", label: "Gift", color: "var(--c-shopping)", kind: "income" },
  { id: "interest", label: "Interest", color: "var(--c-bills)", kind: "income" },
  { id: "refund", label: "Refund", color: "var(--c-entertainment)", kind: "income" },
  { id: "other-income", label: "Other", color: "var(--c-other)", kind: "income" },
];

export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const DEFAULT_CATEGORY = "other";
export const DEFAULT_INCOME_CATEGORY = "salary";

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Never returns undefined — an unknown id falls back to "Other". */
export function getCategory(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_CATEGORY);
}

/** The picker list for a given entry type. */
export function categoriesFor(type) {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function defaultCategoryFor(type) {
  return type === "income" ? DEFAULT_INCOME_CATEGORY : DEFAULT_CATEGORY;
}

/** True when the id belongs to the set valid for that type. */
export function categoryFitsType(id, type) {
  return getCategory(id).kind === (type === "income" ? "income" : "expense");
}

export const PAYMENT_MODES = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
];

export function getPaymentLabel(id) {
  return PAYMENT_MODES.find((m) => m.id === id)?.label ?? "";
}
