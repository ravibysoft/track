import { fromKey, shortDayLabel } from "./dates.js";
import { round2 } from "./money.js";

/**
 * Distance between readings.
 *
 * Some entries are worth recording a kilometre reading against: a tank of
 * petrol, a service, a tyre change. One reading on its own says nothing — two
 * make a *leg*, and a leg is where the answers are: how far you went between
 * fills, what the fuel actually returned, what the running cost per kilometre
 * is.
 *
 * Legs are counted within a single category, never across the whole document.
 * That one decision is what lets the same code answer two different questions
 * without knowing which it is answering: a Petrol category measures fill to
 * fill, a Service category measures service to service. It is also how two
 * vehicles stay apart — "Petrol — Bike" and "Petrol — Car" are separate
 * categories, so each measures only its own legs, and no vehicle entity, no
 * extra picker and no migration is needed to support them.
 *
 * Turned on per category (Categories → Track kilometres), because the
 * categories are the user's own: hard-coding an id like "petrol" would miss
 * "Bike fuel" and would fire on someone's "Petrol shares" just the same.
 */

/** Highest reading we accept. A bike or car passing 2,000,000 km is a typo. */
export const MAX_ODOMETER = 2_000_000;

/** Litres in one tank, generously: above this it is a mistyped amount. */
export const MAX_LITRES = 200;

/** A reading we can use: a positive number, within range. */
export function validReading(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_ODOMETER ? round2(n) : null;
}

export function validLitres(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_LITRES ? round2(n) : null;
}

/**
 * That category's entries carrying a reading, oldest first.
 *
 * Ordered by the day it happened and then by when it was written, NOT by the
 * reading itself. Sorting by the reading would quietly hide the one thing worth
 * telling the user about — a reading typed in wrong — by shuffling it into a
 * position where it looks plausible.
 */
export function readings(expenses, categoryId) {
  return (Array.isArray(expenses) ? expenses : [])
    .filter((e) => e && e.categoryId === categoryId && validReading(e.odometer) !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
}

function daysBetween(fromDay, toDay) {
  const ms = fromKey(toDay).getTime() - fromKey(fromDay).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * One leg: from the previous reading to this entry's.
 *
 * `km` is null when the readings do not increase — the odometer only goes one
 * way, so that means one of the two was typed wrong. Everything derived from
 * the distance is then null as well, and `suspect` says why, rather than the
 * screen showing a negative distance or a mileage of −8 km/L.
 */
function buildLeg(from, to) {
  const start = validReading(from.odometer);
  const end = validReading(to.odometer);
  const km = end > start ? round2(end - start) : null;
  const litres = validLitres(to.litres);

  return {
    from,
    to,
    start,
    end,
    km,
    suspect: km === null,
    days: daysBetween(from.date, to.date),
    litres,
    /* Tank to tank: the fuel bought at the END of the leg is what carried you
       along it, which is the standard way to read mileage off a full-to-full
       fill. A leg with no litres recorded simply has no mileage. */
    kmPerLitre: km !== null && litres !== null ? round2(km / litres) : null,
    costPerKm: km !== null && to.amount > 0 ? round2(to.amount / km) : null,
  };
}

/** Every leg in that category, oldest first. One reading gives none. */
export function legs(expenses, categoryId) {
  const list = readings(expenses, categoryId);
  return list.slice(1).map((entry, i) => buildLeg(list[i], entry));
}

/**
 * The leg that ends at `entry`, or null when it is the first reading.
 *
 * Takes the entry rather than an index so a row or a form can ask about itself
 * without knowing where it sits in the list. An entry being edited is matched
 * by id, so the in-progress copy is compared against its real neighbour and not
 * against itself.
 */
export function legEndingAt(expenses, entry) {
  if (!entry || validReading(entry.odometer) === null) return null;
  const before = readings(expenses, entry.categoryId).filter((e) => e.id !== entry.id);

  /* The last reading that is not after this entry's day. Editing an old entry
     then compares it against the entry before IT, not against the newest one. */
  const previous = [...before].reverse().find((e) => e.date <= entry.date);
  return previous ? buildLeg(previous, entry) : null;
}

/**
 * What a category's readings add up to, for the Stats card.
 *
 * The averages are totals divided by totals, not the mean of each leg's own
 * figure: a 40 km leg and a 400 km leg should not count equally towards your
 * mileage. Legs with a suspect reading are left out of every total — they
 * cannot be measured — but still counted in `suspectCount` so the screen can
 * say a reading needs looking at.
 */
export function summary(expenses, categoryId) {
  const all = legs(expenses, categoryId);
  const usable = all.filter((leg) => leg.km !== null);
  const fuelled = usable.filter((leg) => leg.litres !== null);

  const km = round2(usable.reduce((total, leg) => total + leg.km, 0));
  const spent = round2(usable.reduce((total, leg) => total + leg.to.amount, 0));
  const fuelKm = round2(fuelled.reduce((total, leg) => total + leg.km, 0));
  const litres = round2(fuelled.reduce((total, leg) => total + leg.litres, 0));

  const list = readings(expenses, categoryId);
  const last = list.at(-1) ?? null;

  return {
    legs: all,
    count: list.length,
    suspectCount: all.filter((leg) => leg.suspect).length,
    last,
    lastReading: last ? validReading(last.odometer) : null,
    km,
    spent,
    litres,
    /* Null rather than 0 when there is nothing to divide: "—" is honest, "0 km/L"
       is a claim the data does not make. */
    kmPerLitre: litres > 0 && fuelKm > 0 ? round2(fuelKm / litres) : null,
    costPerKm: km > 0 && spent > 0 ? round2(spent / km) : null,
    /* The newest leg is the one worth leading with: the distance you just did. */
    latest: usable.at(-1) ?? null,
  };
}

/** Every category that tracks kilometres and has at least one reading. */
export function trackedCategories(expenses, categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((c) => c.tracksKm)
    .map((category) => ({ category, stats: summary(expenses, category.id) }))
    .filter(({ stats }) => stats.count > 0);
}

/* ---------- Formatting ----------
   Kept here beside the maths so a reading looks the same on the form, the row
   and the card, instead of three screens each rounding it their own way. */

export function formatKm(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const value = Number(n);
  /* No decimals on a reading in the tens of thousands — an odometer is not a
     precision instrument and "34,218.4 km" reads as false accuracy. */
  const rounded = Math.abs(value) >= 1000 ? Math.round(value) : round2(value);
  return `${rounded.toLocaleString("en-IN")} km`;
}

export function formatMileage(n) {
  return n === null || n === undefined ? "—" : `${round2(n).toLocaleString("en-IN")} km/L`;
}

/** "312 km since 2 Oct", the sentence a leg is really trying to say. */
export function describeLeg(leg) {
  if (!leg) return "";
  if (leg.suspect) {
    return `Last reading was ${formatKm(leg.start)} — this one should be higher`;
  }
  const parts = [`${formatKm(leg.km)} since ${shortDayLabel(leg.from.date)}`];
  if (leg.days > 0) parts.push(`${leg.days} ${leg.days === 1 ? "day" : "days"}`);
  if (leg.kmPerLitre !== null) parts.push(formatMileage(leg.kmPerLitre));
  return parts.join(" · ");
}
