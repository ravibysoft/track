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

let reduceMotion = true;

window.matchMedia = (query) => ({

  // Reduced motion so count-up animations resolve instantly and assertions are

  // not racing a 520ms tween. Every other query stays false.

  matches: /prefers-reduced-motion/.test(query) && reduceMotion,

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

globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);

globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

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

const { currentMonthKey, dayLabel, monthDays, monthLabel, shiftMonth, toKey, todayKey } = await import("../src/lib/dates.js");



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

check("CSV has a header row", csv.includes("Date,Type,Category,Note,Paid by,Amount"));

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

check("lands on Home", text(".home__app") === "Roz Kharcha", `got "${text(".home__app")}"`);
check("starts at ₹0 spent", $$(".balance__statValue")[1]?.textContent.trim() === "₹0", `got "${$$(".balance__statValue")[1]?.textContent.trim()}"`);

check("shows the empty state", text(".home__empty").includes("Nothing yet"), `got "${text(".home__empty")}"`);
check("bottom bar has four tabs plus Add", $$(".tabbar__btn").length === 4 && !!$(".tabbar__add"), `${$$(".tabbar__btn").length} tabs`);


console.log("\nAdd an expense");

await click($(".tabbar__add"), "Add button");

await settle();

check("opens the add sheet", text(".page__title") === "Add expense", `got "${text(".page__title")}"`);

check("Add button starts disabled", $(".page__foot .btn--primary")?.disabled === true);

check("amount is a real input, so the phone keyboard opens", $(".form-row--amount input")?.tagName === "INPUT");
check("it asks for the numeric keyboard", $(".form-row--amount input")?.getAttribute("inputmode") === "decimal", `got "${$(".form-row--amount input")?.getAttribute("inputmode")}"`);
check("it is focused on open so the keyboard is already up", document.activeElement === $(".form-row--amount input"));
check("no in-app keypad is rendered", $$(".keypad__key").length === 0);

/* Repeat is offered where the amount is already being typed, which is the only
   moment the rent's details are in front of you. */
check("adding offers a repeat", !!byText(".chip", "Every month") && !!byText(".chip", "Every week"));

check("it starts at just once", byText(".chip", "Just once")?.getAttribute("aria-pressed") === "true");

/* The date input is transparent by design, so assert the row is a real picker
   and that it advertises itself — it once looked like plain text. */
check("the date row is a real date picker", $('.date-row input[type="date"]')?.type === "date");
check("it can reach any past date, not just Today/Yesterday", !$('.date-row input[type="date"]')?.min);
check("future dates are blocked", !!$('.date-row input[type="date"]')?.max);
check("the row shows it is tappable", !!$(".date-row__affordance"));
check("it names an absolute date with the weekday", /,/.test(text(".date-row .form-row__value")), `got "${text(".date-row .form-row__value")}"`);


await type($(".form-row--amount input"), "250.50");
await click(byText(".cat-option", "Food"), "Food category");

await type($('input[aria-label="Note"]'), "Lunch at office");

await settle();

check("Add button enables once an amount is typed", $(".page__foot .btn--primary")?.disabled === false);



await click($(".page__foot .btn--primary"), "Add expense");

await settle();



check("expense appears in today's list", $$(".row").length === 1, `${$$(".row").length} rows`);

check("row shows the note", text(".row__title") === "Lunch at office", `got "${text(".row__title")}"`);

check("row shows a signed expense", text(".row__amount") === "−₹250.50", `got "${text(".row__amount")}"`);

check("today's total updates", $$(".balance__statValue")[1]?.textContent.trim() === "₹250.50", `got "${$$(".balance__statValue")[1]?.textContent.trim()}"`);

check("confirmation toast shows", text(".snackbar").includes("Expense added"));

check("persisted to storage", (localStorage.getItem("rozkharcha.v1") ?? "").includes("Lunch at office"));



console.log("\nIndian digit grouping");

await click($(".tabbar__add"), "Add button");

await settle();

await type($(".form-row--amount input"), "125400");
await click(byText(".cat-option", "Shopping"), "Shopping category");

await settle();

check("previews ₹1,25,400 (en-IN grouping)", text(".amount-input__echo") === "₹1,25,400", `got "${text(".amount-input__echo")}"`);
await click($(".page__foot .btn--primary"), "Add expense");

await settle();

check("two expenses now listed", $$(".row").length === 2, `${$$(".row").length} rows`);

check("total is ₹1,25,650.50", $$(".balance__statValue")[1]?.textContent.trim() === "₹1,25,650.50", `got "${$$(".balance__statValue")[1]?.textContent.trim()}"`);



console.log("\nEdit an expense");

await click(byText(".row", "Lunch at office"), "Lunch row");

await settle();

check("opens the edit sheet", text(".page__title") === "Edit expense", `got "${text(".page__title")}"`);

/* Not offered while editing: it would be unclear whether you meant this entry or
   every future one, and either answer would surprise somebody. */
check("editing does not offer a repeat", !byText(".chip", "Every month"));


check("prefills the amount", $(".form-row--amount input")?.value === "250.5", `got "${$(".form-row--amount input")?.value}"`);
await type($(".form-row--amount input"), "300");
await click($(".page__foot .btn--primary"), "Save changes");

await settle();

check("edited amount shows in the list", !!byText(".row__amount", "₹300"));

check("total recalculates", $$(".balance__statValue")[1]?.textContent.trim() === "₹1,25,700", `got "${$$(".balance__statValue")[1]?.textContent.trim()}"`);

/* Only expenses logged, no income, no budget. Showing income − expense here would
   put a large minus number under the word "balance" — the headline has to mean
   something for a user who never records income. */
check("expenses-only never shows a negative balance", !text(".balance__value").includes("-") && !text(".balance__value").includes("−"), `got "${text(".balance__value")}"`);
check("expenses-only headline says what the number is", text(".balance__label") === "Spent this month", `got "${text(".balance__label")}"`);



console.log("\nHold to delete");

/* Holding a row deletes it. A gesture that fires with no warning is a trap, so
   the row has to show the hold building — and cancel cleanly when you let go. */
{
  const row = $$(".row")[0];
  const press = (type, y = 10) =>
    act(async () => {
      row.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: 10, clientY: y }));
    });

  await press("pointerdown");

  check("holding a row shows it filling", row.className.includes("is-holding"));

  await press("pointerup");

  check("letting go cancels the fill", !row.className.includes("is-holding"));

  /* A finger that travels is scrolling the list, not holding a row. */
  await press("pointerdown");

  await press("pointermove", 60);

  check("scrolling off the row cancels it too", !row.className.includes("is-holding"));

  await press("pointerup");

  check("and nothing was deleted by any of that", $$(".row").length === 2, `${$$(".row").length} rows`);
}


