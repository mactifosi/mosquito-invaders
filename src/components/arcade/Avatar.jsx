import React from "react";

/**
 * A cabinet's face on the home screen.
 *
 * Drawn as inline SVG so the arcade still ships no image assets and works
 * offline. Keyed by game id; a game without a drawing yet gets its initial on
 * its accent colour, so a new cabinet shows up on the floor before anyone has
 * drawn it.
 */
const DRAWINGS = {
  "mosquito-invaders": (
    <>
      <rect width="64" height="64" fill="#3a2a12" />
      <circle cx="10" cy="12" r="1" fill="#ffe9b8" opacity=".5" />
      <circle cx="54" cy="9" r="1" fill="#ffe9b8" opacity=".5" />
      <circle cx="50" cy="56" r="1" fill="#ffe9b8" opacity=".4" />
      <ellipse cx="19" cy="24" rx="13" ry="6" fill="#cfe3ff" opacity=".55" transform="rotate(-25 19 24)" />
      <ellipse cx="45" cy="24" rx="13" ry="6" fill="#cfe3ff" opacity=".55" transform="rotate(25 45 24)" />
      <path d="M24 46 L16 56 M40 46 L48 56 M26 48 L22 58 M38 48 L42 58" stroke="#20130a" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="32" cy="37" rx="12" ry="14" fill="#ffb02e" />
      <path d="M22 40 H42 M23 45 H41" stroke="#c97c10" strokeWidth="1.4" opacity=".6" />
      <circle cx="27" cy="32" r="4.5" fill="#fff" />
      <circle cx="37" cy="32" r="4.5" fill="#fff" />
      <circle cx="28" cy="33" r="2.3" fill="#20130a" />
      <circle cx="38" cy="33" r="2.3" fill="#20130a" />
      <circle cx="23" cy="38" r="2" fill="#ff8a8a" opacity=".7" />
      <circle cx="41" cy="38" r="2" fill="#ff8a8a" opacity=".7" />
      <path d="M32 39 V46" stroke="#20130a" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  piranha: (
    <>
      <rect width="64" height="64" fill="#0e2d3a" />
      <circle cx="12" cy="14" r="2" fill="none" stroke="#9fe8c9" strokeWidth=".8" opacity=".5" />
      <circle cx="16" cy="8" r="1.3" fill="none" stroke="#9fe8c9" strokeWidth=".8" opacity=".4" />
      <path d="M49 32 L60 21 L60 43 Z" fill="#e0384f" />
      <path d="M30 17 L38 10 L40 19 Z" fill="#e0384f" />
      <ellipse cx="32" cy="33" rx="20" ry="16" fill="#ff8a3d" />
      <path d="M13 36 Q25 47 38 37 L38 41 Q25 51 13 41 Z" fill="#fff" />
      <path d="M15 37 L18 41 L21 38 L24 42 L27 39 L30 42 L33 39 L36 41" stroke="#231003" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <circle cx="24" cy="27" r="5" fill="#fff" />
      <circle cx="23" cy="27" r="2.6" fill="#231003" />
      <path d="M18 20 L29 23" stroke="#231003" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 27 Q44 33 40 39" stroke="#c9601f" strokeWidth="1.4" fill="none" opacity=".7" />
    </>
  ),
  skimmer: (
    <>
      <rect width="64" height="64" fill="#0d2733" />
      <rect x="7" y="10" width="15" height="7" fill="#6fa8a0" />
      <rect x="7" y="10" width="15" height="2" fill="#9fe8c9" />
      <rect x="25" y="10" width="15" height="7" fill="#b8455c" />
      <rect x="25" y="10" width="15" height="2" fill="#e0384f" />
      <rect x="43" y="10" width="15" height="7" fill="#8f7fb0" />
      <rect x="43" y="10" width="15" height="2" fill="#c5b6e8" />
      <path d="M4 56 Q18 53 32 56 T60 56" stroke="#9fe8c9" strokeWidth="1" fill="none" opacity=".35" />
      <rect x="17" y="46" width="30" height="7" fill="#c98a5b" />
      <rect x="17" y="46" width="30" height="2" fill="#f0c9a0" />
      <path d="M19 37 L24 35 M17 32 L22 31" stroke="#9fe8c9" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <circle cx="34" cy="31" r="9" fill="#efe6ff" />
      <circle cx="31" cy="30" r="1.7" fill="#06231b" />
      <circle cx="37" cy="30" r="1.7" fill="#06231b" />
      <path d="M30.5 34 Q34 37 37.5 34" stroke="#06231b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="28" cy="33" r="1.4" fill="#f4a6c0" opacity=".7" />
      <circle cx="40" cy="33" r="1.4" fill="#f4a6c0" opacity=".7" />
    </>
  ),
};

export default function Avatar({ game, className = "" }) {
  const drawing = DRAWINGS[game.id];
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={game.title}>
      {drawing ?? (
        <>
          <rect width="64" height="64" fill={game.accent} />
          <text x="32" y="42" textAnchor="middle" fontSize="28" fontFamily="Silkscreen, monospace" fill={game.ink}>
            {game.title.charAt(0)}
          </text>
        </>
      )}
    </svg>
  );
}
