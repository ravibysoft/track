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

/* With nothing coming in, "Spending or income?" has one answer, so the question
   is not asked. */
check("no side toggle when nothing was earned", $$(".seg--mini").length === 0);



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

console.log("Add page seals the screen behind it");

/* The gear now sits on every tab, so the add page is the only thing standing
   between it and a half-typed amount. It has to genuinely cover the screen —
   a transparent overlay would leave the button underneath tappable. */
{
  const { readFileSync } = await import("node:fs");

  const sheet = readFileSync("src/styles/parts.css", "utf8").replace(/@import[^;]+;/g, "");

  const pageDom = new JSDOM(
    `<!doctype html><html><head><style>${sheet}</style></head><body>` +
      `<div class="page"><header class="page__bar"></header></div>` +
      `</body></html>`,
  );

  const pageCss = (prop) =>
    pageDom.window
      .getComputedStyle(pageDom.window.document.querySelector(".page"))
      .getPropertyValue(prop);

  check("the add page is fixed over the app", pageCss("position") === "fixed", `got "${pageCss("position")}"`);

  check("it fills the viewport", pageCss("inset") === "0px" || pageCss("top") === "0px", `inset "${pageCss("inset")}" top "${pageCss("top")}"`);

  /* Read from the rule rather than the computed value: the fixture has no
     tokens.css, so `var(--bg)` resolves to nothing here even though it paints
     solid in the app. What matters is that a background is declared at all. */
  const pageRule = [...pageDom.window.document.styleSheets[0].cssRules].find(
    (r) => r.selectorText === ".page",
  );

  const declaredBg = pageRule?.style.getPropertyValue("background") || pageRule?.style.getPropertyValue("background-color");

  check("it is opaque, not see-through", !!declaredBg && !/transparent|^none$/.test(declaredBg), `declared "${declaredBg}"`);

  check("and it sits above the tab bar", Number(pageCss("z-index")) > 25, `z-index ${pageCss("z-index")}`);
}

console.log("Home button labels");

/* The two Home buttons share one row, so each label has half a phone. "Add
   expense" once broke after "Add" and read as two buttons stacked. The labels
   must not wrap; the type size gives way instead. */
{
  const { readFileSync } = await import("node:fs");

  const sheet = readFileSync("src/styles/parts.css", "utf8").replace(/@import[^;]+;/g, "");

  const btnDom = new JSDOM(
    `<!doctype html><html><head><style>${sheet}</style></head><body>` +
      `<div class="home__actions">` +
      `<button class="btn btn--primary btn--lg grow">Add expense</button>` +
      `<button class="btn btn--ghost btn--lg grow">Add income</button>` +
      `</div>` +
      `<button class="btn btn--ghost btn--block">A much longer label elsewhere</button>` +
      `</body></html>`,
  );

  const btnCss = (sel, prop) =>
    btnDom.window
      .getComputedStyle(btnDom.window.document.querySelector(sel))
      .getPropertyValue(prop);

  check("the Home buttons never wrap their label", btnCss(".home__actions .btn", "white-space") === "nowrap", `got "${btnCss(".home__actions .btn", "white-space")}"`);

  /* Scoped on purpose. A blanket nowrap would push a long label out of a
     full-width button instead of letting it wrap, which is worse. */
  check("wrapping is still allowed elsewhere", btnCss(".btn--block", "white-space") !== "nowrap", `got "${btnCss(".btn--block", "white-space")}"`);

}

console.log("");

console.log("Dark mode");

