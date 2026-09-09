import { useEffect, useMemo, useState } from "react";
import { allCategories } from "../lib/categories.js";

/**
 * SVG fills are set as attributes, and an attribute does not resolve `var(--x)`
 * — so the tokens are read off the root element as concrete values, and re-read
 * whenever the theme changes or the category list does.
 */
const TOKENS = ["accent", "text", "text-dim", "text-faint", "border", "surface", "danger", "warn"];

const TOKEN_REF = /^var\((--[^)]+)\)$/;

/**
 * `themeVersion` is not read — it is the memo key. The values below live in the
 * DOM rather than in any prop, so nothing else tells a memo that they changed.
 */
function readColors(categories, themeVersion) {
  void themeVersion;
  if (typeof window === "undefined") return {};
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  const out = {};
  for (const c of categories) {
    // A custom category may carry a literal colour rather than a token.
    const token = TOKEN_REF.exec(c.color)?.[1];
    out[c.id] = (token ? get(token) : c.color) || "#888";
  }
  for (const t of TOKENS) out[t] = get(`--${t}`);
  return out;
}

export default function useThemeColors(categories = allCategories()) {
  const [themeVersion, setThemeVersion] = useState(0);
  const refresh = () => setThemeVersion((n) => n + 1);

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

    // No initial bump: the memo below reads the tokens on the first render, and
    // the observer catches the data-theme the provider sets in its own effect.
    return () => {
      observer.disconnect();
      media.removeEventListener("change", refresh);
    };
    // Registered once; `refresh` only ever bumps a counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(() => readColors(categories, themeVersion), [categories, themeVersion]);
}
