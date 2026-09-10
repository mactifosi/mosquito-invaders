import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project Pages serve from /<repo>/, so assets need that prefix in production.
// Dev stays at "/" for a plain localhost URL.
const base = process.env.GITHUB_ACTIONS ? "/mosquito-invaders/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      // Project convention: always import via "@/...", never relative src paths.
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  server: { port: 5173 },
});