console.log("\nDelete + undo");

await click(byText(".row", "Lunch at office"), "Lunch row");

await settle();

await click($(".page__bar .icon-btn[aria-label=\"Delete expense\"]"), "Delete");

await settle();

check("expense removed", $$(".row").length === 1, `${$$(".row").length} rows`);

check("undo offered", text(".snackbar").includes("Expense deleted"));

await click($(".snackbar__action"), "Undo");

await settle();

check("undo restores it", $$(".row").length === 2, `${$$(".row").length} rows`);



console.log("\nHistory tab");

await click(byText(".tabbar__btn", "Trans."), "Trans. tab");

await settle();

check("period bar shows the month", /\d{4}/.test(text(".period-bar__label")), `got "${text(".period-bar__label")}"`);
check("Daily / Calendar / Monthly / Total tabs render", $$(".tabstrip__tab").length === 4, `${$$(".tabstrip__tab").length} tabs`);
check("Daily is the tab you land on", byText(".tabstrip__tab", "Daily")?.className.includes("is-active"));
check("income / expenses / total summary is always on screen", $$(".summary-bar__col").length === 3);
check("groups under a day heading", text(".day-head__label") === "Today", `got "${text(".day-head__label")}"`);

check("day subtotal shown", text(".day-head__total") === "₹1,25,700", `got "${text(".day-head__total")}"`);

check("both expenses listed", $$(".row").length === 2, `${$$(".row").length} rows`);



check("search box is hidden until asked for", !$(".search-bar"));
await click($('.period-bar .icon-btn[aria-label="Search"]'), "search icon");
await settle();
check("the search icon reveals the box", !!$(".search-bar"));
await type($('.search-bar input'), "lunch");

await settle();

check("search filters to one row", $$(".row").length === 1, `${$$(".row").length} rows`);

check("the search says how far it reached", /across all months/.test(text(".search-note")), `got "${text(".search-note")}"`);

/* The whole point of the search is that it leaves the month behind: the entry you
   are hunting for is the one whose month you cannot remember. Stepping back to an
   empty month must not hide a match that is still in view. */
await click($('.period-bar .icon-btn[aria-label="Previous"]'), "previous month");

await settle();

check("a search still finds entries from other months", $$(".row").length === 1, `${$$(".row").length} rows`);

/* And that step has to be undoable without counting months back. */
check("wandering off shows a Today pill", !!byText(".pill", "Today"));

await click(byText(".pill", "Today"), "Today pill");

await settle();

check("Today returns to this month", text(".period-bar__label") === monthLabel(currentMonthKey()), `got "${text(".period-bar__label")}"`);

