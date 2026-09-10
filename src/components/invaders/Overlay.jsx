import React from "react";
import { Play, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Leaderboard from "@/components/invaders/Leaderboard";

const CTA =
  "font-['Silkscreen',monospace] text-[13px] bg-[#ffb02e] text-[#20130a] " +
  "hover:bg-[#ffc157] shadow-[0_3px_0_#8a5200] rounded-none px-5 py-5";

/**
 * Ready / level-clear / game-over screens. Sits over a freshly drawn frame, so
 * the swarm is visible behind the title.
 */
export default function Overlay({
  status,
  score,
  level,
  highScore,
  scores,
  deathReason,
  species = [],
  onStart,
}) {
  if (status === "playing") return null;

  const isReady = status === "ready";
  const isLevelUp = status === "levelup";

  const title = isReady ? "INSERT COIN" : isLevelUp ? "SWARM CLEARED" : deathReason === "landed" ? "THE SWARM LANDED" : "CRAFT DOWN";
  const titleTone = isReady
    ? "text-[#ffb02e]"
    : isLevelUp
    ? "text-[#6fe3c0]"
    : "text-[#e0384f]";
  const Icon = isReady ? Play : isLevelUp ? ChevronRight : RotateCcw;
  const cta = isReady ? "PLAY" : isLevelUp ? "CONTINUE" : "PLAY AGAIN";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 px-4 py-5 text-center bg-[#08050e]/[0.86] backdrop-blur-[2px]">
      <h2
        className={`font-['Silkscreen',monospace] text-[clamp(17px,5.4vw,23px)] leading-tight m-0 text-balance ${titleTone}`}
      >
        {title}
      </h2>

      <p className="text-[11px] leading-relaxed text-[#9a8cb4] max-w-[30ch]">
        {isReady && (
          <>
            A swarm is descending on Sector 7. Fly the citronella craft, hold the line, and
            don&apos;t let them land. <b className="text-[#efe6ff] font-semibold">Best: {highScore}</b>
          </>
        )}
        {isLevelUp && (
          <>
            Wave {level} repelled.{" "}
            <b className="text-[#efe6ff] font-semibold">Wave {level + 1}</b> flies faster and bites
            sooner.
          </>
        )}
        {!isReady && !isLevelUp && (
          <>
            Final score <b className="text-[#efe6ff] font-semibold">{score}</b> on wave {level}
            {score > 0 && score >= highScore ? " — new sector record." : "."}
          </>
        )}
      </p>

      <Button className={CTA} onClick={onStart}>
        <Icon className="w-3.5 h-3.5 mr-2" />
        {cta}
      </Button>

      {isReady && species.length > 0 && (
        <div className="w-full max-w-[260px] border-t border-[#33254a] pt-2.5">
          <h3 className="text-[8.5px] tracking-[0.28em] uppercase text-[#9a8cb4] font-medium mb-2">
            Field guide · swarm rows
          </h3>
          <div className="flex flex-col gap-1.5">
            {species.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-[10.5px]">
                <span className="w-[9px] h-[9px] shrink-0" style={{ background: s.body }} />
                <span className="italic text-[#efe6ff]">{s.name}</span>
                <span className="ml-auto text-[#9a8cb4] tabular-nums">{s.pts} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLevelUp && <Leaderboard scores={scores} highlight={isReady ? null : score} />}
    </div>
  );
}