/* A colour written straight into a rule cannot flip with the theme. Every one
   that matters lives in tokens.css, which defines it three times: light, the
   system-dark media query, and the forced [data-theme="dark"] block. Miss one
   and dark mode silently keeps a light value. */
{
  const { readFileSync } = await import("node:fs");

  const tokens = readFileSync("src/styles/tokens.css", "utf8");

  const blocks = [
    ["light", tokens.slice(0, tokens.indexOf("@media"))],
    ["system dark", tokens.slice(tokens.indexOf("@media"), tokens.lastIndexOf('[data-theme="dark"]'))],
    ["forced dark", tokens.slice(tokens.lastIndexOf('[data-theme="dark"]'))],
  ];

  /* These have to flip, because what they sit on flips. --on-ok is the ink for a
     solid --ok fill; the sun/moon badge is a pale wash in light and a deep tint
     in dark. */
  for (const token of ["--on-ok", "--sun-bg", "--sun-fg", "--moon-bg", "--moon-fg"]) {
    const missing = blocks.filter(([, css]) => !css.includes(token + ":")).map(([name]) => name);
    check(`${token} is defined for every theme`, missing.length === 0, `missing in: ${missing.join(", ")}`);
  }

  /* Only these four literals may live outside tokens.css, and each is deliberate:
     three sit on a surface that is dark in BOTH themes, and the scrim is a scrim. */
  const allowed = new Set(["rgba(6, 7, 12, 0.5)", "#f87171", "#fca5a5", "#fff"]);

  const literals = [];
  for (const file of ["src/styles/global.css", "src/styles/parts.css"]) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/(?:^|[:\s,(])(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g)) {
      if (!allowed.has(m[1])) literals.push(`${file}: ${m[1]}`);
    }
  }

  check("no new hardcoded colours outside tokens.css", literals.length === 0, literals.join(" · "));

  /* The two that were actually failing, so the fix cannot be quietly reverted. */
  const parts = readFileSync("src/styles/parts.css", "utf8");

  check("the income button takes its ink from a token", /\.btn--income\s*\{[^}]*color:\s*var\(--on-ok\)/.test(parts));

  check("a selected chip does not print white on a category colour", !/\.chip--cat\[aria-pressed="true"\]\s*\{[^}]*color:\s*#fff/.test(parts));
}

console.log("");

console.log("Your name");

/* Home greets you by a name you can change. It has to survive a reload and a
   backup, and never leave the greeting trailing an empty space. */
{
  const dbm = await import("../src/lib/db.js");

  check("it starts as the app's own name", dbm.emptyDoc().settings.name === dbm.APP_NAME, dbm.emptyDoc().settings.name);

  check("a name is trimmed", dbm.cleanName("  Ravi  ") === "Ravi");

  check("runs of spaces collapse", dbm.cleanName("Ravi   Kumar") === "Ravi Kumar", dbm.cleanName("Ravi   Kumar"));

  check("a very long name is capped", dbm.cleanName("R".repeat(200)).length === 24);

  /* Empty is not a name — the greeting would read "Good morning" and stop. */
  check("blank is refused", dbm.cleanName("   ") === null);

  check("so is a non-string", dbm.cleanName(42) === null && dbm.cleanName(undefined) === null);

  check("a saved name survives a reload", dbm.migrate({ settings: { name: "Ravi" } }).settings.name === "Ravi");

  check("a blank one falls back rather than greeting nobody", dbm.migrate({ settings: { name: "  " } }).settings.name === dbm.APP_NAME);

  check("an older backup with no name still opens", dbm.migrate({ expenses: [] }).settings.name === dbm.APP_NAME);

  const { buildJson: toJson } = await import("../src/lib/backup.js");

  check("the name travels in a backup", JSON.parse(toJson(dbm.migrate({ settings: { name: "Ravi" } }))).settings.name === "Ravi");
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

  /* Income only, no spending at all. The breakdown defaults to spending, so
     without a fallback this screen would draw an empty ring labelled "₹0". */
  await click(byText(".tabbar__btn", "Stats"), "Stats tab");

  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });

  check("a period with only income charts the income", text(".donut__label") === "Earned", `got "${text(".donut__label")}"`);

  check("and shows what came in, not a zero", text(".donut__value") === "₹5K", `got "${text(".donut__value")}"`);

  check("its categories are income categories", text(".bd-row__label") === "Salary", `got "${text(".bd-row__label")}"`);

  check("the side toggle is offered", $$(".seg--mini .seg__btn").length === 2, `${$$(".seg--mini .seg__btn").length} buttons`);

  check("and income reads as the selected side", byText(".seg--mini .seg__btn", "Income")?.getAttribute("aria-pressed") === "true");

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