check("and the pill retires once there is nowhere to go", !byText(".pill", "Today"));


await click($('.period-bar .icon-btn[aria-label="Close search"]'), "close search");
await settle();

check("closing search clears the filter and hides the box", !$(".search-bar") && $$(".row").length === 2, `${$$(".row").length} rows`);


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

check("donut slices drawn", $$(".donut__slice").length === 2, `${$$(".donut__slice").length} slices`);

/* Every slice must carry a real arc. An empty `d` draws nothing but would still
   satisfy a count, which is exactly how a broken arc formula would slip past. */
check("each slice has an arc path", $$(".donut__slice").every((p) => (p.getAttribute("d") ?? "").length > 20));

check("a bar per day of the month", $$(".bars__col").length === monthDays(todayKey().slice(0, 7)).length, `${$$(".bars__col").length} bars`);

check("the axis labels every fifth day", $$(".bars__label").map((l) => l.textContent).filter(Boolean).join(",") === "1,6,11,16,21,26,31".split(",").filter((d) => Number(d) <= $$(".bars__col").length).join(","), $$(".bars__label").map((l) => l.textContent).filter(Boolean).join(","));

check("bars announce their own value", /₹/.test($$(".bars__col")[0]?.getAttribute("aria-label") ?? ""), $$(".bars__col")[0]?.getAttribute("aria-label"));

/* Tapping is the only way to read a value on a phone — there is no hover — so
   the read-out has to follow the tap. */
await click($$(".bars__col")[0], "the first bar");

check("tapping a bar reports the day and amount", /₹/.test(text(".section-head__note")), `got "${text(".section-head__note")}"`);

check("exactly one bar reads as selected", $$(".bars__col.is-active").length === 1, `${$$(".bars__col.is-active").length} active`);

/* A tapped slice answers in the middle of the donut, where the total sits — the
   centre *is* the tooltip, so it has to give the category back and then let go. */
await click($$(".donut__slice")[0], "a slice");

check("tapping a slice names its category", text(".donut__label") !== "Spent", `got "${text(".donut__label")}"`);

check("tapping a slice shows its share", /% of spending/.test(text(".donut__share")), `got "${text(".donut__share")}"`);

await click($$(".donut__slice")[0], "the same slice again");

check("tapping it again returns to the total", text(".donut__label") === "Spent", `got "${text(".donut__label")}"`);



console.log("\nSettings tab");

await click(byText(".tabbar__btn", "Home"), "Home tab");
await settle();
await click($('.home__bar .icon-btn[aria-label="Settings"]'), "Settings gear");

await settle();

check("settings header renders", text(".appbar__title") === "Settings", `got "${text(".appbar__title")}"`);

check("settings still opens", text(".appbar__title") === "Settings", `got "${text(".appbar__title")}"`);



await click(byText(".setting-row__label", "Monthly budget")?.closest("button"), "budget row");

await settle();

check("opens the budget sheet", text(".sheet__title") === "Monthly budget", `got "${text(".sheet__title")}"`);
await click(byText(".chip", "₹20,000"), "₹20,000 preset");

await click($(".sheet__foot .btn--primary"), "Save budget");
await settle();



await click(byText(".tabbar__btn", "Trans."), "Trans. tab");

await settle();

await click(byText(".tabbar__btn", "Trans."), "Trans. tab");
await settle();
await click(byText(".tabstrip__tab", "Total"), "Total tab");
await settle();
check("budget bar appears on the Total tab", !!$(".budget__track"));
check("over-budget warning shows", text(".budget__meta").includes("over budget"), `got "${text(".budget__meta")}"`);


console.log("\nTheme switch");

await click(byText(".tabbar__btn", "Home"), "Home tab");
await settle();
await click($('.home__bar .icon-btn[aria-label="Settings"]'), "Settings gear");

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

check("total survives a reload", $$(".balance__statValue")[1]?.textContent.trim() === "₹1,25,700", `got "${$$(".balance__statValue")[1]?.textContent.trim()}"`);
await click(byText(".tabbar__btn", "Trans."), "Trans. tab");
await settle();

await click(byText(".tabstrip__tab", "Total"), "Total tab");
await settle();
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



console.log("");

console.log("Count-up animation");

reduceMotion = false;

const { default: AnimatedAmount } = await import("../src/components/AnimatedAmount.jsx");

const counterHost = document.createElement("div");

document.body.appendChild(counterHost);

const counterRoot = createRoot(counterHost);

await act(async () => {

  counterRoot.render(createElement(AnimatedAmount, { value: 1500, currency: "₹" }));

});

await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

const midway = counterHost.textContent.trim();

check("starts below the target rather than snapping", midway !== "₹1,500", `showed "${midway}" at 60ms`);

