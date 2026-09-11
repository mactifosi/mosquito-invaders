import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Piranha from "@/components/piranha/Game";

export default function PiranhaPage() {
  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2.5">
      <Link
        to="/"
        className="self-start flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-[#9a8cb4] hover:text-[#efe6ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6fe3c0]"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Arcade
      </Link>
      <Piranha />
    </div>
  );
}