console.log("Reordering categories");

/* The two kinds share one stored array, and a custom category added later sits
   *after* the income block in it. So a reorder cannot walk the array — it has to
   refill the slots this kind already occupies, wherever they are. */
{
  const cats = await import("../src/lib/categories.js");

  /* Exactly the shape the app produces after adding a custom category: eight
     spending, then all the income ones, then the new one on the end. */
  const stored = cats.normalizeCategories([
    ...cats.defaultCategories(),
    { id: "c-rent", label: "House rent", kind: "expense", icon: "home", color: "var(--c-bills)" },
  ]);

  const kinds = stored.map((c) => c.kind).join(",");
  check("the stored list really is interleaved", /income,expense$/.test(kinds), kinds);

  /* This is the reorder CategoriesPage performs. */
  const reorder = (all, kind, orderedIds) => {
    const byId = new Map(all.filter((c) => c.kind === kind).map((c) => [c.id, c]));
    let n = 0;
    return all.map((c) => (c.kind === kind ? byId.get(orderedIds[n++]) : c));
  };

  const spending = stored.filter((c) => c.kind === "expense").map((c) => c.id);
  const moved = [spending.at(-1), ...spending.slice(0, -1)];
  const next = reorder(stored, "expense", moved);

  check("the dragged category lands first", next.filter((c) => c.kind === "expense")[0].id === "c-rent");

  check("nothing is lost or duplicated", next.length === stored.length && new Set(next.map((c) => c.id)).size === stored.length);

  /* The whole point of refilling slots rather than splicing. */
  check("the income block is untouched", next.filter((c) => c.kind === "income").map((c) => c.id).join() === stored.filter((c) => c.kind === "income").map((c) => c.id).join());

  check("and every slot still holds its own kind", next.map((c) => c.kind).join(",") === kinds);

  /* Reordering one kind must leave the other's order alone even when dragged
     the other way. */
  const back = reorder(next, "expense", spending);
  check("reordering back restores the original order", back.map((c) => c.id).join() === stored.map((c) => c.id).join());

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

console.log("Editing a repeating rule");

/* Editing changes what happens next and nothing else. The schedule is the rule's
   memory of what it has already posted, so an edit must not touch it — and the
   entries it has posted are ordinary entries that stay exactly as recorded. */
{
  const rec = await import("../src/lib/recurring.js");

  const dbm = await import("../src/lib/db.js");

  const rule = rec.sanitizeRule({
    type: "expense", amount: 18000, categoryId: "bills", note: "Rent",
    paymentMode: "upi", every: "month", anchorDay: 5, nextDate: "2026-01-05",
  });

  let doc = dbm.migrate({ recurring: [rule], expenses: [] });

  const posted = dbm.runRecurring(doc, "2026-02-10");

  check("the rule posted January and February", posted.added === 2, `${posted.added} posted`);

  /* The rent goes up. */
  const edited = dbm.setRules(posted.doc, posted.doc.recurring.map((r) => ({ ...r, amount: 21000 })));

  check("the new amount is stored", edited.recurring[0].amount === 21000);

  check("the schedule is left where it was", edited.recurring[0].nextDate === posted.doc.recurring[0].nextDate, edited.recurring[0].nextDate);

  check("and so is the anchor day", edited.recurring[0].anchorDay === 5);

  /* The whole point: last year's rent really was lower. */
  check("entries already posted keep the old amount", edited.expenses.every((e) => e.amount === 18000), JSON.stringify(edited.expenses.map((e) => e.amount)));

  const after = dbm.runRecurring(edited, "2026-03-10");

  check("the next posting uses the new amount", after.doc.expenses.some((e) => e.amount === 21000));

  check("and it did not re-post what was already there", after.added === 1, `${after.added} posted`);

  /* Switching frequency must not rewind the schedule either. */
  const weekly = dbm.setRules(after.doc, after.doc.recurring.map((r) => ({ ...r, every: "week" })));

  check("changing the frequency keeps the next date", weekly.recurring[0].nextDate === after.doc.recurring[0].nextDate);

  check("but steps weekly from then on", rec.advance(weekly.recurring[0].nextDate, weekly.recurring[0].every, weekly.recurring[0].anchorDay) === rec.advance(weekly.recurring[0].nextDate, "week"));

  /* An edit that makes no sense must be refused rather than stored. */
  const broken = dbm.setRules(after.doc, after.doc.recurring.map((r) => ({ ...r, amount: 0 })));

  check("a zero amount is refused, not saved", broken.recurring.length === 0, `${broken.recurring.length} rules survived`);
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
  const carried = dbm.restoreDoc({ settings: { lastAutoBackup: "2026-01-01" }, expenses: [] });
  check("a restored backup cannot claim a snapshot it never wrote", carried.settings.lastAutoBackup === "");

  /* But reopening the app is not a restore. Wiping the day on every launch
     meant the "daily" copy was rewritten each time the app opened. */
  const reopened = dbm.migrate({ settings: { lastAutoBackup: "2026-01-01" }, expenses: [] });
  check("an ordinary relaunch remembers today's snapshot", reopened.settings.lastAutoBackup === "2026-01-01", `got "${reopened.settings.lastAutoBackup}"`);

  check("a malformed snapshot day is not trusted", dbm.migrate({ settings: { lastAutoBackup: "yesterday" } }).settings.lastAutoBackup === "");

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
console.log("");

console.log("");

console.log("Empty states");

/* An empty screen that only explains itself leaves you to find your own way out.
   Where there is an obvious next step it is offered right there — except while
   searching, when "add an entry" would answer a question nobody asked. */
{
  localStorage.removeItem("rozkharcha.v1");

  localStorage.removeItem("track.v1");

  const emptyHost = document.createElement("div");

  document.body.appendChild(emptyHost);

  const emptyRoot = createRoot(emptyHost);

  await act(async () => {
    emptyRoot.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
  });

  await settle();

  await click([...emptyHost.querySelectorAll(".tabbar__btn")].find((b) => b.textContent.includes("Trans.")), "Trans. tab");

  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });

  const empty = emptyHost.querySelector(".empty");

  check("an empty month says so", !!empty);

  /* Not "No data available" — that is the language of a database, not of a
     notebook you keep your own spending in. */
  check("it does not talk like a database", !/no data available/i.test(empty?.textContent ?? ""), `got "${empty?.textContent?.slice(0, 40)}"`);

  check("it draws something, not a bare glyph", !!emptyHost.querySelector(".art"));

  check("the art carries the currency in use", emptyHost.querySelector(".art__glyph")?.textContent === "₹", `got "${emptyHost.querySelector(".art__glyph")?.textContent}"`);

  const addBtn = emptyHost.querySelector(".empty__action .btn");

  check("and it offers the way out", !!addBtn, "no action button");

  await click(addBtn, "Add an entry");

  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });

  check("which opens the add page", emptyHost.querySelector(".page__title")?.textContent === "Add expense", `got "${emptyHost.querySelector(".page__title")?.textContent}"`);

  await click(emptyHost.querySelector(".page__bar .icon-btn"), "Back");

  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });

  /* A search that finds nothing is a different kind of empty: the answer is a
     different query, not a new entry. */
  await click(emptyHost.querySelector('.period-bar .icon-btn[aria-label="Search"]'), "search");

  await act(async () => { await new Promise((r) => setTimeout(r, 300)); });

  await type(emptyHost.querySelector(".search-bar input"), "zzzznothing");

  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });

  check("a fruitless search still shows an empty state", !!emptyHost.querySelector(".empty"));

  check("but does not offer to add one", !emptyHost.querySelector(".empty__action"), "action offered while searching");

  await act(async () => emptyRoot.unmount());

  emptyHost.remove();
}