await act(async () => { await new Promise((r) => setTimeout(r, 900)); });

check("settles exactly on the target", counterHost.textContent.trim() === "₹1,500", `ended on "${counterHost.textContent.trim()}"`);

check("never shows stray paise on a whole amount", !/\.\d/.test(counterHost.textContent));

reduceMotion = true;



console.log("");

console.log("Row overflow guard");

/* jsdom has no layout, but it does run the cascade — enough to catch the real

   cause of the sideways-scrolling row: an inline box silently ignores overflow

   and text-overflow, so a long note could widen the screen. */

{

  const { readFileSync } = await import("node:fs");

  const sheet = readFileSync("src/styles/global.css", "utf8").replace(/@import[^;]+;/g, "");

  const cssDom = new JSDOM(

    `<!doctype html><html><head><style>${sheet}</style></head><body>` +

      `<button class="row"><span class="row__body">` +

      `<span class="row__title">x</span>` +

      `<span class="row__meta"><span>a</span></span></span>` +

      `<span class="row__amount">y</span></button></body></html>`,

  );

  const cssOf = (sel, prop) =>

    cssDom.window

      .getComputedStyle(cssDom.window.document.querySelector(sel))

      .getPropertyValue(prop);



  const titleDisplay = cssOf(".row__title", "display");

  check("note title is a block box, so overflow can apply", titleDisplay !== "inline", `display is "${titleDisplay}"`);

  check("note title clips rather than widening the row", cssOf(".row__title", "overflow") === "hidden");

  check("one unbroken word can still be broken", cssOf(".row__title", "overflow-wrap") === "anywhere");

  check("amount never wraps mid-number", cssOf(".row__amount", "white-space") === "nowrap");

  check("meta line truncates too", cssOf(".row__meta > span", "overflow") === "hidden");

}


console.log("");
console.log("Income entries");
{
  const dbm = await import("../src/lib/db.js");
  let doc = dbm.emptyDoc();
  doc = dbm.addExpense(doc, { type: "expense", amount: 400, categoryId: "food", date: todayKey() });
  doc = dbm.addExpense(doc, { type: "income", amount: 1000, categoryId: "salary", date: todayKey() });
  const t = dbm.totals(doc.expenses);
  check("spending and income are counted apart", t.expense === 400 && t.income === 1000, JSON.stringify(t));
  check("balance is income minus spending", t.net === 600, `got ${t.net}`);
  check("the category donut ignores income", dbm.byCategory(doc.expenses, "expense").length === 1);
  check("the daily bars ignore income", dbm.dailyTotals(doc.expenses, [todayKey()])[0].amount === 400);

  // A salary row saved with a spending category would render with the wrong icon.
  const crossed = dbm.migrate({ expenses: [{ amount: 50, type: "income", categoryId: "food", date: todayKey() }] });
  check("a mismatched category falls back to that type", crossed.expenses[0].categoryId === "salary", crossed.expenses[0].categoryId);

  const legacy = dbm.migrate({ expenses: [{ amount: 99, categoryId: "food", date: todayKey() }] });
  check("rows saved before income existed read as expenses", legacy.expenses[0].type === "expense");
}

console.log("");
console.log("Income + calendar in the UI");
{
  // The migration section left its root mounted; without unmounting it every
  // document.querySelector below would hit *that* tree instead of this one.
  await act(async () => root3.unmount());
  localStorage.removeItem("rozkharcha.v1");
  localStorage.removeItem("track.v1");
  // A fresh container: re-using #root would warn about calling createRoot twice.
  const uiHost = document.createElement("div");
  document.body.appendChild(uiHost);
  const uiRoot = createRoot(uiHost);
  await act(async () => {
    uiRoot.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
  });
  await settle();

  await click($(".tabbar__add"), "Add button");
  await settle();
  await click(byText(".seg__btn", "Income"), "Income toggle");
  await settle();
  check("the sheet becomes an income sheet", text(".page__title") === "Add income", `got "${text(".page__title")}"`);
  check("income categories replace expense ones", !!byText(".cat-option", "Salary"));
  check("expense categories are gone", !byText(".cat-option", "Groceries"));

  await type($(".form-row--amount input"), "5000");
  await click(byText(".cat-option", "Salary"), "Salary");
  await click($(".page__foot .btn"), "Add income");
  await settle();

  check("income row reads +green", $(".row__amount")?.className.includes("row__amount--income") && text(".row__amount").startsWith("+"), `got "${text(".row__amount")}"`);
  const ledger = [
    $$(".balance__statValue")[0]?.textContent.trim(),
    $$(".balance__statValue")[1]?.textContent.trim(),
    text(".balance__value"),
  ];
  check("ledger shows the income", ledger[0] === "₹5,000", `got ${JSON.stringify(ledger)}`);
  check("ledger balance equals the income", ledger[2] === "₹5,000", `got ${JSON.stringify(ledger)}`);
  check("income does not count as spending", $$(".balance__statValue")[1]?.textContent.trim() === "₹0", `got "${$$(".balance__statValue")[1]?.textContent.trim()}"`);

  await click(byText(".tabbar__btn", "Trans."), "Trans. tab");
  await settle();
  await click(byText(".tabstrip__tab", "Calendar"), "Calendar tab");
  await settle();
  check("calendar grid renders", $$(".calendar__cell").length >= 28, `${$$(".calendar__cell").length} cells`);
  check("weekday headers render", $$(".calendar__weekday").length === 7);
  const todayCell = $$(".calendar__cell").find((c) => c.className.includes("is-today"));
  check("today is marked on the calendar", !!todayCell);
  check("today shows the income amount", !!todayCell?.querySelector(".calendar__amount--income"), `got "${todayCell?.textContent}"`);

  await click(todayCell, "today cell");
  await settle();
  check("tapping a day filters to it", $$(".row").length === 1, `${$$(".row").length} rows`);
  await act(async () => uiRoot.unmount());
}

