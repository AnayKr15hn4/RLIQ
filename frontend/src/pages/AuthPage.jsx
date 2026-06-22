import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Welcome back. Boost up.");
        navigate("/dashboard");
      } else {
        const { data, error } = await signUp(email, password, displayName || email.split("@")[0]);
        if (error) throw error;
        if (data.session) {
          toast.success("Account ready. Let's roll.");
          navigate("/dashboard");
        } else {
          toast.success("Check your email to confirm — or sign in if confirm is off.");
          setMode("signin");
        }
      }
    } catch (err) {
      const msg =
        (err && typeof err === "object" && typeof err.message === "string" && err.message) ||
        (err && err.error_description) ||
        (typeof err === "string" ? err : null) ||
        "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
          /// {mode === "signin" ? "AUTHENTICATE" : "INITIALIZE"}
        </div>
        <h1 className="font-display font-black uppercase text-3xl mb-6">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
                DISPLAY NAME
              </Label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jzr"
                className="bg-zinc-950 border-white/10 focus-visible:ring-[#007aff] rounded-none mt-1"
                data-testid="auth-displayname-input"
              />
            </div>
          )}
          <div>
            <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
              EMAIL
            </Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@boost.gg"
              className="bg-zinc-950 border-white/10 focus-visible:ring-[#007aff] rounded-none mt-1"
              data-testid="auth-email-input"
            />
          </div>
          <div>
            <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
              PASSWORD
            </Label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-zinc-950 border-white/10 focus-visible:ring-[#007aff] rounded-none mt-1"
              data-testid="auth-password-input"
            />
          </div>

          {error && (
            <div
              className="flex items-start gap-2 border border-[#ff003c]/40 bg-[#ff003c]/10 px-3 py-2 text-sm text-[#ff5577]"
              data-testid="auth-error-message"
            >
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-boost hud-clip w-full py-3 text-sm"
            data-testid="auth-submit-button"
          >
            {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-6 w-full text-center font-mono-rl text-xs text-zinc-500 hover:text-[#007aff] tracking-widest"
          data-testid="auth-toggle-mode"
        >
          {mode === "signin"
            ? "// NEW HERE? CREATE ACCOUNT →"
            : "// HAVE ACCOUNT? SIGN IN →"}
        </button>
      </div>
    </div>
  );
}
