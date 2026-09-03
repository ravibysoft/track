/**
 * Rasterises assets/icon.svg + assets/icon-maskable.svg into the PNG sizes a PWA
 * install and an Android launcher need. Run with `npm run icons` after changing
 * the artwork — the outputs are committed into public/ and android/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (name) => join(root, "assets", name);

/** [source, output path, pixel size] */
const TARGETS = [
  // Web app manifest
  ["icon.svg", "public/icons/icon-192.png", 192],
  ["icon.svg", "public/icons/icon-512.png", 512],
  ["icon-maskable.svg", "public/icons/maskable-192.png", 192],
  ["icon-maskable.svg", "public/icons/maskable-512.png", 512],
  // iOS home screen (no transparency, iOS applies its own rounding)
  ["icon.svg", "public/icons/apple-touch-icon.png", 180],
  // Android launcher fallback for API < 26, which cannot use the adaptive vector
  ["icon.svg", "android/app/src/main/res/mipmap-mdpi/ic_launcher.png", 48],
  ["icon.svg", "android/app/src/main/res/mipmap-hdpi/ic_launcher.png", 72],
  ["icon.svg", "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png", 96],
  ["icon.svg", "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png", 144],
  ["icon.svg", "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", 192],
  ["icon.svg", "android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png", 48],
  ["icon.svg", "android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png", 72],
  ["icon.svg", "android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png", 96],
  ["icon.svg", "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png", 144],
  ["icon.svg", "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png", 192],
];

let written = 0;
let skipped = 0;

for (const [source, target, size] of TARGETS) {
  const out = join(root, target);
  try {
    await mkdir(dirname(out), { recursive: true });
  } catch {
    /* already there */
  }

  // The Android folders only exist once the native project has been added.
  if (target.startsWith("android/")) {
    const { existsSync } = await import("node:fs");
    if (!existsSync(dirname(out))) {
      skipped += 1;
      continue;
    }
  }

  const png = await sharp(src(source), { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(out, png);
  console.log(`  ${String(size).padStart(4)}px  ${target}`);
  written += 1;
}

console.log(`\n${written} icons written${skipped ? `, ${skipped} skipped (no android/ yet)` : ""}`);