console.log("");
console.log("Sample data file");
/* The shipped sample must survive the app's own validation — otherwise a schema
   change could quietly leave a demo file that drops half its rows on import. */
{
  const { readFileSync } = await import("node:fs");
  const dbm = await import("../src/lib/db.js");
  const { shiftSampleToToday } = await import("../src/lib/devSample.js");
  const rawSample = JSON.parse(readFileSync("samples/sample-data.json", "utf8"));
  const migrated = dbm.migrate(rawSample);
  /* The loader slides the file forward before seeding it, so what the app sees is
     the shifted doc — that, not the file on disk, is what these checks must hold
     for. Asserting on the raw file instead would fail a day after generating it. */
  const seeded = shiftSampleToToday(migrated);

  check("sample file parses as a backup", Array.isArray(rawSample.expenses) && rawSample.expenses.length > 100, `${rawSample.expenses.length} entries`);
  check("no entry is dropped by validation", migrated.expenses.length === rawSample.expenses.length, `${rawSample.expenses.length} in, ${migrated.expenses.length} out`);
  check("it carries both income and spending", dbm.earned(migrated.expenses) > 0 && dbm.spent(migrated.expenses) > 0);
  check("every category survives intact", migrated.expenses.every((e, i) => e.categoryId === rawSample.expenses[i].categoryId));
  check("it spans more than one month", new Set(seeded.expenses.map((e) => e.date.slice(0, 7))).size >= 3);
  check("shifting keeps every entry", seeded.expenses.length === migrated.expenses.length);
  check("shifting preserves the gaps between entries", (() => {
    const gap = (list) => list.map((e) => e.date).sort().map((d, i, a) => (i ? Date.parse(d) - Date.parse(a[i - 1]) : 0));
    return String(gap(seeded.expenses)) === String(gap(migrated.expenses));
  })());
  check("it reaches today, so Daily is never empty", seeded.expenses.some((e) => e.date === todayKey()));
  check("nothing lands in the future", seeded.expenses.every((e) => e.date <= todayKey()));
  check("a budget is set, so the Total tab has a bar", seeded.settings.monthlyBudget > 0);
}

