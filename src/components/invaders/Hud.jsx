import React from "react";

function Cell({ label, value, tone = "text-[#efe6ff]" }) {
  return (
    <div className="bg-[#170f22] px-2.5 py-1.5">
      <div className="text-[8.5px] tracking-[0.22em] uppercase text-[#9a8cb4]">{label}</div>
      <div className={`font-['Silkscreen',monospace] text-base mt-0.5 tabular-nums ${tone}`}>
        {value}
      </div>
    </div>
  );
}

/** Score / wave / swarm / remaining craft. The only React state the loop lifts. */
export default function Hud({ score, level, swarm, lives }) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-px bg-[#33254a] border border-[#33254a]">
      <Cell label="Score" value={score} />
      <Cell label="Wave" value={level} tone="text-[#6fe3c0]" />
      <Cell label="Swarm" value={swarm} tone="text-[#e0384f]" />
      <div className="bg-[#170f22] px-2.5 py-1.5">
        <div className="text-[8.5px] tracking-[0.22em] uppercase text-[#9a8cb4]">Craft</div>
        <div className="flex items-end gap-1 mt-1.5 h-3.5">
          {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
            <span
              key={i}
              className="w-[13px] h-[9px] bg-[#ffb02e]"
              style={{ clipPath: "polygon(50% 0, 100% 78%, 78% 100%, 22% 100%, 0 78%)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
