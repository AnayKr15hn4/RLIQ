import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/components/AuthShared";
import { AlertCircle, KeyRound } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { sendRecoveryOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await sendRecoveryOtp(email);
      if (error) throw error;
      navigate("/reset-password", { state: { email } });
    } catch (err) {
      setError(err?.message || "Could not send recovery code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="ACCOUNT RECOVERY" title="Forgot password">
      <p className="text-sm text-zinc-400 mb-5">
        Enter your account email and we&apos;ll send a 6-digit recovery code.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@boost.gg"
          className="w-full px-3 py-2 bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#ff6b00]"
          data-testid="forgot-email-input"
        />
        {error && (
          <div
            className="flex items-start gap-2 border border-[#ff003c]/40 bg-[#ff003c]/10 px-3 py-2 text-sm text-[#ff5577]"
            data-testid="forgot-error"
          >
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-boost hud-clip w-full py-3 text-sm inline-flex items-center justify-center gap-2"
          data-testid="forgot-submit-button"
        >
          <KeyRound className="w-4 h-4" />
          {loading ? "Sending..." : "Send Recovery Code"}
        </button>
      </form>
      <div className="mt-5 text-center">
        <Link
          to="/auth"
          className="font-mono-rl text-xs text-zinc-500 hover:text-white tracking-widest"
          data-testid="forgot-back-link"
        >
          // BACK TO SIGN IN →
        </Link>
      </div>
    </AuthShell>
  );
}