console.log("");
console.log("");
console.log("Custom categories");
/* The category list belongs to the document, so it has to survive a backup, keep
   old entries readable, and never let a rename or a delete quietly rewrite what
   an entry said. */
{
  const cats = await import("../src/lib/categories.js");
  const dbm = await import("../src/lib/db.js");

  const custom = {
    id: "c-rent-x1y2",
    label: "House rent",
    color: "var(--c-bills)",
    icon: "home",
    kind: "expense",
    hidden: false,
  };

  const list = cats.normalizeCategories([...cats.defaultCategories(), custom]);
  check("a custom category joins the list", list.some((c) => c.id === custom.id));
  check("the built-ins are still all there", cats.BUILT_IN_CATEGORIES.every((b) => list.some((c) => c.id === b.id)));

  /* A backup written before a built-in existed must not lose it. */
  const short = cats.normalizeCategories([{ id: "food", label: "Khana" }]);
  check("a renamed built-in keeps its id", short.find((c) => c.id === "food")?.label === "Khana");
  check("built-ins missing from a backup are put back", short.length === cats.BUILT_IN_CATEGORIES.length, `${short.length} categories`);

  check("rubbish in the list is dropped, not rendered", cats.normalizeCategories([null, 7, { label: "no id" }]).length === cats.BUILT_IN_CATEGORIES.length);

  cats.setCategoryRegistry(list);
  check("the picker offers the custom category", cats.categoriesFor("expense").some((c) => c.id === custom.id));
  check("it draws with its own icon and colour", cats.getCategory(custom.id).icon === "home" && cats.getCategory(custom.id).color === "var(--c-bills)");

  /* Hiding is the reversible half of the pair: out of the picker, still readable. */
  cats.setCategoryRegistry(list.map((c) => (c.id === custom.id ? { ...c, hidden: true } : c)));
  check("hiding takes it out of the picker", !cats.categoriesFor("expense").some((c) => c.id === custom.id));
  check("but a hidden category still renders its own name", cats.getCategory(custom.id).label === "House rent");

  /* Deleting is the destructive half, and the entries outlive it. */
  cats.setCategoryRegistry(cats.defaultCategories());
  check("a deleted category leaves the entry's id alone", cats.getCategory(custom.id).id === custom.id);
  check("and renders it neutrally rather than guessing", cats.getCategory(custom.id).label === "Other");

  const doc = dbm.migrate({
    settings: { categories: list },
    expenses: [
      { amount: 15000, categoryId: custom.id, type: "expense", date: todayKey() },
      /* An income entry filed under a spending category is corrupt data, and
         must not survive into the income breakdown. */
      { amount: 500, categoryId: "food", type: "income", date: todayKey() },
    ],
  });
  check("a backup carries its categories", doc.settings.categories.some((c) => c.id === custom.id));
  check("an entry keeps its custom category through a restore", doc.expenses[0].categoryId === custom.id, doc.expenses[0].categoryId);
  check("a category from the wrong side is corrected", doc.expenses[1].categoryId === "salary", doc.expenses[1].categoryId);

  /* A restore of an ancient backup has no categories at all. */
  const old = dbm.migrate({ expenses: [{ amount: 10, categoryId: "food", date: todayKey() }] });
  check("a backup with no category list still works", old.settings.categories.length === cats.BUILT_IN_CATEGORIES.length);
  check("and its entries keep their categories", old.expenses[0].categoryId === "food");

  cats.setCategoryRegistry(cats.defaultCategories());
}

console.log("");
console.log("Per-category budgets");
/* A single monthly figure hides the shape of a month, so a category can carry a
   limit of its own. It has to survive a backup, and never apply to income. */
{
  const cats = await import("../src/lib/categories.js");
  const { toneFor } = await import("../src/lib/budget.js");
  const dbm = await import("../src/lib/db.js");

  const withLimits = cats.normalizeCategories(
    cats.defaultCategories().map((c) => (c.id === "food" ? { ...c, budget: 4000 } : c)),
  );
  cats.setCategoryRegistry(withLimits);

  check("a category can carry its own limit", cats.getCategory("food").budget === 4000);
  check("only the ones with a limit are listed", cats.budgetedCategories().map((c) => c.id).join() === "food");
  check("a category with no limit reads as 0", cats.getCategory("travel").budget === 0);

  /* Nonsense must not become a limit — a negative or a word would render a bar
     that fills backwards or not at all. */
  const junk = cats.normalizeCategories([{ id: "food", budget: -50 }, { id: "travel", budget: "lots" }]);
  check("a negative limit is refused", junk.find((c) => c.id === "food").budget === 0);
  check("a limit that is not a number is refused", junk.find((c) => c.id === "travel").budget === 0);

  check("the bar is calm with room to spare", toneFor(0.4).key === "ok");
  check("it warns before the limit, not after", toneFor(0.85).key === "warn");
  check("and turns red once it is passed", toneFor(1.02).key === "over");

  const restored = dbm.migrate({ settings: { categories: withLimits }, expenses: [] });
  check("limits survive a backup", restored.settings.categories.find((c) => c.id === "food").budget === 4000);

  cats.setCategoryRegistry(cats.defaultCategories());
}

