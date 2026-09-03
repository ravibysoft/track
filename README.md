# Roz Kharcha — Daily Expense Tracker

A personal, offline expense tracker. No account, no signup, no internet. Every expense is
stored on your own device; backups are written into the phone's **Documents/ExpenseTracker**
folder so they show up in any File Manager app.

Ships two ways from one codebase:

- **Installable web app (PWA)** — live at <https://rozkharcha.netlify.app>
- **Android APK** — `RozKharcha.apk`, built with Capacitor

## What it does

- **Add / edit / delete** an expense — amount, category, date, note, and how it was paid
- **Home** — spent today, this week, this month, and a monthly budget bar
- **History** — every expense grouped day by day, with search, category filters and
  per-day subtotals; browse by month or all time
- **Stats** — donut chart by category, daily bar chart, and a month-over-month trend
- **Backup** — export `.json` (restorable) or `.csv` (opens in Excel), share, or restore
- A pure-white interface by default — cards separate by hairline borders and space
  rather than grey fills. Dark and System stay available in **Settings → Appearance**
- ₹ with Indian digit grouping (₹1,25,400)
- Deleting always offers **Undo**

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Vite also prints a `Network:` address like
`http://192.168.1.5:5173` — open that on a phone on the same WiFi to try it on a real device.

## Checks

```bash
npm run lint    # oxlint
npm run smoke   # mounts the real app in jsdom and drives it end to end
npm run build   # production bundle into dist/
```

`npm run smoke` is the important one — 68 checks that add, edit, delete and restore an
expense, switch every tab, set a budget, flip the theme, reload to confirm data persisted,
and verify the old `track.v1` storage key still migrates. It also covers the money, date
and CSV edge cases.

## The PWA

`vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches the
whole build, so once opened the app works with no network at all.

Installing is offered in two places, both driven by the browser's `beforeinstallprompt`:
a dismissible card on Home, and a row in **Settings → App**. iOS has no such event, so
Safari users get the *Share → Add to Home Screen* hint instead.

The service worker is **not** registered inside the APK ([src/pwa.js](src/pwa.js)) —
Capacitor already serves every asset from the device, and a second cache layer would only
add a way to get stuck on a stale build.

### Deploying

Netlify serves `dist/` — no `_redirects` needed, since navigation is tab state rather than
URL routes. Rebuild and redeploy with:

```bash
npm run build      # then drag dist/ into Netlify, or push if the site is git-linked
```

## Build the APK

```bash
npm run apk
```

That runs the web build, syncs it into the Android project, re-applies the launcher icon and
launch screen, regenerates the PNG mipmaps, and assembles:

```
android/app/build/outputs/apk/debug/app-debug.apk    (~4.5 MB)
```

Copy it to the phone and open it (allow "install from unknown sources" once). It is signed
with the standard debug key using APK Signature Scheme v2.

### Icons

All icons come from two vector masters in [assets/](assets/) — `icon.svg` (rounded tile) and
`icon-maskable.svg` (full-bleed, mark pulled into the safe zone). `npm run icons` rasterises
them into every size the manifest and the Android launcher need. Edit the SVGs, never the PNGs.

### Toolchain

Capacitor 8 uses AGP 8.13 and compiles against **Java 21**, so a newer JDK — including the
**JDK 25** that is this machine's default `java` — will fail the build. `npm run apk` pins
the right one via `scripts/brand-android.mjs`:

| | |
|---|---|
| JDK 21 | `E:/Android/jdk21/jdk-21.0.12.1+1` → `android/gradle.properties` |
| Android SDK 36 | `E:/Android/Sdk` → `android/local.properties` |

`android/` is git-ignored and fully regenerable: `npx cap add android && npm run android:brand`.
Change those two paths in [scripts/brand-android.mjs](scripts/brand-android.mjs) if either moves.

For a permanent install, create a keystore with `keytool`, add a `signingConfig` to
`android/app/build.gradle`, then run `npm run apk:release`.

## Where the data lives

| | |
|---|---|
| Installed PWA / browser | `localStorage` under `rozkharcha.v1` (migrated from the old `track.v1`) |
| Android APK | `expenses.json` in the app's private storage — removed if you uninstall |
| Backups | `Documents/ExpenseTracker/expenses-YYYY-MM-DD.json` and `.csv` — visible in File Manager |

**The web app and the APK do not share data.** They are separate stores on separate origins.
To move expenses between them, Export a `.json` backup from one and Restore it in the other.

The APK requests exactly one permission, `INTERNET`, which Capacitor requires for the
WebView's local server — the app itself makes no network requests. Notably it needs **no
storage permission**: Android 11+ lets an app read and write files it created in the public
Documents folder.

## Layout

```
assets/         icon.svg, icon-maskable.svg — the vector masters
scripts/
  smoke.jsx           headless end-to-end check
  generate-icons.mjs  SVG -> every PNG size
  brand-android.mjs   re-applies icon, launch screen and toolchain paths
src/
  lib/          storage adapter, document rules, money, dates, categories, backup
  state/        React provider + hook over the single document
  hooks/        theme colours for charts, PWA install prompt
  components/   icons, rows, sheet, snackbar, tab bar, budget bar, dialogs
  screens/      Home, History, Stats, Settings, and the add/edit sheet
  styles/       design tokens, base styles, component styles
```

Data flows one way: `storage.js` reads the document → `ExpenseProvider` holds it in state
→ screens render from it → any change goes back through `db.js` and is written out again
after a 200 ms debounce (and immediately when the app is backgrounded).
