# Track — Daily Expense Tracker

A personal, offline expense tracker for Android. No account, no signup, no internet.
Every expense is stored on the phone itself; backups are written into the phone's
**Documents/ExpenseTracker** folder so they show up in any File Manager app.

Built with React + Vite, wrapped into an APK with Capacitor.

## What it does

- **Add / edit / delete** an expense — amount, category, date, note, and how it was paid
- **Home** — spent today, this week, this month, and a monthly budget bar
- **History** — every expense grouped day by day, with search, category filters and
  per-day subtotals; browse by month or all time
- **Stats** — donut chart by category, daily bar chart, and a month-over-month trend
- **Backup** — export `.json` (restorable) or `.csv` (opens in Excel), share, or restore
- Light / dark / system theme, ₹ with Indian digit grouping (₹1,25,400)
- Deleting always offers **Undo**

## Run it on a computer

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Run it on your phone (no APK needed)

With the phone and PC on the same WiFi:

```bash
npm run dev
```

Vite prints a `Network:` address such as `http://192.168.1.5:5173`. Open that in Chrome
on the phone. This is the fastest way to try the UI before building an APK.

## Checks

```bash
npm run lint    # oxlint
npm run smoke   # mounts the real app in jsdom and drives it end to end
npm run build   # production bundle into dist/
```

`npm run smoke` is the important one — it adds, edits, deletes and restores an expense,
switches every tab, sets a budget, flips the theme, and reloads to confirm the data
persisted. It also covers the money/date/CSV edge cases.

## Build the APK

```bash
npm run apk
```

That runs the web build, syncs it into the Android project, and assembles:

```
android/app/build/outputs/apk/debug/app-debug.apk    (~4.5 MB)
```

Copy it to the phone and open it (allow "install from unknown sources" once). The debug
APK is signed with the standard debug key using APK Signature Scheme v2.

### Toolchain

Capacitor 8 uses AGP 8.13 and compiles against **Java 21**, so a newer JDK — including the
**JDK 25** that is this machine's default `java` — will fail the build. The project pins the
right one in `android/gradle.properties`:

```properties
org.gradle.java.home=E:/Android/jdk21/jdk-21.0.12.1+1
```

The Android SDK (platform 36, build-tools 36) lives at `E:/Android/Sdk`, pinned in
`android/local.properties`. Change both paths if either moves.

For a permanent install, create a keystore with `keytool`, add a `signingConfig` to
`android/app/build.gradle`, then run `npm run apk:release`.

## Where the data lives

| | |
|---|---|
| In the app | `expenses.json` in the app's private storage — removed if you uninstall |
| Backups | `Documents/ExpenseTracker/expenses-YYYY-MM-DD.json` and `.csv` — visible in File Manager, survive uninstall |
| In a browser | `localStorage` under the key `track.v1` |

The app requests exactly one permission, `INTERNET`, which Capacitor requires for the
WebView's local server — the app itself makes no network requests. Notably it needs **no
storage permission**: Android 11+ lets an app read and write the files it created in the
public Documents folder.

## Layout

```
src/
  lib/          storage adapter, document rules, money, dates, categories, backup
  state/        React provider + hook over the single document
  components/   icons, rows, sheet, snackbar, tab bar, budget bar, dialogs
  screens/      Home, History, Stats, Settings, and the add/edit sheet
  styles/       design tokens, base styles, component styles
scripts/
  smoke.jsx     headless end-to-end check
```

Data flows one way: `storage.js` reads the document → `ExpenseProvider` holds it in state
→ screens render from it → any change goes back through `db.js` and is written out again
after a 200 ms debounce (and immediately when the app is backgrounded).
