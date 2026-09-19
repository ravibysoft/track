/**
 * Re-applies everything Capacitor's `cap add android` does not know about:
 * the launcher icon, the launch screen, and the local toolchain paths.
 *
 * `android/` is regenerable and git-ignored, so run this after any `cap add android`
 * (then `npm run icons` for the PNG mipmaps). `npm run apk` chains both.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "android");

if (!existsSync(android)) {
  console.error("android/ not found — run `npx cap add android` first.");
  process.exit(1);
}

const JDK = "C:/Program Files/Android/Android Studio/jbr";
const SDK = "C:/Users/dell/AppData/Local/Android/Sdk";

/** The wallet mark, sized for the adaptive-icon safe zone. */
const FOREGROUND = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:translateX="1.1"
        android:translateY="1.1"
        android:scaleX="2.25"
        android:scaleY="2.25">
        <path
            android:pathData="M12,17.5A3.5,3.5 0 0 1 15.5,14H33a1,1 0 0 1 1,1v2.5M12,17.5v13A3.5,3.5 0 0 0 15.5,34H33a1,1 0 0 0 1,-1v-3M12,17.5h22a1,1 0 0 1 1,1V26m0,0h-4.5a2.75,2.75 0 0 0 0,5.5H35"
            android:fillColor="#00000000"
            android:strokeColor="#FFFFFF"
            android:strokeWidth="2.6"
            android:strokeLineCap="round"
            android:strokeLineJoin="round" />
    </group>
</vector>
`;

const LOGO = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="96dp"
    android:height="96dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
    <path
        android:pathData="M12,17.5A3.5,3.5 0 0 1 15.5,14H33a1,1 0 0 1 1,1v2.5M12,17.5v13A3.5,3.5 0 0 0 15.5,34H33a1,1 0 0 0 1,-1v-3M12,17.5h22a1,1 0 0 1 1,1V26m0,0h-4.5a2.75,2.75 0 0 0 0,5.5H35"
        android:fillColor="#00000000"
        android:strokeColor="#14513C"
        android:strokeWidth="2.4"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />
</vector>
`;

/* The brand green, --accent in tokens.css. This was the indigo of the first
   design until the redesign, which is why the installed icon briefly did not
   match the app it opened. */
const COLORS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#14513C</color>
    <color name="launch_background">#FFFFFF</color>
</resources>
`;

/* The status-bar icon for the daily reminder. Android draws notification icons
   as a white silhouette and ignores their colour, so this must be white on
   transparent — a full-colour icon renders as a solid grey square. */
const NOTIFY = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
    <path
        android:pathData="M12,17.5A3.5,3.5 0 0 1 15.5,14H33a1,1 0 0 1 1,1v2.5M12,17.5v13A3.5,3.5 0 0 0 15.5,34H33a1,1 0 0 0 1,-1v-3M12,17.5h22a1,1 0 0 1 1,1V26m0,0h-4.5a2.75,2.75 0 0 0 0,5.5H35"
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="3.2"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />
</vector>
`;

const LAUNCH = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/launch_background" />
    <item
        android:width="96dp"
        android:height="96dp"
        android:gravity="center"
        android:drawable="@drawable/ic_track_logo" />
</layer-list>
`;

const ADAPTIVE = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_track_foreground"/>
</adaptive-icon>
`;

const res = join(android, "app/src/main/res");

const FILES = [
  [join(res, "drawable/ic_track_foreground.xml"), FOREGROUND],
  [join(res, "drawable/ic_track_logo.xml"), LOGO],
  [join(res, "drawable/launch_screen.xml"), LAUNCH],
  [join(res, "drawable/ic_stat_rozkharcha.xml"), NOTIFY],
  [join(res, "values/ic_launcher_background.xml"), COLORS],
  [join(res, "mipmap-anydpi-v26/ic_launcher.xml"), ADAPTIVE],
  [join(res, "mipmap-anydpi-v26/ic_launcher_round.xml"), ADAPTIVE],
  [
    join(android, "local.properties"),
    `sdk.dir=${SDK}\n`,
  ],
];

for (const [path, contents] of FILES) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
  console.log(`  wrote ${path.slice(root.length + 1)}`);
}

/* Swap the Capacitor splash for ours. */
const stylesPath = join(res, "values/styles.xml");
const styles = await readFile(stylesPath, "utf8");
await writeFile(
  stylesPath,
  styles.replace("@drawable/splash", "@drawable/launch_screen"),
  "utf8",
);
console.log("  patched app/src/main/res/values/styles.xml");

/* This machine's default `java` is JDK 25, which Android Gradle rejects. */
const gradleProps = join(android, "gradle.properties");
let props = await readFile(gradleProps, "utf8");
if (!props.includes("org.gradle.java.home")) {
  props += `\n# The default java on this machine is JDK 25, which Android Gradle rejects.\norg.gradle.java.home=${JDK}\n`;
  await writeFile(gradleProps, props, "utf8");
  console.log("  pinned JDK 21 in android/gradle.properties");
}

console.log("\nAndroid branding applied.");
