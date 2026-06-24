/* eslint-disable */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { v: "steam", l: "Steam" },
  { v: "epic", l: "Epic Games" },
  { v: "psn", l: "PlayStation (PSN)" },
  { v: "xbox", l: "Xbox" },
];

const RANKS = [
  { v: "GC1", l: "Grand Champion 1" },
  { v: "GC2", l: "Grand Champion 2" },
  { v: "GC3", l: "Grand Champion 3" },
  { v: "SSL", l: "Supersonic Legend" },
];

export default function CreatorVerify() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [code, setCode] = useState(null);
  const [generating, setGenerating] = useState(false);

  // form
  const [trackerUrl, setTrackerUrl] = useState("");
  const [platform, setPlatform] = useState("steam");
  const [username, setUsername] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [peakRank, setPeakRank] = useState("GC1");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const cli = await api();
      const { data } = await cli.get("/creator/me");
      setProfile(data);
      if (data.verification_code) setCode(data.verification_code);
      if (data.rl_tracker_url) setTrackerUrl(data.rl_tracker_url);
      if (data.platform) setPlatform(data.platform);
      if (data.rl_username) setUsername(data.rl_username);
      if (data.screenshot_url) setScreenshotUrl(data.screenshot_url);
      if (data.peak_rank && RANKS.find((r) => r.v === data.peak_rank)) {
        setPeakRank(data.peak_rank);
      }
    } catch (e) {
      toast.error("Could not load your profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const cli = await api();
      const { data } = await cli.post("/creator/start-verification");
      setCode(data.verification_code);
      toast.success("Code generated. Put it in your screenshot / Steam summary now.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not generate code");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success("Code copied");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!code) return toast.error("Generate your verification code first");
    if (!trackerUrl || !username || !screenshotUrl) {
      return toast.error("Fill all fields");
    }
    setSubmitting(true);
    try {
      const cli = await api();
      await cli.post("/creator/submit-verification", {
        rl_tracker_url: trackerUrl,
        platform,
        rl_username: username,
        screenshot_url: screenshotUrl,
        claimed_peak_rank: peakRank,
      });
      toast.success("Submitted. We'll review within 48h.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingRule label="Loading Profile" />;

  const status = profile?.verification_status || "none";
  const isVerified = !!profile?.verified;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
          /// CREATOR VERIFICATION
        </div>
        <h1 className="font-display font-black uppercase text-4xl sm:text-5xl mb-6">
          {isVerified ? "You're verified" : "Become a verified creator"}
        </h1>

        {/* STATUS BANNER */}
        {isVerified && (
          <div className="hud-clip border border-[#00ff66]/40 bg-[#00ff66]/10 p-5 mb-6 flex items-start gap-3" data-testid="verify-status-approved">
            <CheckCircle2 className="w-6 h-6 text-[#00ff66] mt-0.5" />
            <div>
              <div className="font-display font-bold uppercase text-[#00ff66]">
                Approved · Peak rank {profile?.peak_rank}
              </div>
              <div className="text-sm text-zinc-300 mt-1">
                Your quizzes can now be set to <b>Public</b> and appear in the Browse tab.
              </div>
            </div>
          </div>
        )}
        {!isVerified && status === "pending" && (
          <div className="hud-clip border border-[#ffd500]/40 bg-[#ffd500]/10 p-5 mb-6 flex items-start gap-3" data-testid="verify-status-pending">
            <Clock className="w-6 h-6 text-[#ffd500] mt-0.5" />
            <div>
              <div className="font-display font-bold uppercase text-[#ffd500]">
                Under review
              </div>
              <div className="text-sm text-zinc-300 mt-1">
                We received your submission. Reviews typically take under 48 hours.
              </div>
            </div>
          </div>
        )}
        {!isVerified && status === "rejected" && (
          <div className="hud-clip border border-[#ff003c]/40 bg-[#ff003c]/10 p-5 mb-6 flex items-start gap-3" data-testid="verify-status-rejected">
            <XCircle className="w-6 h-6 text-[#ff003c] mt-0.5" />
            <div>
              <div className="font-display font-bold uppercase text-[#ff5577]">Rejected</div>
              <div className="text-sm text-zinc-300 mt-1">
                {profile?.rejection_reason || "Re-submit with clearer evidence."}
              </div>
            </div>
          </div>
        )}

        {!isVerified && (
          <>
            {/* INTRO */}
            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-6 mb-6">
              <div className="font-mono-rl text-[10px] tracking-widest text-[#ff6b00] mb-2">
                // WHO CAN VERIFY
              </div>
              <div className="font-display font-bold uppercase text-xl mb-2">
                Peak rank GC1 or higher
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Anyone can build a quiz and share it via link. But to have your quizzes featured
                in the Browse tab, your Rocket League account must have peaked at Grand
                Champion 1 or above in any competitive playlist. We verify with a one-time
                screenshot review.
              </p>
            </div>

            {/* STEP 1: code */}
            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-6 mb-6">
              <div className="font-mono-rl text-[10px] tracking-widest text-[#007aff] mb-2">
                // STEP 1
              </div>
              <div className="font-display font-bold uppercase text-xl mb-3">
                Generate your one-time code
              </div>
              {code ? (
                <div className="flex items-center gap-3" data-testid="verify-code-display">
                  <div className="font-mono-rl font-bold text-2xl text-[#ff6b00] tracking-widest px-4 py-2 border border-[#ff6b00]/50 bg-black">
                    {code}
                  </div>
                  <button
                    onClick={copyCode}
                    className="btn-ghost-volt hud-clip px-3 py-2 inline-flex items-center gap-1 text-xs"
                    data-testid="verify-code-copy"
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                  <button
                    onClick={generateCode}
                    disabled={generating}
                    className="font-mono-rl text-xs text-zinc-500 hover:text-white tracking-widest ml-2"
                    data-testid="verify-code-regen"
                  >
                    // REGENERATE
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="btn-boost hud-clip px-5 py-2 text-xs inline-flex items-center gap-2"
                  data-testid="verify-code-generate"
                >
                  {generating ? "Generating..." : "Generate Code"}
                </button>
              )}
            </div>

            {/* STEP 2: proof */}
            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-6 mb-6">
              <div className="font-mono-rl text-[10px] tracking-widest text-[#007aff] mb-2">
                // STEP 2
              </div>
              <div className="font-display font-bold uppercase text-xl mb-3">
                Capture proof of ownership
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Pick the path that matches your platform. Upload your screenshot anywhere
                publicly accessible (Imgur is easiest — <a href="https://imgur.com/upload" target="_blank" rel="noreferrer" className="text-[#007aff] hover:underline">imgur.com/upload</a>) and paste the direct image URL in Step 3.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="border border-white/10 p-4">
                  <div className="font-mono-rl text-[10px] tracking-widest text-[#ff6b00] mb-1">STEAM</div>
                  <div className="font-display font-bold uppercase text-sm mb-2">Profile summary</div>
                  <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                    <li>Open your Steam profile · "Edit Profile"</li>
                    <li>Paste your code into the <b>Summary</b> field</li>
                    <li>Save</li>
                    <li>Screenshot the saved profile page (URL bar visible)</li>
                  </ol>
                </div>
                <div className="border border-white/10 p-4">
                  <div className="font-mono-rl text-[10px] tracking-widest text-[#ff6b00] mb-1">EPIC / PS / XBOX</div>
                  <div className="font-display font-bold uppercase text-sm mb-2">In-game chat</div>
                  <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                    <li>Open Rocket League · Freeplay or Training</li>
                    <li>Open team chat (T) · type your code</li>
                    <li>Press F2 to open Player List · your username must be visible</li>
                    <li>Screenshot the chat + username together</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* STEP 3: form */}
            <form onSubmit={submit} className="hud-clip border border-white/10 bg-[#0a0a0a] p-6 space-y-4">
              <div className="font-mono-rl text-[10px] tracking-widest text-[#007aff] mb-2">
                // STEP 3 — SUBMIT
              </div>

              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">PLATFORM</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-zinc-950 border-white/10 rounded-none mt-1" data-testid="verify-platform-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                    {PLATFORMS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">IN-GAME USERNAME</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Jzr"
                  required
                  className="bg-zinc-950 border-white/10 rounded-none mt-1"
                  data-testid="verify-username-input"
                />
              </div>

              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">RL TRACKER PROFILE URL</Label>
                <Input
                  type="url"
                  value={trackerUrl}
                  onChange={(e) => setTrackerUrl(e.target.value)}
                  placeholder="https://rocketleague.tracker.network/rocket-league/profile/..."
                  required
                  className="bg-zinc-950 border-white/10 rounded-none mt-1"
                  data-testid="verify-tracker-input"
                />
                <div className="font-mono-rl text-[10px] text-zinc-500 mt-1">
                  // <a href="https://rocketleague.tracker.network/" target="_blank" rel="noreferrer" className="text-[#007aff] hover:underline">find yours at rocketleague.tracker.network</a>
                </div>
              </div>

              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">SCREENSHOT URL</Label>
                <Input
                  type="url"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  placeholder="https://i.imgur.com/abc123.png"
                  required
                  className="bg-zinc-950 border-white/10 rounded-none mt-1"
                  data-testid="verify-screenshot-input"
                />
                <div className="font-mono-rl text-[10px] text-zinc-500 mt-1">
                  // PUBLIC IMAGE LINK — RIGHT-CLICK YOUR UPLOADED IMAGE → COPY IMAGE ADDRESS
                </div>
              </div>

              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">CLAIMED PEAK RANK</Label>
                <Select value={peakRank} onValueChange={setPeakRank}>
                  <SelectTrigger className="bg-zinc-950 border-white/10 rounded-none mt-1" data-testid="verify-peak-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                    {RANKS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <button
                type="submit"
                disabled={submitting || !code}
                className="btn-boost hud-clip w-full py-3 text-sm inline-flex items-center justify-center gap-2"
                data-testid="verify-submit-button"
              >
                <ShieldCheck className="w-4 h-4" />
                {submitting ? "Submitting..." : status === "pending" ? "Update Submission" : "Submit for Review"}
              </button>
            </form>
          </>
        )}

        <Link to="/dashboard" className="inline-block mt-6 font-mono-rl text-xs text-zinc-500 hover:text-white tracking-widest" data-testid="verify-back-dashboard">
          // BACK TO DASHBOARD
        </Link>
      </div>
    </div>
  );
}
