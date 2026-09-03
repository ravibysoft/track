/**
 * Headless smoke test — mounts the real app in jsdom and drives it the way a
 * person would: add an expense, edit it, delete it, undo, check persistence.
 *
 * Run with:  npm run smoke
 * (Bundled by `vite build --ssr` first, so JSX and the app's imports resolve.)
 */
import { JSDOM } from "jsdom";

/* ---------- Browser environment ---------- */
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:5173/",
  pretendToBeVisual: true,
});

const { window } = dom;
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
});
window.scrollTo = () => {};
if (!window.crypto?.randomUUID) {
  window.crypto = { ...window.crypto, randomUUID: () => `id-${Math.random().toString(36).slice(2)}` };
}

globalThis.window = window;
globalThis.document = window.document;
// Node 24 defines `navigator` as a getter-only global, so it needs redefining.
Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.PointerEvent = window.MouseEvent;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
/* jsdom has no layout engine, so charts would measure 0px and skip rendering.
   A stub ResizeObserver plus fixed offset sizes give them a real box to draw in. */
class StubResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe(target) {
    this.callback([{ target, contentRect: { width: 360, height: 196, top: 0, left: 0 } }], this);
  }
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = StubResizeObserver;
globalThis.ResizeObserver = StubResizeObserver;
Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", { get: () => 360 });
Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { get: () => 196 });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* ---------- App under test ---------- */
const { act } = await import("react");
const { createElement, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../src/App.jsx");
const { ExpenseProvider } = await import("../src/state/ExpenseProvider.jsx");

/* ---------- Tiny assertion helpers ---------- */
let failures = 0;
let checks = 0;

function check(label, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const text = (sel) => $(sel)?.textContent?.trim() ?? "";
const byText = (sel, needle) =>
  $$(sel).find((el) => el.textContent.trim().toLowerCase().includes(needle.toLowerCase()));

async function click(el, label) {
  if (!el) throw new Error(`Cannot click missing element: ${label}`);
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function type(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

/* Long enough to cover the sheet close animation (190ms) and the debounced save (200ms). */
const settle = (ms = 280) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

/* ---------- Pure-function edge cases ---------- */
const { formatMoney, parseAmount, formatCompact } = await import("../src/lib/money.js");
const { buildCsv, buildJson } = await import("../src/lib/backup.js");
const { dayLabel, monthDays, shiftMonth, toKey, todayKey } = await import("../src/lib/dates.js");

console.log("\nAmount parsing & formatting");
check("rejects empty input", parseAmount("") === null);
check("rejects a lone decimal point", parseAmount(".") === null);
check("keeps paise", parseAmount("12.5") === 12.5);
check("collapses extra decimal points", parseAmount("12.5.7") === 12.57, `got ${parseAmount("12.5.7")}`);
check("strips currency and commas", parseAmount("₹1,25,000") === 125000, `got ${parseAmount("₹1,25,000")}`);
check("rounds to 2 decimals", parseAmount("10.999") === 11);
check("whole amounts hide paise", formatMoney(1250) === "₹1,250", `got "${formatMoney(1250)}"`);
check("paise shown when present", formatMoney(250.5) === "₹250.50", `got "${formatMoney(250.5)}"`);
check("lakh grouping is Indian", formatMoney(125400) === "₹1,25,400", `got "${formatMoney(125400)}"`);
check("zero formats cleanly", formatMoney(0) === "₹0");
check("compact uses K / L", formatCompact(12500) === "₹12.5K" && formatCompact(250000) === "₹2.5L", `got ${formatCompact(12500)} / ${formatCompact(250000)}`);

console.log("\nDates");
check("today reads as Today", dayLabel(toKey(new Date())) === "Today");
check("month rolls back over a year", shiftMonth("2026-01", -1) === "2025-12");
check("February 2026 has 28 days", monthDays("2026-02").length === 28);
check("leap February has 29", monthDays("2024-02").length === 29);

console.log("\nBackup files");
const sampleDoc = {
  version: 1,
  settings: { currency: "₹", monthlyBudget: 0, theme: "system" },
  expenses: [
    { id: "a", amount: 250.5, categoryId: "food", note: 'Chai, "the good one"', date: "2026-09-03", paymentMode: "upi", createdAt: "x", updatedAt: "x" },
  ],
};
const csv = buildCsv(sampleDoc.expenses);
check("CSV has a header row", csv.includes("Date,Category,Note,Paid by,Amount"));
check("CSV escapes quotes and commas", csv.includes('"Chai, ""the good one"""'));
check("CSV starts with a UTF-8 BOM for Excel", csv.charCodeAt(0) === 0xfeff);
check("JSON backup round-trips", JSON.parse(buildJson(sampleDoc)).expenses.length === 1);

/* ---------- Run ---------- */
console.log("\nMounting app…");
const root = createRoot(document.getElementById("root"));
await act(async () => {
  root.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
});
await settle();

console.log("\nHome screen");
check("renders the Today header", text(".appbar__title") === "Today", `got "${text(".appbar__title")}"`);
check("starts at ₹0", text(".hero__amount") === "₹0", `got "${text(".hero__amount")}"`);
check("shows the empty state", text(".empty__title").includes("No expenses today"));
check("shows all four tabs", $$(".tabbar__btn").length === 4);

console.log("\nAdd an expense");
await click($(".fab"), "FAB");
await settle();
check("opens the add sheet", text(".sheet__title") === "Add expense", `got "${text(".sheet__title")}"`);
check("Add button starts disabled", $(".sheet__foot .btn--primary")?.disabled === true);

await type($(".amount-input__field"), "250.50");
await click(byText(".cat-option", "Food"), "Food category");
await type($('.field input[type="text"].input'), "Lunch at office");
await settle();
check("Add button enables once an amount is typed", $(".sheet__foot .btn--primary")?.disabled === false);

await click($(".sheet__foot .btn--primary"), "Add expense");
await settle();

check("expense appears in today's list", $$(".row").length === 1, `${$$(".row").length} rows`);
check("row shows the note", text(".row__title") === "Lunch at office", `got "${text(".row__title")}"`);
check("row shows ₹250.50", text(".row__amount") === "₹250.50", `got "${text(".row__amount")}"`);
check("today's total updates", text(".hero__amount") === "₹250.50", `got "${text(".hero__amount")}"`);
check("confirmation toast shows", text(".snackbar").includes("Expense added"));
check("persisted to storage", (localStorage.getItem("rozkharcha.v1") ?? "").includes("Lunch at office"));

console.log("\nIndian digit grouping");
await click($(".fab"), "FAB");
await settle();
await type($(".amount-input__field"), "125400");
await click(byText(".cat-option", "Shopping"), "Shopping category");
await settle();
check("previews ₹1,25,400 (en-IN grouping)", text(".amount-input__echo") === "₹1,25,400", `got "${text(".amount-input__echo")}"`);
await click($(".sheet__foot .btn--primary"), "Add expense");
await settle();
check("two expenses now listed", $$(".row").length === 2, `${$$(".row").length} rows`);
check("total is ₹1,25,650.50", text(".hero__amount") === "₹1,25,650.50", `got "${text(".hero__amount")}"`);

console.log("\nEdit an expense");
await click(byText(".row", "Lunch at office"), "Lunch row");
await settle();
check("opens the edit sheet", text(".sheet__title") === "Edit expense", `got "${text(".sheet__title")}"`);
check("prefills the amount", $(".amount-input__field")?.value === "250.5", `got "${$(".amount-input__field")?.value}"`);
await type($(".amount-input__field"), "300");
await click($(".sheet__foot .btn--primary"), "Save changes");
await settle();
check("edited amount shows in the list", !!byText(".row__amount", "₹300"));
check("total recalculates", text(".hero__amount") === "₹1,25,700", `got "${text(".hero__amount")}"`);

console.log("\nDelete + undo");
await click(byText(".row", "Lunch at office"), "Lunch row");
await settle();
await click($(".sheet__foot .btn--danger"), "Delete");
await settle();
check("expense removed", $$(".row").length === 1, `${$$(".row").length} rows`);
check("undo offered", text(".snackbar").includes("Expense deleted"));
await click($(".snackbar__action"), "Undo");
await settle();
check("undo restores it", $$(".row").length === 2, `${$$(".row").length} rows`);

console.log("\nHistory tab");
await click(byText(".tabbar__btn", "History"), "History tab");
await settle();
check("history header renders", text(".appbar__title") === "History", `got "${text(".appbar__title")}"`);
check("groups under a day heading", text(".day-head__label") === "Today", `got "${text(".day-head__label")}"`);
check("day subtotal shown", text(".day-head__total") === "₹1,25,700", `got "${text(".day-head__total")}"`);
check("both expenses listed", $$(".row").length === 2, `${$$(".row").length} rows`);

await type($('.search-bar input'), "lunch");
await settle();
check("search filters to one row", $$(".row").length === 1, `${$$(".row").length} rows`);
await click($(".search-bar .icon-btn"), "clear search");
await settle();

await click(byText(".chip", "Shopping"), "Shopping filter");
await settle();
check("category filter narrows the list", $$(".row").length === 1, `${$$(".row").length} rows`);
await click(byText(".chip", "All"), "All filter");
await settle();

console.log("\nStats tab");
await click(byText(".tabbar__btn", "Stats"), "Stats tab");
await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
check("stats header renders", text(".appbar__title") === "Stats", `got "${text(".appbar__title")}"`);
check("month total shown", text(".hero__amount") === "₹1,25,700", `got "${text(".hero__amount")}"`);
check("category breakdown rendered", $$(".bd-row").length === 2, `${$$(".bd-row").length} rows`);
check("donut centre shows a compact total", text(".donut__value") === "₹1.3L", `got "${text(".donut__value")}"`);
check("donut slices drawn", $$(".recharts-sector").length === 2, `${$$(".recharts-sector").length} sectors`);
check("daily bars drawn", $$(".recharts-bar-rectangle").length > 0, `${$$(".recharts-bar-rectangle").length} bars`);
check("month axis labelled", $$(".recharts-cartesian-axis-tick").length > 0, `${$$(".recharts-cartesian-axis-tick").length} ticks`);

console.log("\nSettings tab");
await click(byText(".tabbar__btn", "Settings"), "Settings tab");
await settle();
check("settings header renders", text(".appbar__title") === "Settings", `got "${text(".appbar__title")}"`);
check("shows the recorded count", !!byText(".hstack", "Expenses recorded"));

await click(byText(".setting-row__label", "Monthly budget")?.closest("button"), "budget row");
await settle();
check("opens the budget sheet", text(".sheet__title") === "Monthly budget", `got "${text(".sheet__title")}"`);
await click(byText(".chip", "₹20,000"), "₹20,000 preset");
await click($(".sheet__foot .btn--primary"), "Save budget");
await settle();

await click(byText(".tabbar__btn", "Home"), "Home tab");
await settle();
check("budget bar appears on Home", !!$(".budget__track"));
check("over-budget warning shows", text(".budget__meta").includes("over budget"), `got "${text(".budget__meta")}"`);

console.log("\nTheme switch");
await click(byText(".tabbar__btn", "Settings"), "Settings tab");
await settle();
await click(byText(".seg__btn", "Dark"), "Dark theme");
await settle();
check("dark theme applied to <html>", document.documentElement.getAttribute("data-theme") === "dark");

console.log("\nReload (persistence)");
await act(async () => root.unmount());
const root2 = createRoot(document.getElementById("root"));
await act(async () => {
  root2.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
});
await settle();
check("expenses survive a reload", $$(".row").length === 2, `${$$(".row").length} rows`);
check("total survives a reload", text(".hero__amount") === "₹1,25,700", `got "${text(".hero__amount")}"`);
check("budget survives a reload", !!$(".budget__track"));
check("theme survives a reload", document.documentElement.getAttribute("data-theme") === "dark");


console.log("");
console.log("Legacy key migration");
await act(async () => root2.unmount());
localStorage.removeItem("rozkharcha.v1");
localStorage.setItem(
  "track.v1",
  JSON.stringify({
    version: 1,
    settings: { currency: "₹", monthlyBudget: 0, theme: "system" },
    expenses: [
      { id: "legacy-1", amount: 99, categoryId: "travel", note: "Old auto fare",
        date: todayKey(), paymentMode: "cash", createdAt: "x", updatedAt: "x" },
    ],
  }),
);
const root3 = createRoot(document.getElementById("root"));
await act(async () => {
  root3.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
});
await settle();
check("data saved under the old name still loads", !!byText(".row__title", "Old auto fare"));
check("it moved to the new key", (localStorage.getItem("rozkharcha.v1") ?? "").includes("Old auto fare"));
check("the old key is cleaned up", localStorage.getItem("track.v1") === null);
console.log(`\n${checks - failures}/${checks} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
