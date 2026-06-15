import React from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { ArrowRight, Target, Brain, Zap, Trophy, Video } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1555532686-d0fccaccadcf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwxfHxuZW9uJTIwc3BvcnRzJTIwY2FyfGVufDB8fHx8MTc4MTA1OTkyNHww&ixlib=rb-4.1.0&q=85)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/40" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-36 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 mb-6 tag" data-testid="hero-eyebrow">
              <span className="w-1.5 h-1.5 bg-[#ff6b00] glow-orange" />
              Train Your Game Sense
            </div>
            <h1
              className="font-display font-black uppercase tracking-tight text-5xl sm:text-6xl lg:text-7xl leading-[0.95]"
              data-testid="hero-title"
            >
              Don&apos;t just <span className="text-[#ff6b00] text-glow-orange">watch</span> replays.
              <br />
              <span className="text-zinc-400">Live them.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-300 font-light">
              Interactive Rocket League replay quizzes that pause at the critical
              moment and force you to make the call — before the pros do. Train
              rotations, positioning, boost mgmt & challenge timing through real
              decisions, not just YouTube binges.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/auth?mode=signup" data-testid="hero-cta-primary">
                <button className="btn-boost hud-clip px-7 py-4 text-sm inline-flex items-center gap-2">
                  Start Training Free <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/auth" data-testid="hero-cta-secondary">
                <button className="btn-ghost-volt hud-clip px-7 py-4 text-sm">
                  I Have An Account
                </button>
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              <Stat k="∞" l="Decisions" />
              <Stat k="5" l="Question Types" />
              <Stat k="0" l="Wasted Reps" />
            </div>
          </div>

          {/* HUD card */}
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="hud-clip hud-border bg-black/80 backdrop-blur-md p-6 sm:p-8 hud-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-mono-rl text-xs tracking-[0.3em] text-[#007aff]">
                    /// LIVE HUD
                  </div>
                  <div className="font-mono-rl text-xs text-zinc-500">00:23.41</div>
                </div>
                <div className="font-display font-bold uppercase text-2xl mb-5 leading-snug">
                  Your teammate is challenging.
                  <br />
                  Their LB just respawned. <span className="text-[#ff6b00]">What now?</span>
                </div>
                <div className="space-y-2">
                  {[
                    { l: "A", t: "Boost steal + cover the back post", ok: true },
                    { l: "B", t: "Second man challenge with them", ok: false },
                    { l: "C", t: "Cheat up for the rebound" },
                  ].map((o, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 border ${
                        o.ok
                          ? "border-[#00ff66]/60 bg-[#00ff66]/5"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      <span className="font-mono-rl text-xs w-5">{o.l}</span>
                      <span className="text-sm">{o.t}</span>
                      {o.ok && (
                        <span className="ml-auto font-mono-rl text-[10px] text-[#00ff66] tracking-widest">
                          OPTIMAL
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6 font-mono-rl text-[10px] text-zinc-500 tracking-widest">
                  TIP // Boost denial wins more games than goals.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative max-w-7xl mx-auto px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <div className="tag mb-4">// THE LOOP</div>
          <h2 className="font-display font-black uppercase text-4xl sm:text-5xl leading-tight">
            Reps that <span className="text-[#ff6b00]">actually</span> stick.
          </h2>
          <p className="text-zinc-400 mt-3">
            Every quiz is a sequence of high-leverage decision moments. We pause
            the play. You commit. Then we show you what worked.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card
            icon={<Video className="w-6 h-6" />}
            t="Replay-First"
            d="Creators drop a YouTube replay and pin questions at the exact frame a decision matters."
            n="01"
          />
          <Card
            icon={<Brain className="w-6 h-6" />}
            t="Forced Decision"
            d="The video locks at each pin. You can't peek at the outcome until you commit your answer."
            n="02"
          />
          <Card
            icon={<Trophy className="w-6 h-6" />}
            t="Score & Learn"
            d="Detailed breakdown — single-select, multi-select, ranking, confidence rating, free-text reasoning."
            n="03"
          />
        </div>
      </section>

      {/* QUESTION TYPES */}
      <section className="border-y border-white/5 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <h2 className="font-display font-black uppercase text-3xl sm:text-4xl">
              5 question types. <span className="text-[#007aff]">Built for game sense.</span>
            </h2>
            <span className="font-mono-rl text-xs text-zinc-500">
              // BECAUSE “WHAT WAS THE GOAL?” ISN&apos;T A SKILL CHECK
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ["Single-Select", "Pick the optimal play."],
              ["Multi-Select", "Tag every right read."],
              ["Rank Options", "Best to worst, in order."],
              ["Confidence", "How sure are you, really?"],
              ["Short Answer", "Explain your reasoning."],
            ].map(([t, d], i) => (
              <div
                key={t}
                className="hud-clip bg-black border border-white/10 p-5 hover:border-[#ff6b00]/60 transition-all"
              >
                <div className="font-mono-rl text-[10px] text-[#ff6b00] tracking-widest mb-2">
                  TYPE 0{i + 1}
                </div>
                <div className="font-display font-bold uppercase">{t}</div>
                <div className="text-xs text-zinc-400 mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="relative hud-clip hud-border bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a0a00] p-10 sm:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <Zap className="relative w-10 h-10 text-[#ff6b00] mx-auto mb-4" />
          <h3 className="relative font-display font-black uppercase text-3xl sm:text-5xl">
            Go from C1 ball-chaser to GC IQ.
          </h3>
          <p className="relative text-zinc-400 mt-3 max-w-xl mx-auto">
            Free during beta. Build quizzes. Play quizzes. Stop guessing.
          </p>
          <div className="relative mt-8">
            <Link to="/auth?mode=signup" data-testid="footer-cta">
              <button className="btn-boost hud-clip px-8 py-4 text-sm inline-flex items-center gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600 font-mono-rl tracking-widest">
        ROCKETSENSE // RULE #99: BUILT BY PLAYERS, FOR PLAYERS.
      </footer>
    </div>
  );
}

function Stat({ k, l }) {
  return (
    <div>
      <div className="font-display font-black text-3xl text-[#ff6b00] text-glow-orange">
        {k}
      </div>
      <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500">
        {l}
      </div>
    </div>
  );
}

function Card({ icon, t, d, n }) {
  return (
    <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-7 hover:border-[#ff6b00]/60 hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 hud-clip bg-[#ff6b00]/10 border border-[#ff6b00]/40 flex items-center justify-center text-[#ff6b00]">
          {icon}
        </div>
        <span className="font-mono-rl text-xs text-zinc-600">{n}</span>
      </div>
      <div className="font-display font-bold uppercase text-xl">{t}</div>
      <div className="text-sm text-zinc-400 mt-2">{d}</div>
    </div>
  );
}
