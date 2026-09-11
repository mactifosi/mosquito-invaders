import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Project Pages serve from /<repo>/, so assets need that prefix in production.
// Dev stays at "/" for a plain localhost URL.
const base = process.env.GITHUB_ACTIONS ? "/mosquito-invaders/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    // Installable to a phone's home screen, and fully playable offline —
    // Workbox precaches the whole build, and the game needs no network anyway.
    VitePWA({
      // The native (Capacitor) build ships its assets in the app bundle, so the
      // service worker has nothing to add and can't register over capacitor://.
      disable: process.env.CAP_BUILD === "1",
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Mosquito Invaders",
        short_name: "Mosquito",
        description: "Hold Sector 7 against descending waves of mosquitoes.",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#060409",
        theme_color: "#0b0910",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        // The two Google Fonts faces, cached on first run so the marquee
        // survives a flight with no signal.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Project convention: always import via "@/...", never relative src paths.
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  server: { port: 5173 },
});