console.log("Settings is reachable everywhere");

/* The gear belongs on every tab, so Settings is never more than one tap away —
   but not on the add page, where the only way out should be Back or Save. */
{
  const gearHost = document.createElement("div");

  document.body.appendChild(gearHost);

  const gearRoot = createRoot(gearHost);

  await act(async () => {
    gearRoot.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
  });

  await settle();

  const gearsIn = (root) => [...root.querySelectorAll('[aria-label="Settings"]')].length;

  const tab = async (name) => {
    await click([...gearHost.querySelectorAll(".tabbar__btn")].find((b) => b.textContent.includes(name)), name);
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
  };

  check("Home has it", gearsIn(gearHost) === 1);

  await tab("Trans.");

  check("Trans. has it", gearsIn(gearHost) === 1, `${gearsIn(gearHost)} found`);

  await tab("Backup");

  check("Backup has it", gearsIn(gearHost) === 1, `${gearsIn(gearHost)} found`);

  await tab("Stats");

  check("Stats has it", gearsIn(gearHost) === 1, `${gearsIn(gearHost)} found`);

  /* Settings itself obviously does not need a way back to Settings. */
  await click(gearHost.querySelector('[aria-label="Settings"]'), "the gear");

  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });

  check("tapping it opens Settings", gearHost.querySelector(".appbar__title")?.textContent === "Settings", `got "${gearHost.querySelector(".appbar__title")?.textContent}"`);

  check("and Settings does not offer itself", gearsIn(gearHost) === 0, `${gearsIn(gearHost)} found`);

  /* The add page is a full-screen overlay. It must not carry a gear of its own,
     and the one on the screen behind must be sealed under it. */
  await tab("Trans.");

  await click(gearHost.querySelector(".tabbar__add"), "Add");

  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });

  const addPage = gearHost.querySelector(".page");

  check("the add page opened", addPage?.querySelector(".page__title")?.textContent === "Add expense", `got "${addPage?.querySelector(".page__title")?.textContent}"`);

  check("the add page has no gear of its own", gearsIn(addPage) === 0, `${gearsIn(addPage)} found`);

  await act(async () => gearRoot.unmount());

  gearHost.remove();
}


