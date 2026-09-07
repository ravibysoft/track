/**
 * Writes `samples/sample-data.json` — a realistic backup you can load through
 * Settings → Restore from backup to see every screen with data in it.
 *
 * Local only: it never enters the production build, the deployed site or the APK.
 *
 * Dates are generated relative to today, so the file never goes stale: re-run
 * `npm run sample` and the three months always end at the current one.
 *
 * Deterministic on purpose (a fixed seed), so the same command gives the same
 * data and screenshots stay comparable between runs.
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* A tiny seeded PRNG (mulberry32) — Math.random would reshuffle every run. */
let seed = 20260907;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (min, max) => Math.round(min + rnd() * (max - min));

const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = new Date();
const dayOffset = (back) => {
  const d = new Date(today);
  d.setDate(d.getDate() - back);
  return d;
};

/** Everyday spends, with the sort of amounts these actually cost. */
const ROUTINE = [
  { categoryId: "food", note: "Chai and samosa", min: 20, max: 60, mode: "cash" },
  { categoryId: "food", note: "Lunch at office", min: 120, max: 320, mode: "upi" },
  { categoryId: "food", note: "Dinner outside", min: 250, max: 900, mode: "card" },
  { categoryId: "travel", note: "Auto to metro", min: 30, max: 90, mode: "cash" },
  { categoryId: "travel", note: "Metro card recharge", min: 200, max: 500, mode: "upi" },
  { categoryId: "travel", note: "Petrol", min: 500, max: 1600, mode: "card" },
  { categoryId: "groceries", note: "Vegetables", min: 150, max: 480, mode: "cash" },
  { categoryId: "groceries", note: "Monthly groceries", min: 1800, max: 3200, mode: "upi" },
  { categoryId: "entertainment", note: "Movie ticket", min: 250, max: 500, mode: "card" },
  { categoryId: "health", note: "Medicines", min: 180, max: 800, mode: "upi" },
  { categoryId: "shopping", note: "T-shirt", min: 500, max: 1500, mode: "card" },
];

/** Once-a-month bills, pinned to a day so the calendar shows obvious peaks. */
const MONTHLY_BILLS = [
  { categoryId: "bills", note: "Electricity bill", day: 8, min: 900, max: 2400, mode: "upi" },
  { categoryId: "bills", note: "Mobile recharge", day: 12, min: 239, max: 799, mode: "upi" },
  { categoryId: "entertainment", note: "Streaming plan", day: 15, min: 149, max: 649, mode: "card" },
  { categoryId: "health", note: "Gym membership", day: 5, min: 800, max: 1200, mode: "card" },
];

const entries = [];
let n = 0;
const push = (e) => {
  const created = new Date(`${e.date}T09:00:00`);
  created.setMinutes(created.getMinutes() + n * 7);
  entries.push({
    id: `sample-${String(n).padStart(3, "0")}`,
    type: e.type ?? "expense",
    amount: e.amount,
    categoryId: e.categoryId,
    note: e.note,
    date: e.date,
    paymentMode: e.paymentMode,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
  });
  n += 1;
};

/* ~90 days of history: enough for Daily, Calendar, Monthly and the Year view. */
for (let back = 92; back >= 0; back -= 1) {
  const date = key(dayOffset(back));
  const day = dayOffset(back).getDate();

  // Salary on the 1st, so every month opens with income.
  if (day === 1) {
    push({ type: "income", amount: 48000, categoryId: "salary", note: "Monthly salary", date, paymentMode: "card" });
  }
  // An occasional side job.
  if (day === 18 && rnd() > 0.4) {
    push({ type: "income", amount: between(2000, 9000), categoryId: "freelance", note: "Freelance project", date, paymentMode: "upi" });
  }

  for (const bill of MONTHLY_BILLS) {
    if (day === bill.day) {
      push({ amount: between(bill.min, bill.max), categoryId: bill.categoryId, note: bill.note, date, paymentMode: bill.mode });
    }
  }

  // One to three everyday spends, with the odd quiet day.
  const count = rnd() < 0.12 ? 0 : between(1, 3);
  for (let i = 0; i < count; i += 1) {
    const r = pick(ROUTINE);
    push({ amount: between(r.min, r.max), categoryId: r.categoryId, note: r.note, date, paymentMode: r.mode });
  }
}

/* A few deliberate edge cases, so the layout is exercised and not just filled. */
const t = key(today);
push({ amount: 250.5, categoryId: "food", note: "Split the bill — paise on purpose", date: t, paymentMode: "upi" });
push({
  amount: 18499,
  categoryId: "shopping",
  note: "Birthday dinner with the whole family at that new restaurant near the office",
  date: t,
  paymentMode: "card",
});
push({ amount: 1250, categoryId: "other", note: "Supercalifragilisticexpialidociousunbreakableword", date: t, paymentMode: "cash" });

const doc = {
  version: 1,
  settings: { currency: "₹", monthlyBudget: 25000, theme: "light" },
  expenses: entries.reverse(), // newest first, the way the app stores them
  exportedAt: new Date().toISOString(),
};

/* Deliberately NOT in public/ — anything there is copied into dist/ and would
   ship to the live site and into the APK. This is test data, so it stays out of
   the build entirely; vite.config.js serves it at /sample-data.json in dev only. */
await writeFile(join(root, "samples", "sample-data.json"), JSON.stringify(doc, null, 2), "utf8");

const spent = entries.filter((e) => e.type !== "income").reduce((s, e) => s + e.amount, 0);
const earned = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
console.log(`samples/sample-data.json — ${entries.length} entries`);
console.log(`  spending ₹${Math.round(spent).toLocaleString("en-IN")}`);
console.log(`  income   ₹${Math.round(earned).toLocaleString("en-IN")}`);
console.log(`  range    ${entries[entries.length - 1].date} … ${entries[0].date}`);
