import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AuthShell, OtpInput, useCooldown } from "@/components/AuthShared";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const RESEND_COOLDOWN = 60;

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyRecoveryOtp, sendRecoveryOtp, updatePassword } = useAuth();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useCooldown(email ? RESEND_COOLDOWN : 0);

  const verifyCode = async (codeValue) => {
    setError(null);
    if (!email) return setError("Enter your email first");
    if (!/^\d{6}$/.test(codeValue)) return setError("Enter the 6-digit code");
    setLoading(true);
    try {
      const { error } = await verifyRecoveryOtp(email, codeValue);
      if (error) throw error;
      setVerified(true);
    } catch (err) {
      setError(err?.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const finalize = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    if (!email) return setError("Enter your email first");
    if (cooldown > 0) return;
    try {
      const { error } = await sendRecoveryOtp(email);
      if (error) throw error;
      setCooldown(RESEND_COOLDOWN);
      toast.success("New recovery code sent.");
    } catch (err) {
      setError(err?.message || "Could not resend");
    }
  };

  if (verified) {
    return (
      <AuthShell eyebrow="NEW PASSWORD" title="Set a new password">
        <form onSubmit={finalize} className="space-y-4">
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
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-boost hud-clip w-full py-3 text-sm inline-flex items-center justify-center gap-2"
            data-testid="reset-finalize-button"
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="ACCOUNT RECOVERY" title="Enter recovery code">
      <p className="text-sm text-zinc-400 mb-5">
        Enter the 6-digit code we sent to{" "}
        <span className="font-mono-rl text-white">{email || "your email"}</span>.
      </p>

      {!location.state?.email && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@boost.gg"
          className="w-full mb-4 px-3 py-2 bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#ff6b00]"
          data-testid="reset-email-input"
        />
      )}

      <OtpInput value={code} onChange={setCode} onComplete={verifyCode} disabled={loading} testIdPrefix="reset-otp" />

      {error && (
        <div
          className="mt-4 flex items-start gap-2 border border-[#ff003c]/40 bg-[#ff003c]/10 px-3 py-2 text-sm text-[#ff5577]"
          data-testid="reset-error"
        >
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={() => verifyCode(code)}
        disabled={loading || code.length !== 6}
        className="btn-boost hud-clip w-full py-3 text-sm mt-6 inline-flex items-center justify-center gap-2"
        data-testid="reset-verify-button"
      >
        <ShieldCheck className="w-4 h-4" />
        {loading ? "Verifying..." : "Verify Code"}
      </button>

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
