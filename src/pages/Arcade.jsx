import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Volume2, VolumeX, Gauge, Trophy } from "lucide-react";
import { GAMES } from "@/games/registry";
import { allHighScores } from "@/lib/scores";
import { loadSettings, saveSettings, DIFFICULTIES } from "@/lib/settings";
import { dailyChallenge, dailyResult } from "@/lib/daily";

/**
 * The arcade floor: one cabinet per game, plus the settings that belong to the
 * shell rather than to any single game.
 */
export default function Arcade() {
  const [settings, setSettings] = useState(loadSettings);
  const highs = allHighScores(GAMES.map((g) => g.id));
  const daily = dailyChallenge();
  const played = dailyResult();

  const update = (patch) => setSettings(saveSettings(patch));

  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2.5">
      <header className="relative border border-[#33254a] bg-gradient-to-b from-[#221635] to-[#160e21] px-3.5 py-4 text-center overflow-hidden">
        <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(19px,6vw,27px)] leading-none m-0 text-[#ffb02e] drop-shadow-[0_0_12px_rgba(255,176,46,0.45)]">
          CADDORA GAMES
        </h1>
        <p className="mt-2 text-[9.5px] tracking-[0.3em] uppercase text-[#9a8cb4]">
          Offline arcade · planes, trains, departure lounges
        </p>
      </header>

      {/* Today's challenge sits above the cabinets: it expires, they don't. */}
      <section className="border border-[#33254a] bg-[#170f22] px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <CalendarDays className="w-3 h-3 text-[#6fe3c0]" />
          <h2 className="text-[8.5px] tracking-[0.28em] uppercase text-[#9a8cb4] font-medium m-0">
            Today&apos;s challenge
          </h2>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="font-['Silkscreen',monospace] text-[13px] text-[#6fe3c0]">
              {daily.label}
            </div>
            <div className="text-[10.5px] text-[#9a8cb4] mt-0.5">{daily.note}</div>
          </div>
          {played ? (
            <div className="text-right shrink-0">
              <div className="text-[8px] tracking-[0.2em] uppercase text-[#9a8cb4]">Your run</div>
              <div className="font-['Silkscreen',monospace] text-[13px] text-[#efe6ff] tabular-nums">
                {played.score}
              </div>
            </div>
          ) : (
            <Link
              to={`${GAMES[0].path}?daily=1`}
              className="shrink-0 font-['Silkscreen',monospace] text-[11px] bg-[#6fe3c0] text-[#0b2a21] px-3 py-2 shadow-[0_3px_0_#2f7a63] hover:bg-[#8bf0d2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb02e]"
            >
              PLAY
            </Link>
          )}
        </div>
        <p className="text-[9.5px] text-[#9a8cb4] mt-2 pt-2 border-t border-[#33254a]">
          One run a day, the same for everyone playing on {daily.dateKey}. Seeded from the date, so
          it works with no signal.
        </p>
      </section>

      {/* The cabinets */}
      <div className="flex flex-col gap-2.5">
        {GAMES.map((game) => (
          <article key={game.id} className="border border-[#33254a] bg-[#0f0a17]">
            <div
              className="px-3 py-2.5 border-b border-[#33254a]"
              style={{ background: "linear-gradient(180deg,#221635,#160e21)" }}
            >
              <h3
                className="font-['Silkscreen',monospace] text-[17px] m-0 leading-none"
                style={{ color: game.accent }}
              >
                {game.title}
              </h3>
              <p className="text-[8.5px] tracking-[0.24em] uppercase text-[#9a8cb4] mt-1.5">
                {game.marquee}
              </p>
            </div>

            <div className="px-3 py-3 flex flex-col gap-3">
              <p className="text-[11px] leading-relaxed text-[#9a8cb4] m-0">{game.blurb}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[10.5px] text-[#9a8cb4]">
                  <Trophy className="w-3 h-3 text-[#ffb02e]" />
                  <span>Best</span>
                  <span className="font-['Silkscreen',monospace] text-[13px] text-[#efe6ff] tabular-nums">
                    {highs[game.id] || 0}
                  </span>
                </div>
                <Link
                  to={game.path}
                  className="font-['Silkscreen',monospace] text-[12px] px-4 py-2.5 shadow-[0_3px_0_#8a5200] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]"
                  style={{ background: game.accent, color: game.ink }}
                >
                  PLAY
                </Link>
              </div>
            </div>
          </article>
        ))}

        {/* Honest about what's here: one cabinet, room for more. */}
        <div className="border border-dashed border-[#33254a] px-3 py-5 text-center">
          <p className="text-[10.5px] text-[#9a8cb4] m-0">
            Cabinet 2 · empty
            <br />
            <span className="text-[9.5px]">The next game plugs in here.</span>
          </p>
        </div>
      </div>

      {/* Shell settings — they apply to every cabinet */}
      <section className="border border-[#33254a] bg-[#170f22] px-3 py-2.5 flex flex-col gap-3">
        <h2 className="text-[8.5px] tracking-[0.28em] uppercase text-[#9a8cb4] font-medium m-0">
          Settings
        </h2>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Gauge className="w-3 h-3 text-[#9a8cb4]" />
            <span className="text-[10px] text-[#9a8cb4]">Difficulty</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(DIFFICULTIES).map(([key, d]) => (
              <button
                key={key}
                type="button"
                onClick={() => update({ difficulty: key })}
                className={`font-['Silkscreen',monospace] text-[10px] py-2 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0] ${
                  settings.difficulty === key
                    ? "bg-[#ffb02e] text-[#20130a] border-[#ffb02e]"
                    : "bg-[#1f1530] text-[#efe6ff] border-[#33254a] hover:border-[#9a8cb4]"
                }`}
              >
                {d.label.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-[9.5px] text-[#9a8cb4] mt-1.5">
            {DIFFICULTIES[settings.difficulty].note}
          </p>
        </div>

        <button
          type="button"
          onClick={() => update({ muted: !settings.muted })}
          className="flex items-center justify-between gap-2 border border-[#33254a] bg-[#1f1530] px-3 py-2.5 text-left hover:border-[#9a8cb4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]"
        >
          <span className="flex items-center gap-2 text-[11px] text-[#efe6ff]">
            {settings.muted ? (
              <VolumeX className="w-3.5 h-3.5 text-[#e0384f]" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#6fe3c0]" />
            )}
            Sound
          </span>
          <span
            className={`font-['Silkscreen',monospace] text-[11px] ${
              settings.muted ? "text-[#e0384f]" : "text-[#6fe3c0]"
            }`}
          >
            {settings.muted ? "OFF" : "ON"}
          </span>
        </button>
        <p className="text-[9.5px] text-[#9a8cb4] -mt-1.5">
          The app plays through the silent switch, so this is the way to keep it quiet on a
          red-eye.
        </p>
      </section>
    </div>
  );
}
