import { createContext, useContext } from "react";

/** Kept apart from the provider so the hook and the component can each be hot-reloaded. */
export const ExpenseContext = createContext(null);

export function useExpenses() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenses must be used inside <ExpenseProvider>");
  return ctx;
}