console.log("");
console.log("Repeating entries");
/* A rule posts real entries on the days they fall due. The dangerous mistakes
   are posting the rent twice, skipping a month while the phone was off, and
   letting a month-end date drift earlier and earlier. */
{
  const rec = await import("../src/lib/recurring.js");
  const dbm = await import("../src/lib/db.js");

  check("a month steps to the same day next month", rec.advance("2026-03-15", "month", 15) === "2026-04-15");
  check("a week steps seven days", rec.advance("2026-03-15", "week") === "2026-03-22");
  check("a year boundary is not special", rec.advance("2026-12-31", "month", 31) === "2027-01-31");

  /* The 31st has to survive February. Counting from the previous occurrence
     would strand it on the 28th for the rest of its life. */
  check("the 31st lands on the 28th in February", rec.advance("2026-01-31", "month", 31) === "2026-02-28");
  check("and climbs back to the 31st in March", rec.advance("2026-02-28", "month", 31) === "2026-03-31");
  check("February 29 exists in a leap year", rec.advance("2024-01-31", "month", 31) === "2024-02-29");

  const rule = rec.sanitizeRule({
    type: "expense", amount: 18000, categoryId: "bills", note: "Rent",
    paymentMode: "upi", every: "month", anchorDay: 5, nextDate: "2026-01-05",
  });
  check("a well-formed rule is accepted", !!rule);
  check("a rule with no frequency is refused", rec.sanitizeRule({ ...rule, every: "fortnight" }) === null);
  check("a rule with no next date is refused", rec.sanitizeRule({ ...rule, nextDate: "soon" }) === null);
  check("a rule with no amount is refused", rec.sanitizeRule({ ...rule, amount: 0 }) === null);

  /* Away for three months: all three are owed, each on its own date. */
  const behind = rec.collectDue([rule], "2026-03-20");
  check("a missed month is not skipped", behind.due.length === 3, `${behind.due.length} posted`);
  check("each lands on its own date", behind.due.map((d) => d.date).join() === "2026-01-05,2026-02-05,2026-03-05");
  check("the rule moves on past what it posted", behind.rules[0].nextDate === "2026-04-05");

  /* Opening the app again the same day must post nothing. */
  const again = rec.collectDue(behind.rules, "2026-03-20");
  check("a second look the same day posts nothing", again.due.length === 0);
  check("and leaves the rule untouched", again.rules === behind.rules);

  const paused = rec.collectDue([{ ...rule, paused: true }], "2026-06-01");
  check("a paused rule posts nothing", paused.due.length === 0);
  check("and does not quietly advance while paused", paused.rules[0].nextDate === rule.nextDate);

  /* A corrupt date must not generate thousands of entries. */
  const ancient = rec.collectDue([{ ...rule, nextDate: "1970-01-05" }], "2026-03-20");
  check("a nonsense start date is capped, not run to infinity", ancient.due.length <= 120, `${ancient.due.length} posted`);

  /* Through the document: posting, then restoring a backup taken before it. */
  const doc = dbm.migrate({ recurring: [rule], expenses: [] });
  check("rules survive a backup", doc.recurring.length === 1);

  const first = dbm.runRecurring(doc, "2026-02-10");
  check("the document gains the entries", first.added === 2, `${first.added} added`);
  check("they are ordinary entries", first.doc.expenses.every((e) => e.amount === 18000 && e.categoryId === "bills"));

  const second = dbm.runRecurring(first.doc, "2026-02-10");
  check("running it again adds nothing", second.added === 0);

  /* The real hazard: a backup written before the rent posted is restored after
     it did. The rule would be back at January while the entries already exist. */
  const rewound = { ...first.doc, recurring: [rule] };
  const replayed = dbm.runRecurring(rewound, "2026-02-10");
  check("a rewound rule does not post the rent twice", replayed.added === 0, `${replayed.added} duplicated`);
  check("and the entries that were there are still there", replayed.doc.expenses.length === 2);

  check("a monthly rule describes itself", rec.describeRule(rule) === "Every month on the 5th", rec.describeRule(rule));
  check("ordinals are not all 'th'", rec.describeRule({ ...rule, anchorDay: 1 }).endsWith("1st") && rec.describeRule({ ...rule, anchorDay: 22 }).endsWith("22nd"));
  check("the 11th is not the 11st", rec.describeRule({ ...rule, anchorDay: 11 }).endsWith("11th"));

  /* And the rule an entry implies starts *after* that entry, not on it. */
  const entry = dbm.buildEntry({ type: "expense", amount: 500, categoryId: "food", date: "2026-05-09" });
  const derived = rec.ruleFromEntry(entry, "month");
  check("the entry you just saved is not posted again", derived.nextDate === "2026-06-09", derived.nextDate);
  check("the derived rule copies what you typed", derived.amount === 500 && derived.categoryId === "food");
}

