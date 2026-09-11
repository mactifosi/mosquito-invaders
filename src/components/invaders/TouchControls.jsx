import React from "react";
import { Crosshair, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE =
  "flex items-center justify-center gap-2 select-none touch-none " +
  "border border-[#33254a] bg-[#1f1530] text-[#efe6ff] py-4 " +
  "active:bg-[#ffb02e] active:text-[#20130a] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]";

/**
 * On-screen controls for touch devices. Flying is a drag on the play field
 * itself (see Game.jsx), so all that's left here is a fire button wide enough
 * for a thumb, and pause.
 */
export default function TouchControls({ press, onPause, paused }) {
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
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button
        type="button"
        aria-label="Fire"
        className={cn(BASE, "text-[#ffb02e] active:text-[#20130a]")}
        {...hold("fire")}
      >
        <Crosshair className="w-4 h-4" />
        <span className="font-['Silkscreen',monospace] text-sm">FIRE</span>
      </button>
      <button
        type="button"
        aria-label={paused ? "Resume" : "Pause"}
        className={cn(BASE, "px-3")}
        onClick={onPause}
      >
        {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </button>
    </div>
  );
}
