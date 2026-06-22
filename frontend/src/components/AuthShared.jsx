import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";

/**
 * Shared 6-digit OTP input. Renders 6 boxes with auto-advance + paste handling.
 * Props:
 *   value: string (digits only, length<=6)
 *   onChange: (newValue: string) => void
 *   onComplete?: (value: string) => void
 *   disabled?: boolean
 *   testIdPrefix?: string
 */
export function OtpInput({ value, onChange, onComplete, disabled, testIdPrefix = "otp" }) {
  const refs = useRef([]);
  const digits = (value || "").padEnd(6, " ").slice(0, 6).split("");

  const setDigit = (i, d) => {
    const clean = (d || "").replace(/\D/g, "").slice(0, 1);
    const arr = digits.map((c) => (c === " " ? "" : c));
    arr[i] = clean;
    const next = arr.join("").replace(/\s/g, "");
    onChange(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6 && onComplete) onComplete(next);
  };

  const onKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      e.preventDefault();
      onChange(text);
      if (text.length === 6 && onComplete) onComplete(text);
      refs.current[Math.min(text.length, 5)]?.focus();
    }
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          data-testid={`${testIdPrefix}-${i}`}
          className="w-11 h-14 sm:w-12 sm:h-16 text-center font-mono-rl font-bold text-2xl bg-zinc-950 border border-white/15 focus:border-[#ff6b00] focus:outline-none caret-[#ff6b00] text-white"
        />
      ))}
    </div>
  );
}

/**
 * Authentication shell with the RLIQ HUD card. Children render inside the card.
 */
export function AuthShell({ eyebrow, title, children }) {
  return (
    <div className="min-h-screen bg-[#050505] grid-bg flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 scanline" />
      <div className="absolute top-6 left-6">
        <Link to="/" className="flex items-center gap-2" data-testid="auth-back-home">
          <div className="w-9 h-9 hud-clip bg-[#ff6b00] flex items-center justify-center">
            <Rocket className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <div className="font-display font-black uppercase">
            RL<span className="text-[#ff6b00]">IQ</span>
          </div>
        </Link>
      </div>

      <div className="relative w-full max-w-md hud-clip hud-border bg-black/90 backdrop-blur-md p-8 hud-in">
        <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
          /// {eyebrow}
        </div>
        <h1 className="font-display font-black uppercase text-3xl mb-6">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/**
 * Cooldown timer hook. Returns [secondsRemaining, start(seconds)].
 */
export function useCooldown(initial = 0) {
  const [remaining, setRemaining] = useState(initial);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);
  return [remaining, setRemaining];
}