console.log("");
console.log("Automatic backup");
/* One snapshot a day into the public folder. The rules that matter: it never
   writes twice in a day, it never claims a file another phone wrote, and it
   never prunes anything it did not create. */
{
  const bk = await import("../src/lib/backup.js");
  const dbm = await import("../src/lib/db.js");

  check("automatic snapshots are named apart from manual ones", bk.autoFilename("2026-03-05") === "auto-2026-03-05.json");
  check("a manual export keeps its own name", !bk.jsonFilename().startsWith(bk.AUTO_PREFIX));

  /* Sorting by name has to sort by date, or pruning would delete the wrong week. */
  const names = ["auto-2026-01-09.json", "auto-2025-12-31.json", "auto-2026-01-10.json"];
  check("names sort oldest-first as plain strings", [...names].sort()[0] === "auto-2025-12-31.json");

  const doc = dbm.migrate({ expenses: [{ amount: 10, categoryId: "food", date: todayKey() }] });
  check("automatic backup is on unless turned off", doc.settings.autoBackup === true);
  check("turning it off is remembered", dbm.migrate({ settings: { autoBackup: false } }).settings.autoBackup === false);

  /* The day a snapshot was written must not ride along inside the backup: a file
     restored onto a different phone would claim a copy that phone never made,
     and skip today's. */
  const carried = dbm.migrate({ settings: { lastAutoBackup: "2026-01-01" }, expenses: [] });
  check("a restored backup cannot claim a snapshot it never wrote", carried.settings.lastAutoBackup === "");

  /* On the web there is no folder to write to, and a download prompt appearing
     by itself would be worse than nothing. */
  const web = await bk.runAutoBackup(doc, "");
  check("the web writes nothing on its own", web.written === false && web.reason === "web");

  check("today's snapshot is not written twice", (await bk.runAutoBackup(doc, todayKey())).written === false);
}

console.log("App shell (native feel)");
/* jsdom has no layout, but it does run the cascade — enough to prove the shell is
   fixed and the list scrolls inside it, rather than the whole document scrolling. */
{
  const { readFileSync } = await import("node:fs");
  const sheet = readFileSync("src/styles/global.css", "utf8").replace(/@import[^;]+;/g, "");
  const shellDom = new JSDOM(
    "<!doctype html><html><head><style>" + sheet + "</style></head><body>" +
      '<div class="app"><div class="screen screen--split">' +
      '<div class="screen__fixed"></div><div class="screen__scroll"></div>' +
      '</div></div><div class="screen"></div></body></html>'
  );
  const w = shellDom.window;
  const css = (sel, prop) =>
    w.getComputedStyle(w.document.querySelector(sel)).getPropertyValue(prop);

  check("the document itself does not scroll", css("body", "overflow") === "hidden", css("body", "overflow"));
  check("pull-to-refresh and edge bounce are off", css("body", "overscroll-behavior") === "none", css("body", "overscroll-behavior"));
  check("the app fills the viewport rather than growing", css(".app", "height") === "100dvh", css(".app", "height"));
  check("app chrome is not text-selectable", css(".app", "user-select") === "none", css(".app", "user-select"));
  check("a plain screen scrolls internally", css(".screen:not(.screen--split)", "overflow-y") === "auto");
  check("a split screen pins its header", css(".screen--split", "overflow") === "hidden");
  check("only the list area of a split screen scrolls", css(".screen__scroll", "overflow-y") === "auto");
  check("the pinned header does not scroll", css(".screen__fixed", "flex-grow") === "0");
}
console.log("");
console.log("Crash recovery");
/* Without a boundary, one throwing screen unmounts the whole tree and the app is
   a blank white page with no tab bar — unrecoverable on a phone. This proves the
   fallback renders instead, and that it offers a way out. */
{
  const ErrorBoundary = (await import("../src/components/ErrorBoundary.jsx")).default;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const boundaryRoot = createRoot(host);

  let explode = true;
  // eslint-disable-next-line react/only-export-components -- a fixture, not a screen
  const Maybe = () => {
    if (explode) throw new Error("kaboom");
    return createElement("p", { id: "fine" }, "ok");
  };

  // React logs the caught error; silence it so a passing run stays readable.
  const realError = console.error;
  console.error = () => {};
  await act(async () => {
    boundaryRoot.render(
      createElement(ErrorBoundary, { scope: "screen" }, createElement(Maybe)),
    );
  });
  console.error = realError;

  const fallback = host.querySelector(".crash");
  check("a throwing screen does not blank the app", !!fallback);
  check("the fallback says the data is safe", /safe/i.test(fallback?.textContent ?? ""));
  check(
    "it offers a way out",
    [...host.querySelectorAll("button")].some((b) => /reload/i.test(b.textContent)),
  );
  check("the error message is shown for diagnosis", /kaboom/.test(host.querySelector(".crash__detail")?.textContent ?? ""));

  /* "Try again" has to actually re-render the children, not just repaint the same
     fallback — otherwise a transient failure would strand the screen for good. A
     boundary that never renders children at all would pass the checks above. */
  explode = false;
  await click(
    [...host.querySelectorAll("button")].find((b) => /try again/i.test(b.textContent)),
    "Try again",
  );
  check("Try again re-renders the screen once it can work", !!host.querySelector("#fine"));
  check("the fallback goes away with it", !host.querySelector(".crash"));

  await act(async () => boundaryRoot.unmount());
  host.remove();
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);

process.exit(failures === 0 ? 0 : 1);