console.log("Currencies");

/* The symbol and the grouping have to move together: a dollar amount printed in
   lakhs would be unreadable to the people who count in dollars. */
{
  const m = await import("../src/lib/money.js");

  check("rupees keep lakh grouping", m.formatMoney(125400, "₹") === "₹1,25,400", m.formatMoney(125400, "₹"));
  check("dollars group in thousands", m.formatMoney(125400, "$") === "$125,400", m.formatMoney(125400, "$"));
  check("euros too", m.formatMoney(1234567.5, "€") === "€1,234,567.50", m.formatMoney(1234567.5, "€"));
  check("taka counts in lakhs like rupees", m.formatMoney(125400, "৳") === "৳1,25,400", m.formatMoney(125400, "৳"));
  check("compact rupees use L and Cr", m.formatCompact(250000, "₹") === "₹2.5L" && m.formatCompact(30000000, "₹") === "₹3Cr");
  check("compact dollars use M, never L", m.formatCompact(2500000, "$") === "$2.5M", m.formatCompact(2500000, "$"));
  check("a code-style symbol keeps its space", m.formatMoney(500, "AED ") === "AED 500", m.formatMoney(500, "AED "));
  check("an unknown symbol still formats", m.formatMoney(1500, "CHF ") === "CHF 1,500", m.formatMoney(1500, "CHF "));
}

console.log("");

console.log("Add again");

