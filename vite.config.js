import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // `host: true` exposes the dev server on the LAN so the app can be opened
  // on a real phone at http://<pc-ip>:5173 before the APK exists.
  server: { host: true, port: 5173 },
  // Capacitor loads the build from a file:// style scheme, so assets must be relative.
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
})
