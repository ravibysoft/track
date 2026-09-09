/**
 * Categories: eight for spending, seven for income, plus whatever the user adds.
 *
 * The built-ins below are only the *starting* list. The live list belongs to the
 * document (`settings.categories`), so it can be renamed, reordered, hidden and
 * extended, and it travels in a backup like everything else.
 *
 * `color` points at a token in tokens.css so both themes work, and every id is
 * unique across both sets so a single lookup map is enough.
 */
const BUILT_IN_EXPENSE = [
  { id: "food", label: "Food & Drinks", color: "var(--c-food)", kind: "expense" },
  { id: "groceries", label: "Groceries", color: "var(--c-groceries)", kind: "expense" },
  { id: "travel", label: "Travel", color: "var(--c-travel)", kind: "expense" },
  { id: "bills", label: "Bills & Recharge", color: "var(--c-bills)", kind: "expense" },
  { id: "shopping", label: "Shopping", color: "var(--c-shopping)", kind: "expense" },
  { id: "health", label: "Health", color: "var(--c-health)", kind: "expense" },
  { id: "entertainment", label: "Entertainment", color: "var(--c-entertainment)", kind: "expense" },
  { id: "other", label: "Other", color: "var(--c-other)", kind: "expense" },
];

const BUILT_IN_INCOME = [
  { id: "salary", label: "Salary", color: "var(--c-groceries)", kind: "income" },
  { id: "business", label: "Business", color: "var(--c-travel)", kind: "income" },
  { id: "freelance", label: "Freelance", color: "var(--c-health)", kind: "income" },
  { id: "gift", label: "Gift", color: "var(--c-shopping)", kind: "income" },
  { id: "interest", label: "Interest", color: "var(--c-bills)", kind: "income" },
  { id: "refund", label: "Refund", color: "var(--c-entertainment)", kind: "income" },
  { id: "other-income", label: "Other", color: "var(--c-other)", kind: "income" },
];

export const BUILT_IN_CATEGORIES = [...BUILT_IN_EXPENSE, ...BUILT_IN_INCOME];

const BUILT_IN_IDS = new Set(BUILT_IN_CATEGORIES.map((c) => c.id));

export const DEFAULT_CATEGORY = "other";
export const DEFAULT_INCOME_CATEGORY = "salary";

/** What a new category may be painted, and drawn as. Both are Icon.jsx names. */
export const CATEGORY_COLORS = [
  "var(--c-food)",
  "var(--c-groceries)",
  "var(--c-travel)",
  "var(--c-bills)",
  "var(--c-shopping)",
  "var(--c-health)",
  "var(--c-entertainment)",
  "var(--c-other)",
];

export const CATEGORY_ICONS = [
  "other",
  "food",
  "groceries",
  "travel",
  "bills",
  "shopping",
  "health",
  "entertainment",
  "salary",
  "business",
  "freelance",
  "gift",
  "interest",
  "refund",
  "home",
  "wallet",
  "target",
  "calendar",
];

export function defaultCategories() {
  return BUILT_IN_CATEGORIES.map((c) => ({ ...c, icon: c.id, hidden: false }));
}

export function isBuiltIn(id) {
  return BUILT_IN_IDS.has(id);
}

function cleanLabel(value, fallback) {
  const text = typeof value === "string" ? value.trim().slice(0, 24) : "";
  return text || fallback;
}

/**
 * Turns whatever is in the document into a usable list.
 *
 * Any built-in missing from the stored list is appended rather than dropped, so
 * a category added in a later version of the app appears for someone restoring
 * an older backup — and a built-in can never be deleted out of existence, only
 * hidden, because old entries still point at its id.
 */
export function normalizeCategories(raw) {
  const seen = new Set();
  const list = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 40) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const builtIn = BUILT_IN_CATEGORIES.find((c) => c.id === id);
    list.push({
      id,
      label: cleanLabel(item.label, builtIn?.label ?? id),
      color:
        typeof item.color === "string" && item.color
          ? item.color
          : (builtIn?.color ?? "var(--c-other)"),
      kind: item.kind === "income" ? "income" : "expense",
      icon: typeof item.icon === "string" && item.icon ? item.icon : (builtIn?.id ?? "other"),
      // A built-in is never really gone; hiding just keeps it out of the picker.
      hidden: item.hidden === true,
    });
  }

  for (const builtIn of defaultCategories()) {
    if (!seen.has(builtIn.id)) list.push(builtIn);
  }

  return list;
}

/* ---------- Live registry ----------
 *
 * `getCategory` is called from list rows, chart slices and the sanitiser in
 * db.js — including during `migrate()`, which runs before any React context
 * exists. Threading the list through all of those would mean passing it into
 * pure document code that has no way to reach a provider, so the single
 * in-memory document publishes its list here instead. ExpenseProvider keeps it
 * in step; nothing else writes to it.
 */
let registry = defaultCategories();
let byId = new Map(registry.map((c) => [c.id, c]));

export function setCategoryRegistry(list) {
  registry = normalizeCategories(list);
  byId = new Map(registry.map((c) => [c.id, c]));
  return registry;
}

export function allCategories() {
  return registry;
}

/**
 * Never returns undefined. An id with no category — a custom one that was
 * deleted while entries still referenced it — comes back wearing the neutral
 * "Other" look but keeps its own id, so the entry is never silently rewritten.
 */
export function getCategory(id) {
  const found = byId.get(id);
  if (found) return found;
  const fallback = byId.get(DEFAULT_CATEGORY) ?? BUILT_IN_EXPENSE[7];
  return { ...fallback, id: typeof id === "string" && id ? id : fallback.id };
}

/** The picker list for a given entry type — hidden categories stay out of it. */
export function categoriesFor(type) {
  const kind = type === "income" ? "income" : "expense";
  return registry.filter((c) => c.kind === kind && !c.hidden);
}

/** Everything of that kind, hidden included — for the management screen. */
export function everyCategoryFor(type) {
  const kind = type === "income" ? "income" : "expense";
  return registry.filter((c) => c.kind === kind);
}

/**
 * The category an entry gets when none was chosen, or when a stored one cannot
 * be trusted. Deliberately the neutral "Other", not simply the first in the
 * list: a row whose category could not be read should look unclassified, not
 * quietly claim to be Food. Falls through only if that one has been hidden.
 */
export function defaultCategoryFor(type) {
  const wanted = type === "income" ? DEFAULT_INCOME_CATEGORY : DEFAULT_CATEGORY;
  const found = byId.get(wanted);
  if (found && !found.hidden) return wanted;
  return categoriesFor(type)[0]?.id ?? wanted;
}

/** True when the id belongs to the set valid for that type. */
export function categoryFitsType(id, type) {
  const found = byId.get(id);
  if (!found) return true; // unknown ids are not ours to reject — see db.sanitizeEntry
  return found.kind === (type === "income" ? "income" : "expense");
}

export function newCategoryId(label) {
  const slug = String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return `c-${slug || "cat"}-${Math.random().toString(36).slice(2, 7)}`;
}

export const PAYMENT_MODES = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
];

export function getPaymentLabel(id) {
  return PAYMENT_MODES.find((m) => m.id === id)?.label ?? "";
}