/* Offer back what someone keeps typing in — but only real habits, not every
   lunch they ever had. */
{
  const dbm = await import("../src/lib/db.js");

  const today = "2026-09-18";
  const e = (date, note, amount, extra = {}) => ({
    id: `${date}-${note}-${amount}-${Math.random()}`,
    type: "expense",
    categoryId: "food",
    paymentMode: "upi",
    createdAt: `${date}T10:00:00.000Z`,
    date,
    note,
    amount,
    ...extra,
  });

  const list = [
    e("2026-09-17", "Chai", 20),
    e("2026-09-16", "chai ", 20, { paymentMode: "cash" }),
    e("2026-09-15", "Chai", 20),
    e("2026-09-14", "Auto", 40, { categoryId: "travel" }),
    e("2026-09-10", "Auto", 40, { categoryId: "travel" }),
    e("2026-09-12", "Birthday dinner", 1800),
    // A habit that stopped long ago is not a habit any more.
    e("2026-06-01", "Gym", 500),
    e("2026-06-02", "Gym", 500),
  ];

  const offered = dbm.frequentEntries(list, today);

  check("repeated entries are offered", offered.length === 2, JSON.stringify(offered.map((o) => o.note)));
  check("the most frequent comes first", offered[0]?.note.toLowerCase() === "chai" && offered[0]?.count === 3);
  check("notes match case- and space-blind", offered[0]?.count === 3);
  check("a one-off is not offered", !offered.some((o) => o.note === "Birthday dinner"));
  check("an old habit is not offered", !offered.some((o) => o.note === "Gym"));
  check("the latest payment mode is carried", offered[0]?.paymentMode === "upi", offered[0]?.paymentMode);
  check("a different amount is a different habit", dbm.frequentEntries([...list, e("2026-09-17", "Chai", 25)], today)[0].amount === 20);

  /* Quick-add's Undo needs the id before the entry exists. */
  const doc = dbm.addExpense(dbm.migrate({}), { id: "known-id", amount: 20, categoryId: "food", date: today });
  check("an entry can be given its id up front", doc.expenses[0].id === "known-id");
  const again = dbm.addExpense(doc, { id: "known-id", amount: 30, categoryId: "food", date: today });
  check("but never one that is already taken", again.expenses[0].id !== "known-id" && again.expenses.length === 2);
}

console.log("");

console.log("Add again in the UI");

{
  const t = todayKey();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = toKey(d);
  localStorage.setItem(
    "rozkharcha.v1",
    JSON.stringify({
      settings: { onboarded: true },
      expenses: [
        { id: "a1", type: "expense", amount: 20, categoryId: "food", note: "Chai", paymentMode: "upi", date: y, createdAt: `${y}T09:00:00Z`, updatedAt: `${y}T09:00:00Z` },
        { id: "a2", type: "expense", amount: 20, categoryId: "food", note: "Chai", paymentMode: "upi", date: t, createdAt: `${t}T09:00:00Z`, updatedAt: `${t}T09:00:00Z` },
      ],
    }),
  );

  const qHost = document.createElement("div");
  document.body.appendChild(qHost);
  const qRoot = createRoot(qHost);
  await act(async () => {
    qRoot.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
  });
  await settle();

  const chip = qHost.querySelector(".quick__chip");
  check("Home offers the habit back", !!chip && /Chai/.test(chip.textContent), chip?.textContent);

  const before = qHost.querySelectorAll(".row").length;
  await click(chip, "Chai chip");
  await settle();

  const rows = qHost.querySelectorAll(".row").length;
  check("one tap adds it", rows === Math.min(before + 1, 5), `${before} → ${rows} rows`);
  check("dated today", JSON.parse(localStorage.getItem("rozkharcha.v1")).expenses.filter((x) => x.note === "Chai" && x.date === t).length === 2);
  check("and says so, with Undo", /Added Chai/.test(qHost.querySelector(".snackbar")?.textContent ?? document.body.textContent));

  const undo = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Undo");
  await click(undo, "Undo");
  await settle();
  check("Undo takes back exactly that entry", JSON.parse(localStorage.getItem("rozkharcha.v1")).expenses.length === 2);

  await act(async () => qRoot.unmount());
  qHost.remove();
  localStorage.removeItem("rozkharcha.v1");
}

