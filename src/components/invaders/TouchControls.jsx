import React from "react";
import { ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE =
  "flex items-center justify-center gap-2 select-none touch-none " +
  "border border-[#33254a] bg-[#1f1530] text-[#efe6ff] py-4 " +
  "active:bg-[#ffb02e] active:text-[#20130a] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]";

/**
 * On-screen controls for touch devices. Held buttons write straight into the
 * input ref via `press`, matching keyboard behavior exactly.
 */
export default function TouchControls({ press }) {
  const hold = (control) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      press(control, true);
    },
    onPointerUp: () => press(control, false),
    onPointerLeave: () => press(control, false),
    onPointerCancel: () => press(control, false),
  });

  return (
    <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-2">
      <button type="button" aria-label="Move left" className={cn(BASE)} {...hold("left")}>
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button type="button" aria-label="Move right" className={cn(BASE)} {...hold("right")}>
        <ChevronRight className="w-5 h-5" />
      </button>
      <button
        type="button"
        aria-label="Fire"
        className={cn(BASE, "text-[#ffb02e] active:text-[#20130a]")}
        {...hold("fire")}
      >
        <Crosshair className="w-4 h-4" />
        <span className="font-['Silkscreen',monospace] text-sm">FIRE</span>
      </button>
    </div>
  );
}
