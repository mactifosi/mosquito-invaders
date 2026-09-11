import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Three-letter initials, the way a cabinet asks for them. Pre-filled with
 * whatever you entered last, so a regular can just hit ENTER.
 */
export default function InitialsEntry({ score, defaultInitials = "AAA", onSubmit }) {
  const [value, setValue] = useState(defaultInitials);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus without scrolling the cabinet around on mobile.
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, []);

  const letters = value.padEnd(3, " ").slice(0, 3).split("");

  const submit = (e) => {
    e.preventDefault();
    onSubmit((value.trim() || "AAA").toUpperCase().slice(0, 3));
  };

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-3">
      <p className="text-[11px] text-[#9a8cb4] m-0">
        <b className="text-[#efe6ff] font-semibold">{score}</b> makes the board. Name it.
      </p>

      {/* The input is real but invisible; the boxes are the visible control. */}
      <div className="relative">
        <div className="flex gap-2" aria-hidden="true">
          {letters.map((ch, i) => (
            <span
              key={i}
              className="w-10 h-12 grid place-items-center border-2 border-[#33254a] bg-[#0b0910] font-['Silkscreen',monospace] text-[20px] text-[#ffb02e]"
            >
              {ch.trim() || "_"}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3))}
          maxLength={3}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          aria-label="Your three-letter initials"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <Button
        type="submit"
        className="font-['Silkscreen',monospace] text-[13px] bg-[#ffb02e] text-[#20130a] hover:bg-[#ffc157] shadow-[0_3px_0_#8a5200] rounded-none px-5 py-5"
      >
        ENTER
      </Button>
    </form>
  );
}