console.log("");

console.log("Daily reminder");

{
  const r = await import("../src/lib/reminder.js");
  const dbm = await import("../src/lib/db.js");

  check("a time reads as hour and minute", JSON.stringify(r.parseTime("21:30")) === '{"hour":21,"minute":30}');
  check("rubbish falls back to 9 pm", JSON.stringify(r.parseTime("soon")) === '{"hour":21,"minute":0}');
  check("it reads naturally", r.formatTime("21:00") === "9:00 pm" && r.formatTime("07:05") === "7:05 am" && r.formatTime("00:00") === "12:00 am");

  check("reminders are off until asked for", dbm.migrate({}).settings.reminder.on === false);
  check("a saved reminder survives", dbm.migrate({ settings: { reminder: { on: true, time: "20:15" } } }).settings.reminder.time === "20:15");
  check("an impossible time is refused", dbm.migrate({ settings: { reminder: { on: true, time: "25:99" } } }).settings.reminder.time === "21:00");

  /* A browser cannot notify on a schedule once the tab is shut, so it says so
     rather than pretending. */
  check("the web says plainly it cannot", (await r.syncReminder({ on: true, time: "21:00" })).reason === "web");
}

console.log("");

console.log("App lock");

{
  const lock = await import("../src/lib/lock.js");
  const dbm = await import("../src/lib/db.js");
  const { buildJson: toJson } = await import("../src/lib/backup.js");

  lock.clearLock();
  check("off by default", lock.lockStatus().on === false);

  await lock.setPin("2468");
  check("a PIN turns it on", lock.lockStatus().on === true);

  const stored = localStorage.getItem("rozkharcha.lock") ?? "";
  check("the digits are never stored", !stored.includes("2468"));

  /* Kept out of the document on purpose: backups are shared and restored onto
     other phones, and a lock inside them would leak or lock people out. */
  check("the lock never travels in a backup", !/pinHash|2468/.test(toJson(dbm.migrate({}))));

  check("the right PIN opens it", (await lock.verifyPin("2468")).ok === true);
  const wrong = await lock.verifyPin("1111");
  check("a wrong one does not", wrong.ok === false && wrong.left === lock.MAX_ATTEMPTS - 1, JSON.stringify(wrong));

  let last;
  for (let i = 0; i < lock.MAX_ATTEMPTS; i++) last = await lock.verifyPin("0000");
  check("too many wrong tries forces a wait", last.cooldown > 0, JSON.stringify(last));
  check("and during it even the right PIN waits", (await lock.verifyPin("2468")).ok === false);
  check("the wait ends", (await lock.verifyPin("2468", Date.now() + lock.COOLDOWN_MS + 1)).ok === true);

  let threw = false;
  try {
    await lock.setPin("12");
  } catch {
    threw = true;
  }
  check("a short PIN is refused", threw);

  /* The whole screen, locked from the first paint. */
  lock.clearLock();
  await lock.setPin("2468");
  localStorage.setItem("rozkharcha.v1", JSON.stringify({ settings: { onboarded: true }, expenses: [] }));

  const lHost = document.createElement("div");
  document.body.appendChild(lHost);
  const lRoot = createRoot(lHost);
  await act(async () => {
    lRoot.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
  });
  await settle();

  check("the app opens locked", !!lHost.querySelector(".lock"));

  const key = (k) => [...lHost.querySelectorAll(".lock__key")].find((b) => b.textContent.trim() === k);
  const typePin = async (pin) => {
    for (const ch of pin) await click(key(ch), `key ${ch}`);
    await settle(120);
  };

  await typePin("1357");
  check("a wrong PIN keeps it shut", !!lHost.querySelector(".lock") && /Wrong PIN/.test(lHost.querySelector(".lock__msg")?.textContent ?? ""));

  await typePin("2468");
  check("the right PIN opens it", !lHost.querySelector(".lock"));

  await act(async () => lRoot.unmount());
  lHost.remove();
  lock.clearLock();
  localStorage.removeItem("rozkharcha.v1");
}

