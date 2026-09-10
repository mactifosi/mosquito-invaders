import React from "react";

// Gold / silver / bronze for the podium, muted violet for the rest.
const MEDAL = ["text-[#ffb02e]", "text-[#d8d3e4]", "text-[#c98a5b]"];

/**
 * Ranked local scores. `highlight` marks the run that just ended — matched
 * once, so a repeat of the same score doesn't light up every row.
 */
export default function Leaderboard({ scores, highlight = null }) {
  let claimed = false;

  return (
    <div className="w-full max-w-[260px] border-t border-[#33254a] pt-2.5">
      <h3 className="text-[8.5px] tracking-[0.28em] uppercase text-[#9a8cb4] font-medium mb-2">
        Sector 7 · top pilots
      </h3>

      {scores.length === 0 ? (
        <p className="text-[10.5px] text-[#9a8cb4]">No runs logged yet. Be the first.</p>
      ) : (
        <ol className="flex flex-col gap-[3px]">
          {scores.map((s, i) => {
            const isRun = !claimed && highlight != null && s === highlight;
            if (isRun) claimed = true;
            return (
              <li
                key={`${s}-${i}`}
                className={`flex justify-between gap-2.5 text-[11px] tabular-nums ${
                  isRun ? "text-[#6fe3c0]" : MEDAL[i] || "text-[#9a8cb4]"
                }`}
              >
                <span className="tracking-[0.1em]">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
