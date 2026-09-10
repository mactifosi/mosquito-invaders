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
  summary,
  species = [],
  bossCleared = false,
  bossNext = false,
  onStart,
}) {
  if (status === "playing") return null;

  const isReady = status === "ready";
  const isLevelUp = status === "levelup";
  const isPaused = status === "paused";

  // Paused is a light-touch screen: no leaderboard, nothing to read, one way out.
  if (isPaused) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 px-4 text-center bg-[#08050e]/[0.86] backdrop-blur-[2px]">
        <h2 className="font-['Silkscreen',monospace] text-[clamp(17px,5.4vw,23px)] m-0 text-[#6fe3c0]">
          PAUSED
        </h2>
        <p className="text-[11px] text-[#9a8cb4]">The swarm is holding position.</p>
        <Button className={CTA} onClick={onStart}>
          <Play className="w-3.5 h-3.5 mr-2" />
          RESUME
        </Button>
      </div>
    );
  }

  const title = isReady
    ? "INSERT COIN"
    : isLevelUp
    ? bossCleared
      ? "THE QUEEN IS DOWN"
      : "SWARM CLEARED"
    : deathReason === "landed"
    ? "THE SWARM LANDED"
    : deathReason === "swarmed"
    ? "TAKEN DOWN MID-AIR"
    : "CRAFT DOWN";
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
            {bossNext ? (
              <>
                <b className="text-[#e0384f] font-semibold">Wave {level + 1} is a queen</b> — she
                seeds brood and takes a lot of killing.
              </>
            ) : (
              <>
                <b className="text-[#efe6ff] font-semibold">Wave {level + 1}</b> flies faster and
                bites sooner.
              </>
            )}
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

      {!isReady && !isLevelUp && summary && (
        <dl className="w-full max-w-[260px] grid grid-cols-3 gap-px bg-[#33254a] border border-[#33254a] text-left">
          {[
            ["Wave", summary.wave],
            ["Best streak", summary.bestStreak],
            ["Accuracy", `${summary.accuracy}%`],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#170f22] px-2 py-1.5">
              <dt className="text-[7.5px] tracking-[0.18em] uppercase text-[#9a8cb4]">{label}</dt>
              <dd className="font-['Silkscreen',monospace] text-[13px] text-[#efe6ff] m-0 mt-0.5 tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

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