console.log("");

console.log("Summary picture");

{
  const s = await import("../src/lib/summaryImage.js");

  const day = "2026-09-10";
  const mk = (categoryId, amount, type = "expense") => ({
    id: `${categoryId}${amount}`, type, amount, categoryId, note: "", date: day, paymentMode: "cash", createdAt: day, updatedAt: day,
  });

  const items = [
    mk("food", 900), mk("groceries", 800), mk("travel", 700), mk("bills", 600),
    mk("shopping", 500), mk("health", 300), mk("entertainment", 200), mk("salary", 5000, "income"),
  ];
  const model = s.summaryModel(items, "September 2026");

  check("it totals the period", model.spent === 4000 && model.earned === 5000 && model.net === 1000);
  /* Past five rows the bars get too thin to read, so the tail folds together. */
  check("the long tail folds into one row", model.rows.length === 6 && model.rows[5].label === "Everything else");
  check("and that row is the sum of the tail", model.rows[5].amount === 500, String(model.rows[5].amount));
  check("the biggest comes first", model.rows[0].label === "Food & Drinks");
  check("colours are real values a canvas can paint", model.rows.every((r) => /^#[0-9a-f]{6}$/i.test(r.color)), model.rows.map((r) => r.color).join());
  check("income never lands in the spending rows", !model.rows.some((r) => r.label === "Salary"));
}

console.log("");

console.log("First launch");

{
  const dbm = await import("../src/lib/db.js");

  check("a new install is not onboarded", dbm.migrate({}).settings.onboarded === false);
  /* Updating the app must never greet an existing user with setup. */
  check("anyone with entries is past it", dbm.migrate({ expenses: [{ amount: 5, categoryId: "food", date: "2026-01-01" }] }).settings.onboarded === true);
  check("so is anyone who set their name", dbm.migrate({ settings: { name: "Asha" } }).settings.onboarded === true);

  localStorage.removeItem("rozkharcha.v1");
  const wHost = document.createElement("div");
  document.body.appendChild(wHost);
  const wRoot = createRoot(wHost);
  await act(async () => {
    wRoot.render(createElement(StrictMode, null, createElement(ExpenseProvider, null, createElement(App))));
  });
  await settle();

  check("a fresh install shows setup", !!wHost.querySelector(".welcome"));

  await type(wHost.querySelector(".welcome input"), "Asha");
  await click([...wHost.querySelectorAll(".welcome__opt")].find((b) => b.textContent.trim() === "$"), "$");
  await click([...wHost.querySelectorAll(".welcome .btn")].find((b) => b.textContent.trim() === "Next"), "Next");
  await settle();
  await type(wHost.querySelector(".welcome .amount-input__field"), "2000");
  await click([...wHost.querySelectorAll(".welcome .btn")].find((b) => /Start/.test(b.textContent)), "Start");
  await settle();

  check("setup goes away when done", !wHost.querySelector(".welcome"));
  check("Home greets them by name", wHost.querySelector(".home__app")?.textContent === "Asha", wHost.querySelector(".home__app")?.textContent);
  check("in their currency", wHost.querySelector(".home__badge")?.textContent.trim() === "$");
  check("with their budget", /\$2,000/.test(wHost.querySelector(".balance__budget")?.textContent ?? ""), wHost.querySelector(".balance__budget")?.textContent);

  const saved = JSON.parse(localStorage.getItem("rozkharcha.v1")).settings;
  check("and it never shows again", saved.onboarded === true);

  await act(async () => wRoot.unmount());
  wHost.remove();
  localStorage.removeItem("rozkharcha.v1");
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

