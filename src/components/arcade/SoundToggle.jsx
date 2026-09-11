import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { loadSettings, saveSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Sound on/off, wherever you happen to be.
 *
 * It lived only at the bottom of the arcade screen, below the fold, and nowhere
 * at all inside a game — so the one control you need mid-flight was the hardest
 * to reach. This sits in the arcade header and in both games' control bars,
 * writing to the same shared setting.
 */
export default function SoundToggle({ onChange, className, label = false }) {
  const [muted, setMuted] = useState(() => loadSettings().muted);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    saveSettings({ muted: next });
    onChange?.(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={muted}
      className={cn(
        "flex items-center justify-center gap-1.5 select-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]",
        className
      )}
    >
      {muted ? (
        <VolumeX className="w-4 h-4 text-[#e0384f]" />
      ) : (
        <Volume2 className="w-4 h-4 text-[#6fe3c0]" />
      )}
      {label && (
        <span className="font-['Silkscreen',monospace] text-[10px]">{muted ? "OFF" : "ON"}</span>
      )}
    </button>
  );
}
