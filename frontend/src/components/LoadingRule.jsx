/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";

const RULES = [
  { n: 1, text: "Always go for kickoff." },
  { n: 2, text: "Never break a front-to-front lock." },
  { n: 5, text: "When in doubt, fast aerial." },
  { n: 12, text: "Don't ball-chase. Rotate." },
  { n: 17, text: "Boost > Ball." },
  { n: 22, text: "If your teammate has it, you don't." },
  { n: 34, text: "Trust the rotation." },
  { n: 43, text: "Shadow defense saves lives." },
  { n: 51, text: "The wall is a wave, ride it." },
  { n: 64, text: "Demo with intent. Always." },
  { n: 77, text: "Power slide is your best friend." },
  { n: 88, text: "Half-flip out, full-send back." },
];

export default function LoadingRule({ label = "Loading" }) {
  const rule = useMemo(() => RULES[Math.floor(Math.random() * RULES.length)], []);
  const [dots, setDots] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/purity
    const t = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      350
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div
      data-testid="loading-rule-screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] grid-bg overflow-hidden"
    >
      <div className="absolute inset-0 scanline" />
      <div className="relative text-center px-6 max-w-2xl">
        <div className="font-mono-rl text-xs tracking-[0.35em] text-[#ff6b00] mb-4">
          RLIQ // RULE BOOK
        </div>
        <div
          className="font-display font-black uppercase text-white text-5xl sm:text-6xl lg:text-7xl text-glow-orange leading-none"
          data-testid="loading-rule-number"
        >
          Rule #{rule.n}
        </div>
        <div className="mt-6 font-display font-medium uppercase tracking-wide text-xl sm:text-2xl text-zinc-200">
          “{rule.text}”
        </div>
        <div className="mt-12 mx-auto w-72 h-[3px] bg-zinc-900 relative overflow-hidden">
          <div className="absolute inset-0 boost-bar bg-[#ff6b00] glow-orange" />
        </div>
        <div className="mt-4 font-mono-rl text-xs text-zinc-500">
          {label.toUpperCase()}{dots}
        </div>
      </div>
    </div>
  );
}
