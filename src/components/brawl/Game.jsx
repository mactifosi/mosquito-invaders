import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Pause, Play, Shield } from "lucide-react";
import { useGameLoop } from "@/engine/useGameLoop";
import { makeMatch, update, MOVES, ROUNDS_TO_WIN } from "@/components/brawl/model";
import { draw, W, H } from "@/components/brawl/draw";
import { sfx } from "@/components/brawl/sounds";
import { loadScores, saveScore, getHighScore, qualifies } from "@/components/brawl/scores";
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
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  j: "light", J: "light",
  k: "heavy", K: "heavy",
  l: "low", L: "low",
  i: "special", I: "special",
  " ": "block",
};

const PAD =
  "flex items-center justify-center select-none touch-none border border-[#33254a] " +
  "bg-[#1f1530] text-[#efe6ff] py-3 active:bg-[#ffb02e] active:text-[#20130a] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]";

export default function Brawl() {
  const canvasRef = useRef(null);
  const game = useRef(null);
  const settings = useRef(loadSettings()).current;
  const difficultyLevel = { easy: 0, normal: 1, hard: 2 }[settings.difficulty] ?? 1;
  if (!game.current) game.current = makeMatch(1, 0, { difficulty: difficultyLevel });

  const [status, setStatus] = useState("ready"); // ready | playing | paused | over
  const [score, setScore] = useState(0);
  const [wins, setWins] = useState([0, 0]);
  const [outcome, setOutcome] = useState(null);
  const [scores, setScores] = useState(() => loadScores());
  const [highScore, setHighScore] = useState(() => getHighScore());
  const [needsInitials, setNeedsInitials] = useState(false);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const input = useRef({});

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

  const start = useCallback(() => {
    sfx.setMuted(settings.muted);
    sfx.unlock();
    initHaptics();
    game.current = makeMatch(1, 0, { difficulty: difficultyLevel });
    input.current = {};
    setScore(0);
    setWins([0, 0]);
    setOutcome(null);
    setStatus("playing");
    sfx.roundStart();
  }, [settings, difficultyLevel]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "playing") setStatus("paused");
    else if (statusRef.current === "paused") setStatus("playing");
  }, []);

  const onStart = useCallback(() => {
    if (statusRef.current === "paused") togglePause();
    else start();
  }, [start, togglePause]);

  const commitScore = useCallback((initials) => {
    if (initials) saveSettings({ initials });
    const next = saveScore(game.current.score, initials || "···");
    setScores(next);
    setHighScore(next[0]?.score || 0);
    setNeedsInitials(false);
  }, []);

  /* ---- input ---- */
  useEffect(() => {
    const down = (e) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.key === "Enter" && statusRef.current !== "playing" && !needsInitials) {
        onStart();
        return;
      }
      const k = KEYS[e.key];
      if (k) {
        e.preventDefault();
        input.current[k] = true;
      }
    };
    const up = (e) => {
      const k = KEYS[e.key];
      if (k) input.current[k] = false;
    };
    const blur = () => {
      input.current = {};
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

  // Held for movement and block; tapped for attacks — an attack commits for its
  // whole animation, so the press only has to register once.
  const hold = (control) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      input.current[control] = true;
    },
    onPointerUp: () => (input.current[control] = false),
    onPointerLeave: () => (input.current[control] = false),
    onPointerCancel: () => (input.current[control] = false),
  });

  const tap = (control) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      input.current[control] = true;
      setTimeout(() => (input.current[control] = false), 60);
    },
  });

  const callbacks = useRef({});
  callbacks.current = {
    onScore: setScore,
    onRound: setWins,
    onSwing: (m) => sfx.swing(m),
    onHit: (d) => {
      sfx.hit(d);
      haptics.hit();
    },
    onBlock: () => sfx.block(),
    onJump: () => sfx.jump(),
    onSpecial: () => sfx.special(),
    onRoundStart: () => sfx.roundStart(),
    onKO: () => {
      sfx.ko();
      haptics.loseCraft();
    },
    onMatchOver: (who) => {
      setOutcome(who);
      if (who === "player") sfx.matchWon();
      else sfx.matchLost();
      setNeedsInitials(qualifies(game.current.score));
      setStatus("over");
    },
  };

  useGameLoop(
    useCallback((dt) => {
      if (statusRef.current === "playing") update(dt, game.current, input.current, callbacks.current);
      draw(canvasRef.current, game.current);
    }, []),
    true
  );

  const meterReady = (game.current?.fighters[0].meter ?? 0) >= MOVES.special.cost;

  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2">
      <div className="relative border border-[#33254a] bg-gradient-to-b from-[#2a1838] to-[#1a1024] px-3 py-2 text-center overflow-hidden">
        <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(16px,5vw,22px)] leading-none m-0 text-[#e0384f] drop-shadow-[0_0_10px_rgba(224,56,79,0.4)]">
          BAYOU BRAWL
        </h1>
        <div className="mt-1 text-[8px] tracking-[0.28em] uppercase text-[#9a8cb4]">
          Best of three · Sector 7 vs Shoal River
        </div>
      </div>

      <div className="relative border border-[#33254a] bg-[#1a1024] aspect-[360/540] overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-label="Bayou Brawl arena"
          className="block w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        <div
          className="absolute inset-0 pointer-events-none mix-blend-multiply"
          style={{
            background: "repeating-linear-gradient(180deg, rgba(0,0,0,.2) 0 1px, transparent 1px 3px)",
          }}
        />

        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center bg-[#120a1c]/[0.9] backdrop-blur-[2px]">
            {needsInitials && status === "over" ? (
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
                    status === "over"
                      ? outcome === "player"
                        ? "text-[#6fe3c0]"
                        : "text-[#e0384f]"
                      : "text-[#ffb02e]"
                  }`}
                >
                  {status === "ready"
                    ? "STEP UP"
                    : status === "paused"
                    ? "PAUSED"
                    : outcome === "player"
                    ? "YOU WIN"
                    : "YOU LOSE"}
                </h2>
                <p className="text-[11px] leading-relaxed text-[#9a8cb4] max-w-[30ch]">
                  {status === "ready" && (
                    <>
                      Vex against Gnash, best of {ROUNDS_TO_WIN} rounds. Block low attacks by
                      crouching, and spend a full meter on a special.{" "}
                      <b className="text-[#efe6ff]">Best: {highScore}</b>
                    </>
                  )}
                  {status === "paused" && "The bayou waits."}
                  {status === "over" && (
                    <>
                      Rounds {wins[0]}–{wins[1]}. Final score{" "}
                      <b className="text-[#efe6ff]">{score}</b>.
                    </>
                  )}
                </p>
                <Button
                  className="font-['Silkscreen',monospace] text-[13px] bg-[#e0384f] text-[#1a0509] hover:bg-[#ef5568] shadow-[0_3px_0_#7a1020] rounded-none px-5 py-5"
                  onClick={onStart}
                >
                  {status === "ready" ? "FIGHT" : status === "paused" ? "RESUME" : "REMATCH"}
                </Button>
                {(status === "ready" || status === "over") && (
                  <Leaderboard
                    scores={scores}
                    highlight={status === "over" ? score : null}
                    title="Bayou · toughest"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Two thumbs: movement left, attacks right. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid grid-cols-3 gap-1">
          <button {...hold("left")} aria-label="Move left" className={cn(PAD)}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="grid grid-rows-2 gap-1">
            <button {...hold("up")} aria-label="Jump" className={cn(PAD, "py-1")}>
              <ChevronUp className="w-4 h-4" />
            </button>
            <button {...hold("down")} aria-label="Crouch" className={cn(PAD, "py-1")}>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <button {...hold("right")} aria-label="Move right" className={cn(PAD)}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 grid-rows-2 gap-1">
          <button {...tap("light")} aria-label="Light attack" className={cn(PAD, "py-1 font-['Silkscreen',monospace] text-[10px]")}>
            JAB
          </button>
          <button {...tap("heavy")} aria-label="Heavy attack" className={cn(PAD, "py-1 font-['Silkscreen',monospace] text-[10px]")}>
            SLAM
          </button>
          <button {...tap("low")} aria-label="Low attack" className={cn(PAD, "py-1 font-['Silkscreen',monospace] text-[10px]")}>
            SWEEP
          </button>
          <button
            {...tap("special")}
            aria-label="Special"
            className={cn(
              PAD,
              "py-1 font-['Silkscreen',monospace] text-[10px]",
              meterReady && "bg-[#ffb02e] text-[#20130a] border-[#ffb02e]"
            )}
          >
            SPECIAL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <button {...hold("block")} aria-label="Block" className={cn(PAD, "gap-2")}>
          <Shield className="w-4 h-4" />
          <span className="font-['Silkscreen',monospace] text-[11px]">BLOCK</span>
        </button>
        <SoundToggle onChange={(m) => sfx.setMuted(m)} className={cn(PAD, "px-4")} />
        <button onClick={togglePause} aria-label={status === "paused" ? "Resume" : "Pause"} className={cn(PAD, "px-4")}>
          {status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
