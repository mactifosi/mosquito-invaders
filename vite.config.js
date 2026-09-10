import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Project convention: always import via "@/...", never relative src paths.
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  server: { port: 5173 },
});
