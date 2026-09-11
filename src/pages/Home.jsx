import React from "react";
import Game from "@/components/invaders/Game";

/**
 * The single route. Full-bleed cabinet ground; the game owns everything inside.
 * Fonts are loaded once in index.html.
 */
export default function Home() {
  return (
    <div
      className="min-h-[100dvh] w-full flex justify-center px-3 bg-cabinet-field text-cabinet-ink font-plex"
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 50% -10%, #241634 0%, #0b0910 55%, #060409 100%)",
        // Native (Capacitor) draws under the status bar and home indicator, so
        // the cabinet has to keep itself clear of them. No-ops in a browser.
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <Game />
    </div>
  );
}
