import { useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "../lib/categories.js";

/**
 * SVG presentation attributes don't resolve `var(--x)`, and Recharts sets colours
 * as attributes — so the tokens are read off the root element as concrete values
 * and refreshed whenever the theme changes.
 */
const TOKENS = ["accent", "text", "text-dim", "text-faint", "border", "surface", "danger", "warn"];

function readColors() {
  if (typeof window === "undefined") return {};
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  const out = {};
  for (const c of CATEGORIES) out[c.id] = get(`--c-${c.id}`) || "#888";
  for (const t of TOKENS) out[t] = get(`--${t}`);
  return out;
}

export default function useThemeColors() {
  const [colors, setColors] = useState(readColors);
  const refresh = useCallback(() => setColors(readColors()), []);

  useEffect(() => {
    // Forced theme changes flip data-theme on <html>.
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // "System" theme follows the OS instead.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", refresh);

    // No initial refresh: useState already read the tokens, and the observer
    // catches the data-theme the provider sets on its own first effect.
    return () => {
      observer.disconnect();
      media.removeEventListener("change", refresh);
    };
  }, [refresh]);

  return colors;
}
