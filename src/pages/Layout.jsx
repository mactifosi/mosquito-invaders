import React from "react";

/**
 * The cabinet ground every screen sits on. Safe-area padding matters on native,
 * where Capacitor draws under the status bar and home indicator.
 */
export default function Layout({ children }) {
  return (
    <div
      className="min-h-[100dvh] w-full flex justify-center px-3 bg-cabinet-field text-cabinet-ink font-plex"
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 50% -10%, #241634 0%, #0b0910 55%, #060409 100%)",
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>
  );
}
