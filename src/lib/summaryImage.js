/**
 * A shareable picture of a period's money — for sending the month to a partner
 * or a parent on WhatsApp without handing them the app.
 *
 * Drawn straight onto a canvas rather than screenshotting the screen: a
 * screenshot would carry whatever theme, scroll position and half-open sheet the
 * app happened to be in. This is the same clean card every time, always in the
 * light palette, because it will be opened in somebody else's chat.
 */
import { getCategory } from "./categories.js";
import * as db from "./db.js";
import { formatMoney } from "./money.js";
import { isNative } from "./storage.js";

export const WIDTH = 1080;
export const HEIGHT = 1350;
/** Rows before the rest fold into "Everything else" — past this, bars stop being readable. */
const MAX_ROWS = 5;

/** tokens.css light values, since a canvas cannot read `var(--c-food)`. */
const LIGHT = {
  "--c-food": "#f2635f",
  "--c-groceries": "#1fa971",
  "--c-travel": "#2f9fe0",
  "--c-bills": "#e08a1e",
  "--c-shopping": "#db4b96",
  "--c-health": "#12a394",
  "--c-entertainment": "#9a5ae8",
  "--c-other": "#7d879c",
};

function resolveColor(value) {
  const token = /^var\((--[^)]+)\)$/.exec(value)?.[1];
  if (token) return LIGHT[token] ?? LIGHT["--c-other"];
  return typeof value === "string" && value ? value : LIGHT["--c-other"];
}

/**
 * Everything the card shows, worked out apart from any drawing so it can be
 * checked in a test without a canvas.
 */
export function summaryModel(items, periodLabel) {
  const totals = db.totals(items);
  const breakdown = db.byCategory(items, "expense");

  const shown = breakdown.slice(0, MAX_ROWS);
  const rest = breakdown.slice(MAX_ROWS);
  const rows = shown.map((b) => {
    const category = getCategory(b.categoryId);
    return { label: category.label, color: resolveColor(category.color), amount: b.amount, share: b.share };
  });
  if (rest.length) {
    rows.push({
      label: "Everything else",
      color: LIGHT["--c-other"],
      amount: rest.reduce((s, b) => s + b.amount, 0),
      share: rest.reduce((s, b) => s + b.share, 0),
    });
  }

  return {
    periodLabel,
    count: items.length,
    spent: totals.expense,
    earned: totals.income,
    net: totals.net,
    rows,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FONT}`;

/** Paints the card. `canvas` must already be WIDTH × HEIGHT. */
export function drawSummary(canvas, model, currency) {
  const ctx = canvas.getContext("2d");
  const pad = 80;
  const money = (n) => formatMoney(n, currency);

  // Ground and header band
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#14513c";
  ctx.fillRect(0, 0, WIDTH, 300);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#9fd8bf";
  ctx.font = font(700, 28);
  ctx.fillText("ROZ KHARCHA", pad, 100);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(800, 68);
  ctx.fillText(model.periodLabel, pad, 185);
  ctx.fillStyle = "#cfe9dc";
  ctx.font = font(500, 32);
  ctx.fillText(`${model.count} ${model.count === 1 ? "entry" : "entries"}`, pad, 240);

  // The headline number
  ctx.fillStyle = "#666d7d";
  ctx.font = font(600, 32);
  ctx.fillText("Spent", pad, 390);
  ctx.fillStyle = "#0d0e12";
  ctx.font = font(800, 104);
  ctx.fillText(money(model.spent), pad, 495);

  // Income and what was left, only when income was recorded at all
  let y = 560;
  if (model.earned > 0) {
    const col = (label, value, color, x) => {
      ctx.fillStyle = "#666d7d";
      ctx.font = font(600, 28);
      ctx.fillText(label, x, y + 40);
      ctx.fillStyle = color;
      ctx.font = font(750, 46);
      ctx.fillText(value, x, y + 100);
    };
    col("Income", money(model.earned), "#15803d", pad);
    col(
      model.net < 0 ? "Overspent by" : "Left over",
      money(Math.abs(model.net)),
      model.net < 0 ? "#dc2626" : "#0d0e12",
      WIDTH / 2 + 20,
    );
    y += 140;
  }

  ctx.fillStyle = "#e7e9ee";
  ctx.fillRect(pad, y + 20, WIDTH - pad * 2, 3);
  y += 90;

  // Where it went
  ctx.fillStyle = "#666d7d";
  ctx.font = font(700, 28);
  ctx.fillText("WHERE IT WENT", pad, y);
  y += 60;

  if (model.rows.length === 0) {
    ctx.fillStyle = "#9aa0ad";
    ctx.font = font(500, 34);
    ctx.fillText("Nothing spent in this period.", pad, y + 20);
  }

  const barW = WIDTH - pad * 2;
  for (const row of model.rows) {
    // Swatch, name, amount
    ctx.fillStyle = row.color;
    roundRect(ctx, pad, y - 26, 30, 30, 8);
    ctx.fill();

    ctx.fillStyle = "#0d0e12";
    ctx.font = font(600, 36);
    ctx.textAlign = "left";
    ctx.fillText(row.label, pad + 50, y);

    ctx.textAlign = "right";
    ctx.font = font(750, 36);
    ctx.fillText(money(row.amount), WIDTH - pad, y);
    ctx.textAlign = "left";

    // Share bar
    ctx.fillStyle = "#eef0f4";
    roundRect(ctx, pad, y + 20, barW, 14, 7);
    ctx.fill();
    ctx.fillStyle = row.color;
    roundRect(ctx, pad, y + 20, Math.max(barW * row.share, 14), 14, 7);
    ctx.fill();

    y += 100;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#9aa0ad";
  ctx.font = font(500, 26);
  ctx.fillText("Tracked with Roz Kharcha · kept on the phone, never online", WIDTH / 2, HEIGHT - 60);
  ctx.textAlign = "left";
}

/**
 * Draws the card and hands it to whatever sharing the platform offers: the
 * Android share sheet in the app, the Web Share API where a browser has it, and
 * a plain download everywhere else. Resolves to how it went, for the toast.
 */
export async function shareSummary(model, currency, filenameStem) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  drawSummary(canvas, model, currency);

  const filename = `roz-kharcha-${filenameStem}.png`;
  const title = `Spending — ${model.periodLabel}`;

  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = canvas.toDataURL("image/png").split(",")[1];
    // The cache directory: a shared picture is a hand-off, not something to keep.
    await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title, files: [uri], dialogTitle: "Share this summary" });
    return "shared";
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not draw the summary.");
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return "shared";
    } catch (err) {
      // Closing the share sheet is a choice, not a failure.
      if (err?.name === "AbortError") return "cancelled";
      throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
