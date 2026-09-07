/**
 * The small calculator behind the amount keypad.
 *
 * Chained left-to-right, the way a pocket calculator works: 250 + 80 × 2 is
 * (250 + 80) × 2, not 250 + 160. That matches what people expect from a keypad
 * and avoids needing operator precedence for what is almost always one addition.
 *
 * State is a plain object so the whole thing stays pure and testable:
 *   entry — digits typed since the last operator ("" when nothing typed yet)
 *   acc   — the running result, or null before any operator
 *   op    — the pending operator, or null
 */
import { round2 } from "./money.js";

export const MAX_DIGITS = 10;

export function emptyCalc() {
  return { entry: "", acc: null, op: null };
}

export function fromAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return emptyCalc();
  return { entry: String(amount), acc: null, op: null };
}

export function apply(a, op, b) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      // Dividing by zero would poison the amount with Infinity, so it is a no-op.
      return b === 0 ? a : a / b;
    default:
      return b;
  }
}

export function pressDigit(state, digit) {
  const digitsOnly = state.entry.replace(".", "");
  if (digitsOnly.length >= MAX_DIGITS) return state;
  if (digit === "0" && state.entry === "0") return state;
  const entry = state.entry === "0" && digit !== "." ? digit : state.entry + digit;
  return { ...state, entry };
}

export function pressDot(state) {
  if (state.entry.includes(".")) return state;
  return { ...state, entry: state.entry === "" ? "0." : `${state.entry}.` };
}

export function pressOperator(state, op) {
  // No number typed yet: just swap which operator is pending.
  if (state.entry === "") {
    return state.acc === null ? state : { ...state, op };
  }
  const typed = Number(state.entry);
  const acc = state.acc === null ? typed : apply(state.acc, state.op, typed);
  return { entry: "", acc: round2(acc), op };
}

export function pressEquals(state) {
  if (state.op === null || state.entry === "") return state;
  const result = round2(apply(state.acc, state.op, Number(state.entry)));
  return { entry: String(result), acc: null, op: null };
}

export function pressBackspace(state) {
  if (state.entry !== "") {
    return { ...state, entry: state.entry.slice(0, -1) };
  }
  // Nothing left to delete in the entry — step back out of the pending operator.
  if (state.op !== null) return { ...state, op: null };
  if (state.acc !== null) return emptyCalc();
  return state;
}

export function clearCalc() {
  return emptyCalc();
}

/** True while an operator is waiting on a second number. */
export function isPending(state) {
  return state.op !== null && state.entry !== "";
}

/** The number this state currently represents, or null when there isn't one. */
export function calcValue(state) {
  if (state.entry !== "") {
    const n = Number(state.entry);
    return Number.isFinite(n) ? round2(n) : null;
  }
  if (state.acc !== null && state.op === null) return round2(state.acc);
  return null;
}

/** Big display text — always shows something, never an empty box. */
export function displayText(state) {
  if (state.entry !== "") return state.entry;
  if (state.acc !== null) return String(state.acc);
  return "0";
}

const SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** The faint "250 +" line above the big number while an operator is pending. */
export function pendingText(state) {
  if (state.op === null || state.acc === null) return "";
  return `${state.acc} ${SYMBOL[state.op] ?? state.op}`;
}
