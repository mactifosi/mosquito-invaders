import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useGameLoop } from "@/engine/useGameLoop";
import { makeLevel, update, W, H, PADDLE_W, START_LIVES } from "@/components/skimmer/model";
import { draw } from "@/components/skimmer/draw";
import { sfx } from "@/components/skimmer/sounds";
import { loadScores, saveScore, getHighScore, qualifies } from "@/components/skimmer/scores";
import { loadSettings, difficultyOf, saveSettings } from "@/lib/settings";
import { haptics, initHaptics } from "@/components/invaders/haptics";
import Leaderboard from "@/components/invaders/Leaderboard";
import InitialsEntry from "@/components/invaders/InitialsEntry";
import SoundToggle from "@/components/arcade/SoundToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYS = {
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

const BAR =
  "flex items-center justify-center gap-2 border border-[#1c5f74] bg-[#0d3b4a] text-[#efe6ff] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fe8c9]";

export default function Skimmer() {
  const canvasRef = useRef(null);
  const game = useRef(null);
  const settings = useRef(loadSettings()).current;
  if (!game.current) {
    game.current = makeLevel(1, 0, START_LIVES, { speed: difficultyOf(settings).speed });
  }

  const [status, setStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [level, setLevel] = useState(1);
  const [scores, setScores] = useState(() => loadScores());
  const [highScore, setHighScore] = useState(() => getHighScore());
  const [needsInitials, setNeedsInitials] = useState(false);
  const [summary, setSummary] = useState(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const input = useRef({ left: false, right: false, launch: false, dragTarget: null });

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
    (nextLevel = 1, keepScore = 0, keepLives = START_LIVES) => {
      sfx.setMuted(settings.muted);
      sfx.unlock();
      initHaptics();
      game.current = makeLevel(nextLevel, keepScore, keepLives, {
        speed: difficultyOf(settings).speed,
      });
      setLevel(nextLevel);
      setScore(keepScore);
      setLives(keepLives);
      setSummary(null);
      setStatus("playing");
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

  /* ---- input: keys, and a drag on the water ---- */
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
        else input.current.launch = true;
        return;
      }
      const k = KEYS[e.key];
      if (k) {
        e.preventDefault();
        input.current[k] = true;
      }
    };
    const up = (e) => {
      if (e.key === " " || e.code === "Space") {
        input.current.launch = false;
        return;
      }
      const k = KEYS[e.key];
      if (k) input.current[k] = false;
    };
    const blur = () => {
      input.current = { left: false, right: false, launch: false, dragTarget: null };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [onStart, togglePause, needsInitials]);

  /* The punt tracks your thumb directly — absolute, not relative: on a paddle
     game you want it under your finger, not trailing it. A tap serves. */
  const drag = useRef(null);
  const toStageX = (clientX, rect) => ((clientX - rect.left) / rect.width) * W;

  const onTouchStart = useCallback((e) => {
    const t = e.changedTouches[0];
    if (!t) return;
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = { id: t.identifier };
    input.current.dragTarget = toStageX(t.clientX, rect);
    input.current.launch = true;
  }, []);
  const onTouchMove = useCallback((e) => {
    const t = e.changedTouches[0];
    if (!t || !drag.current) return;
    if (e.cancelable) e.preventDefault();
    input.current.dragTarget = toStageX(t.clientX, e.currentTarget.getBoundingClientRect());
  }, []);
  const endTouch = useCallback(() => {
    drag.current = null;
    input.current.dragTarget = null;
  }, []);

  // With a mouse the punt follows the cursor whether or not a button is down —
  // that's how a paddle game has always felt — and a click serves.
  const onPointerDown = useCallback((e) => {
    if (e.pointerType === "touch") return;
    input.current.dragTarget = toStageX(e.clientX, e.currentTarget.getBoundingClientRect());
    input.current.launch = true;
  }, []);
  const onPointerMove = useCallback((e) => {
    if (e.pointerType === "touch") return;
    input.current.dragTarget = toStageX(e.clientX, e.currentTarget.getBoundingClientRect());
  }, []);
  const endPointer = useCallback(() => {
    input.current.dragTarget = null;
  }, []);

  const callbacks = useRef({});
  callbacks.current = {
    onScore: setScore,
    onLives: setLives,
    onLaunch: () => sfx.launch(),
    onPaddle: () => sfx.paddle(),
    onWall: () => sfx.wall(),
    onChip: () => sfx.chip(),
    onBreak: (kind) => {
      sfx.breakRaft(kind);
      haptics.hit();
    },
    onHatch: () => sfx.hatch(),
    onSquash: () => {
      sfx.squash();
      haptics.hit();
    },
    onEscape: () => sfx.escape(),
    onPowerup: () => sfx.powerup(),
    onLoseBall: () => {
      sfx.loseBall();
      haptics.loseCraft();
    },
    onLevelClear: () => {
      sfx.levelClear();
      setStatus("levelup");
    },
    onGameOver: () => {
      const g = game.current;
      setSummary({ level: g.level, bestCombo: g.bestCombo, escaped: g.escaped });
      setNeedsInitials(qualifies(g.score));
      sfx.gameOver();
      setStatus("gameover");
    },
  };

  useGameLoop(
    useCallback((dt) => {
      if (statusRef.current === "playing") {
        update(dt, game.current, input.current, callbacks.current);
        // A tap is shorter than a frame: latch the serve here rather than
        // clearing it on pointer-up, or a quick tap is never seen at all.
        input.current.launch = false;
      }
      draw(canvasRef.current, game.current);
    }, []),
    true
  );

  const rafts = game.current?.bricks.length ?? 0;

  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2">
      <div className="relative border border-[#1c5f74] bg-gradient-to-b from-[#0d3b4a] to-[#071c24] px-3 py-2 text-center overflow-hidden">
        <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(16px,5vw,22px)] leading-none m-0 text-[#9fe8c9] drop-shadow-[0_0_10px_rgba(159,232,201,0.35)]">
          SKIMMER
        </h1>
        <div className="mt-1 text-[8px] tracking-[0.28em] uppercase text-[#7fb9c9]">
          Break the rafts before they hatch
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-px bg-[#1c5f74] border border-[#1c5f74]">
        {[
          ["Score", score, "text-[#efe6ff]"],
          ["Level", level, "text-[#9fe8c9]"],
          ["Rafts", rafts, "text-[#ffb02e]"],
        ].map(([label, value, tone]) => (
          <div key={label} className="bg-[#071c24] px-2.5 py-1.5">
            <div className="text-[8.5px] tracking-[0.22em] uppercase text-[#7fb9c9]">{label}</div>
            <div className={`font-['Silkscreen',monospace] text-base mt-0.5 tabular-nums ${tone}`}>
              {value}
            </div>
          </div>
        ))}
        <div className="bg-[#071c24] px-2.5 py-1.5">
          <div className="text-[8.5px] tracking-[0.22em] uppercase text-[#7fb9c9]">Stones</div>
          <div className="flex items-end gap-1 mt-1.5 h-3.5">
            {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
              <span key={i} className="w-[9px] h-[9px] bg-[#efe6ff]" />
            ))}
          </div>
        </div>
      </div>

      <div
        className="relative border border-[#1c5f74] bg-[#071c24] aspect-[360/540] overflow-hidden touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endTouch}
        onTouchCancel={endTouch}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerLeave={endPointer}
      >
        <canvas
          ref={canvasRef}
          aria-label="Skimmer play field"
          className="block w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        <div
          className="absolute inset-0 pointer-events-none mix-blend-multiply"
          style={{
            background: "repeating-linear-gradient(180deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px)",
          }}
        />

        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center bg-[#03121a]/[0.88] backdrop-blur-[2px]">
            {needsInitials && status === "gameover" ? (
              <>
                <h2 className="font-['Silkscreen',monospace] text-[clamp(15px,4.8vw,20px)] m-0 text-[#ffb02e]">
                  NEW HIGH SCORE
                </h2>
                <InitialsEntry score={score} defaultInitials={settings.initials} onSubmit={commitScore} />
              </>
            ) : (
              <>
                <h2
                  className={`font-['Silkscreen',monospace] text-[clamp(16px,5.2vw,22px)] m-0 text-balance ${
                    status === "gameover"
                      ? "text-[#e0384f]"
                      : status === "levelup"
                      ? "text-[#9fe8c9]"
                      : "text-[#ffb02e]"
                  }`}
                >
                  {status === "ready"
                    ? "SKIM THE WATER"
                    : status === "paused"
                    ? "PAUSED"
                    : status === "levelup"
                    ? "WATER CLEARED"
                    : "ALL STONES LOST"}
                </h2>
                <p className="text-[11px] leading-relaxed text-[#7fb9c9] max-w-[30ch]">
                  {status === "ready" && (
                    <>
                      Drag the punt, skim the stone, break every raft. Red rafts are hatching —
                      leave one too long and a mosquito gets out.{" "}
                      <b className="text-[#efe6ff]">Best: {highScore}</b>
                    </>
                  )}
                  {status === "paused" && "The water is still."}
                  {status === "levelup" && `Level ${level} cleared. The next lot sit deeper.`}
                  {status === "gameover" && (
                    <>
                      Final score <b className="text-[#efe6ff]">{score}</b> on level {level}.
                    </>
                  )}
                </p>

                {status === "gameover" && summary && (
                  <dl className="w-full max-w-[260px] grid grid-cols-3 gap-px bg-[#1c5f74] border border-[#1c5f74] text-left">
                    {[
                      ["Level", summary.level],
                      ["Best rally", summary.bestCombo],
                      ["Escaped", summary.escaped],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-[#071c24] px-2 py-1.5">
                        <dt className="text-[7.5px] tracking-[0.18em] uppercase text-[#7fb9c9]">
                          {label}
                        </dt>
                        <dd className="font-['Silkscreen',monospace] text-[13px] text-[#efe6ff] m-0 mt-0.5 tabular-nums">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <Button
                  className="font-['Silkscreen',monospace] text-[13px] bg-[#9fe8c9] text-[#06231b] hover:bg-[#b8f0d8] shadow-[0_3px_0_#2f7a63] rounded-none px-5 py-5"
                  onClick={onStart}
                >
                  {status === "ready"
                    ? "SKIM"
                    : status === "paused"
                    ? "RESUME"
                    : status === "levelup"
                    ? "NEXT WATER"
                    : "SKIM AGAIN"}
                </Button>
                {(status === "ready" || status === "gameover") && (
                  <Leaderboard
                    scores={scores}
                    highlight={status === "gameover" ? score : null}
                    title="Still water · longest rallies"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <div className={cn(BAR, "py-3 text-[10px] text-[#7fb9c9]")}>Drag to steer the punt</div>
        <SoundToggle onChange={(m) => sfx.setMuted(m)} className={cn(BAR, "px-4")} />
        <button
          type="button"
          onClick={togglePause}
          aria-label={status === "paused" ? "Resume" : "Pause"}
          className={cn(BAR, "px-4 active:bg-[#9fe8c9] active:text-[#06231b]")}
        >
          {status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-[9px] leading-snug text-[#7fb9c9] text-center">
        Drag to move · tap to skim · P pauses · a rally scores more with every raft
      </p>
    </div>
  );
}
