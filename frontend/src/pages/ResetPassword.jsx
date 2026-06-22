import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { publicApi } from "@/lib/api";
import { AuthShell, OtpInput, useCooldown } from "@/components/AuthShared";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const RESEND_COOLDOWN = 60;

function extractError(err, fallback) {
  return (
    err?.response?.data?.detail ||
    (err && typeof err === "object" && typeof err.message === "string" && err.message) ||
    fallback
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useCooldown(email ? RESEND_COOLDOWN : 0);

  const submit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError(null);
    if (!email) return setError("Enter your email");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      await publicApi.post("/auth/reset-password", {
        email,
        code,
        new_password: password,
      });
      toast.success("Password updated.");
      const { error: signInErr } = await signIn(email, password);
      if (signInErr) {
        navigate("/auth", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(extractError(err, "Could not reset password"));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    if (!email) return setError("Enter your email first");
    if (cooldown > 0) return;
    try {
      await publicApi.post("/auth/forgot-password", { email });
      setCooldown(RESEND_COOLDOWN);
      toast.success("New recovery code sent.");
    } catch (err) {
      setError(extractError(err, "Could not resend"));
    }
  };

  return (
    <AuthShell eyebrow="ACCOUNT RECOVERY" title="Reset your password">
      <p className="text-sm text-zinc-400 mb-5">
        Enter the 6-digit code we sent to{" "}
        <span className="font-mono-rl text-white">{email || "your email"}</span>{" "}
        and choose a new password.
      </p>

      <form onSubmit={submit} className="space-y-4">
        {!location.state?.email && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@boost.gg"
            className="w-full px-3 py-2 bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#ff6b00]"
            data-testid="reset-email-input"
          />
        )}

        <OtpInput
          value={code}
          onChange={setCode}
          disabled={loading}
          testIdPrefix="reset-otp"
        />

        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 6 chars)"
          className="w-full px-3 py-2 bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#ff6b00]"
          data-testid="reset-new-password-input"
        />
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full px-3 py-2 bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#ff6b00]"
          data-testid="reset-confirm-password-input"
        />

        {error && (
          <div
            className="flex items-start gap-2 border border-[#ff003c]/40 bg-[#ff003c]/10 px-3 py-2 text-sm text-[#ff5577]"
            data-testid="reset-error"
          >
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{String(error)}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="btn-boost hud-clip w-full py-3 text-sm inline-flex items-center justify-center gap-2"
          data-testid="reset-finalize-button"
        >
          <ShieldCheck className="w-4 h-4" />
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs font-mono-rl tracking-widest">
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className={cooldown > 0 ? "text-zinc-600" : "text-[#007aff] hover:text-white"}
          data-testid="reset-resend-button"
        >
          {cooldown > 0 ? `RESEND IN ${cooldown}s` : "// RESEND CODE"}
        </button>
        <Link to="/auth" className="text-zinc-500 hover:text-white" data-testid="reset-back-link">
          // BACK TO SIGN IN →
        </Link>
      </div>
    </AuthShell>
  );
}
