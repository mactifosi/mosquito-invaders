import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Trophy } from "lucide-react";
import { GAMES } from "@/games/registry";
import { allHighScores } from "@/lib/scores";
import { loadSettings, saveSettings, DIFFICULTIES } from "@/lib/settings";
import { dailyChallenge, dailyResult } from "@/lib/daily";
import SoundToggle from "@/components/arcade/SoundToggle";
import Avatar from "@/components/arcade/Avatar";

/**
 * The arcade floor: one cabinet per game, today's challenge, and the settings
 * that belong to the shell rather than to any single game.
 *
 * Written to fit a phone screen. The first pass ran to two and a half screens,
 * which put the sound toggle below the fold — the one control most likely to be
 * wanted in a hurry.
 */
export default function Arcade() {
  const [settings, setSettings] = useState(loadSettings);
  const highs = allHighScores(GAMES.map((g) => g.id));
  const daily = dailyChallenge();
  const played = dailyResult();

  const update = (patch) => setSettings(saveSettings(patch));

  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2">
      <header className="relative border border-[#33254a] bg-gradient-to-b from-[#221635] to-[#160e21] px-3 py-2.5 overflow-hidden flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(15px,4.6vw,20px)] leading-none m-0 text-[#ffb02e] drop-shadow-[0_0_10px_rgba(255,176,46,0.4)]">
            POCKET ARCADE
          </h1>
          <p className="mt-1 text-[8px] tracking-[0.24em] uppercase text-[#9a8cb4] truncate">
            Offline arcade · for travelling
          </p>
        </div>
        <SoundToggle
          label
          className="shrink-0 border border-[#33254a] bg-[#1f1530] text-[#efe6ff] px-2.5 py-2"
        />
      </header>

      {/* Today's challenge: it expires, the cabinets don't. */}
      <section className="border border-[#33254a] bg-[#170f22] px-2.5 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="w-3 h-3 text-[#6fe3c0]" />
          <h2 className="text-[8px] tracking-[0.24em] uppercase text-[#9a8cb4] font-medium m-0">
            Today&apos;s challenge · one run
          </h2>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-['Silkscreen',monospace] text-[12px] text-[#6fe3c0] truncate">
              {daily.label}
            </div>
            <div className="text-[10px] text-[#9a8cb4] truncate">{daily.note}</div>
          </div>
          {played ? (
            <div className="text-right shrink-0">
              <div className="text-[7.5px] tracking-[0.18em] uppercase text-[#9a8cb4]">Your run</div>
              <div className="font-['Silkscreen',monospace] text-[12px] text-[#efe6ff] tabular-nums">
                {played.score}
              </div>
            </div>
          ) : (
            <Link
              to={`${GAMES[0].path}?daily=1`}
              className="shrink-0 font-['Silkscreen',monospace] text-[10px] bg-[#6fe3c0] text-[#0b2a21] px-3 py-1.5 shadow-[0_2px_0_#2f7a63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb02e]"
            >
              PLAY
            </Link>
          )}
        </div>
      </section>

      {/* The cabinets: one tile each, two to a row, so the floor grows by rows. */}
      <section className="grid grid-cols-2 gap-2">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            to={game.path}
            aria-label={`Play ${game.title}`}
            className="group flex flex-col border border-[#33254a] bg-[#150e20] p-1.5 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]"
          >
            <Avatar
              game={game}
              className="block w-full aspect-square [image-rendering:auto] border border-[#0b0910]"
            />
            <h3
              className="font-['Silkscreen',monospace] text-[11px] leading-tight m-0 mt-1.5 truncate"
              style={{ color: game.accent }}
            >
              {game.title}
            </h3>
            <p className="text-[10px] leading-snug text-[#9a8cb4] m-0 mt-0.5 line-clamp-2 min-h-[2lh]">
              {game.tagline}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Trophy className="w-3 h-3 text-[#ffb02e] shrink-0" />
              <span className="font-['Silkscreen',monospace] text-[11px] text-[#efe6ff] tabular-nums truncate">
                {(highs[game.id] || 0).toLocaleString()}
              </span>
            </div>
          </Link>
        ))}

        {/* Keeps the last row even, and says the floor isn't finished. */}
        {GAMES.length % 2 === 1 && (
          <div className="flex flex-col items-center justify-center gap-1 border border-dashed border-[#33254a] p-1.5 text-center">
            <span className="font-['Silkscreen',monospace] text-[22px] leading-none text-[#5b4d74]">+</span>
            <p className="text-[10px] text-[#9a8cb4] m-0">More cabinets soon</p>
          </div>
        )}
      </section>

      {/* Settings, on one line each */}
      <section className="border border-[#33254a] bg-[#170f22] px-2.5 py-2 flex items-center gap-2">
        <span className="text-[8px] tracking-[0.24em] uppercase text-[#9a8cb4] shrink-0">
          Difficulty
        </span>
        <div className="grid grid-cols-3 gap-1 flex-1">
          {Object.entries(DIFFICULTIES).map(([key, d]) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ difficulty: key })}
              className={`font-['Silkscreen',monospace] text-[9px] py-1.5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0] ${
                settings.difficulty === key
                  ? "bg-[#ffb02e] text-[#20130a] border-[#ffb02e]"
                  : "bg-[#1f1530] text-[#efe6ff] border-[#33254a]"
              }`}
            >
              {d.label.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <p className="text-[9px] text-[#9a8cb4] text-center leading-snug">
        Sound plays through the phone&apos;s silent switch — use the speaker button to keep it
        quiet.
      </p>
    </div>
  );
}
