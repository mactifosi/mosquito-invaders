import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useGameLoop } from "@/engine/useGameLoop";
import { makeLevel, update } from "@/components/piranha/model";
import { draw, W, H, OFFSET_X, OFFSET_Y } from "@/components/piranha/draw";
import { TILE, MAZE_W, MAZE_H } from "@/components/piranha/maze";
import { sfx } from "@/components/piranha/sounds";
import { loadScores, saveScore, getHighScore, qualifies } from "@/components/piranha/scores";
import { loadSettings, difficultyOf, saveSettings } from "@/lib/settings";
import { haptics, initHaptics } from "@/components/invaders/haptics";
import Leaderboard from "@/components/invaders/Leaderboard";
import InitialsEntry from "@/components/invaders/InitialsEntry";
import { Button } from "@/components/ui/button";
import SoundToggle from "@/components/arcade/SoundToggle";

const KEY_DIRS = {
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
};

/** Swipe rather than drag: a maze takes four discrete directions, not a position. */
const SWIPE_MIN = 18;

export default function Piranha() {
  const canvasRef = useRef(null);
  const game = useRef(null);
  const settings = useRef(loadSettings()).current;
  if (!game.current) game.current = makeLevel(1, 0, 3, { speed: difficultyOf(settings).speed });

  const [status, setStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [scores, setScores] = useState(() => loadScores());
  const [highScore, setHighScore] = useState(() => getHighScore());
  const [needsInitials, setNeedsInitials] = useState(false);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const input = useRef({ want: null });

  /* ---- canvas ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      draw(canvas, game.current);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const start = useCallback(
    (nextLevel = 1, keepScore = 0, keepLives = 3) => {
      sfx.setMuted(settings.muted);
      sfx.unlock();
      initHaptics();
      game.current = makeLevel(nextLevel, keepScore, keepLives, {
        speed: difficultyOf(settings).speed,
      });
      setLevel(nextLevel);
      setScore(keepScore);
      setLives(keepLives);
      setStatus("playing");
      sfx.ready();
    },
    [settings]
  );

  const togglePause = useCallback(() => {
    if (statusRef.current === "playing") setStatus("paused");
    else if (statusRef.current === "paused") setStatus("playing");
  }, []);

  const onStart = useCallback(() => {
    const s = statusRef.current;
    if (s === "paused") togglePause();
    else if (s === "levelup") start(game.current.level + 1, game.current.score, game.current.lives);
    else start();
  }, [start, togglePause]);

  const commitScore = useCallback((initials) => {
    if (initials) saveSettings({ initials });
    const next = saveScore(game.current.score, initials || "···");
    setScores(next);
    setHighScore(next[0]?.score || 0);
    setNeedsInitials(false);
  }, []);

  /* ---- input: keys, and a swipe on the maze ---- */
  useEffect(() => {
    const down = (e) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (statusRef.current !== "playing" && !needsInitials) onStart();
        return;
      }
      const dir = KEY_DIRS[e.key];
      if (dir) {
        e.preventDefault();
        input.current.want = dir;
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onStart, togglePause, needsInitials]);

  const swipe = useRef(null);
  const onTouchStart = useCallback((e) => {
    const t = e.changedTouches[0];
    if (t) swipe.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchMove = useCallback((e) => {
    const s = swipe.current;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (e.cancelable) e.preventDefault();
    input.current.want =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    swipe.current = { x: t.clientX, y: t.clientY }; // let one finger keep steering
  }, []);
  const endSwipe = useCallback(() => {
    swipe.current = null;
  }, []);

  /* ---- loop ---- */
  const callbacks = useRef({});
  callbacks.current = {
    onScore: setScore,
    onLives: setLives,
    onPellet: () => sfx.pellet(),
    onCarrot: () => sfx.carrot(),
    onEatFish: () => {
      sfx.eatFish();
      haptics.hit();
    },
    onNearMiss: () => sfx.nearMiss(),
    onChain: () => {
      sfx.chain();
      haptics.hit();
    },
    onDeath: () => {
      sfx.death();
      haptics.loseCraft();
    },
    onLevelClear: () => {
      sfx.levelClear();
      setStatus("levelup");
    },
    onGameOver: () => {
      setNeedsInitials(qualifies(game.current.score));
      setStatus("gameover");
    },
  };

  useGameLoop(
    useCallback((dt) => {
      if (statusRef.current === "playing") update(dt, game.current, input.current, callbacks.current);
      draw(canvasRef.current, game.current);
    }, []),
    true
  );

  const remaining = game.current?.pellets.remaining ?? 0;

  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2">
      <div className="relative border border-[#1c5f74] bg-gradient-to-b from-[#0d3b4a] to-[#071c24] px-3 py-2 text-center overflow-hidden">
        <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(16px,5vw,22px)] leading-none m-0 text-[#ff8a3d] drop-shadow-[0_0_10px_rgba(255,138,61,0.4)]">
          PIRANHA
        </h1>
        <div className="mt-1 text-[8px] tracking-[0.28em] uppercase text-[#7fb9c9]">
          One bunny · four sets of teeth
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-px bg-[#1c5f74] border border-[#1c5f74]">
        {[
          ["Score", score, "text-[#efe6ff]"],
          ["Depth", level, "text-[#9fe8c9]"],
          ["Algae", remaining, "text-[#ff8a3d]"],
        ].map(([label, value, tone]) => (
          <div key={label} className="bg-[#071c24] px-2.5 py-1.5">
            <div className="text-[8.5px] tracking-[0.22em] uppercase text-[#7fb9c9]">{label}</div>
            <div className={`font-['Silkscreen',monospace] text-base mt-0.5 tabular-nums ${tone}`}>
              {value}
            </div>
          </div>
        ))}
        <div className="bg-[#071c24] px-2.5 py-1.5">
          <div className="text-[8.5px] tracking-[0.22em] uppercase text-[#7fb9c9]">Bunnies</div>
          <div className="flex items-end gap-1 mt-1.5 h-3.5">
            {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
              <span key={i} className="w-[9px] h-[11px] bg-[#f5f0e6] rounded-t-full" />
            ))}
          </div>
        </div>
      </div>

      <div
        className="relative border border-[#1c5f74] bg-[#071c24] aspect-[360/540] overflow-hidden touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endSwipe}
        onTouchCancel={endSwipe}
      >
        <canvas
          ref={canvasRef}
          aria-label="Piranha maze"
          className="block w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        <div
          className="absolute inset-0 pointer-events-none mix-blend-multiply"
          style={{
            background:
              "repeating-linear-gradient(180deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px)",
          }}
        />

        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 px-4 text-center bg-[#03121a]/[0.88] backdrop-blur-[2px]">
            {needsInitials && status === "gameover" ? (
              <>
                <h2 className="font-['Silkscreen',monospace] text-[clamp(15px,4.8vw,20px)] m-0 text-[#ff8a3d]">
                  NEW HIGH SCORE
                </h2>
                <InitialsEntry
                  score={score}
                  defaultInitials={settings.initials}
                  onSubmit={commitScore}
                />
              </>
            ) : (
              <>
                <h2
                  className={`font-['Silkscreen',monospace] text-[clamp(16px,5.2vw,22px)] m-0 text-balance ${
                    status === "gameover"
                      ? "text-[#e0384f]"
                      : status === "levelup"
                      ? "text-[#9fe8c9]"
                      : "text-[#ff8a3d]"
                  }`}
                >
                  {status === "ready"
                    ? "INTO THE WATER"
                    : status === "paused"
                    ? "PAUSED"
                    : status === "levelup"
                    ? "SHOAL OUTSWUM"
                    : "EATEN"}
                </h2>
                <p className="text-[11px] leading-relaxed text-[#7fb9c9] max-w-[30ch]">
                  {status === "ready" && (
                    <>
                      Clear the algae. Four piranhas want the bunny — a carrot turns the hunt
                      around for seven seconds. <b className="text-[#efe6ff]">Best: {highScore}</b>
                    </>
                  )}
                  {status === "paused" && "The shoal is circling."}
                  {status === "levelup" && `Depth ${level} cleared. They swim faster down here.`}
                  {status === "gameover" && (
                    <>
                      Final score <b className="text-[#efe6ff]">{score}</b> at depth {level}.
                    </>
                  )}
                </p>
                <Button
                  className="font-['Silkscreen',monospace] text-[13px] bg-[#ff8a3d] text-[#231003] hover:bg-[#ffa365] shadow-[0_3px_0_#8a4200] rounded-none px-5 py-5"
                  onClick={onStart}
                >
                  {status === "ready"
                    ? "DIVE IN"
                    : status === "paused"
                    ? "RESUME"
                    : status === "levelup"
                    ? "GO DEEPER"
                    : "SWIM AGAIN"}
                </Button>
                {(status === "ready" || status === "gameover") && (
                  <Leaderboard
                    scores={scores}
                    highlight={status === "gameover" ? score : null}
                    title="Shoal river · deepest runs"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <div className="flex items-center justify-center border border-[#1c5f74] bg-[#0d3b4a] py-3 text-[10px] text-[#7fb9c9]">
          Swipe the water to steer
        </div>
        <SoundToggle
          onChange={(m) => sfx.setMuted(m)}
          className="border border-[#1c5f74] bg-[#0d3b4a] text-[#efe6ff] px-4"
        />
        <button
          type="button"
          aria-label={status === "paused" ? "Resume" : "Pause"}
          onClick={togglePause}
          className="flex items-center justify-center border border-[#1c5f74] bg-[#0d3b4a] text-[#efe6ff] px-4 active:bg-[#ff8a3d] active:text-[#231003] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fe8c9]"
        >
          {status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-[9px] leading-snug text-[#7fb9c9] text-center">
        Swipe to swim · P pauses · a carrot turns the hunt around
      </p>
    </div>
  );
}
