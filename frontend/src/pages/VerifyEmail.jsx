import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AuthShell, OtpInput, useCooldown } from "@/components/AuthShared";
import { AlertCircle, MailCheck } from "lucide-react";
import { toast } from "sonner";

const RESEND_COOLDOWN = 60;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, resendSignupOtp } = useAuth();
  const initialEmail = location.state?.email || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useCooldown(initialEmail ? RESEND_COOLDOWN : 0);

  useEffect(() => {
    if (!initialEmail) {
      // If user landed here without an email in state, push them back to auth.
      // (They can still type their email manually if they refresh.)
    }
  }, [initialEmail]);

  const submit = async (codeValue) => {
    setError(null);
    if (!email) return setError("Enter the email you signed up with");
    if (!/^\d{6}$/.test(codeValue)) return setError("Enter the 6-digit code");
    setLoading(true);
    try {
      const { data, error } = await verifyOtp(email, codeValue, "signup");
      if (error) throw error;
      if (data?.session) {
        toast.success("Email verified. Welcome aboard.");
        navigate("/dashboard", { replace: true });
      } else {
        toast.success("Email verified. Please sign in.");
        navigate("/auth", { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    if (!email) return setError("Enter your email first");
    if (cooldown > 0) return;
    try {
      const { error } = await resendSignupOtp(email);
      if (error) throw error;
      setCooldown(RESEND_COOLDOWN);
      toast.success("New code sent. Check your inbox.");
    } catch (err) {
      setError(err?.message || "Could not resend code");
    }
  };

  return (
    <AuthShell eyebrow="VERIFY EMAIL" title="Enter your 6-digit code">
      <p className="text-sm text-zinc-400 mb-5">
        We sent a verification code to{" "}
        <span className="font-mono-rl text-white">{email || "your email"}</span>.
        Codes expire in 10 minutes.
      </p>

      {!initialEmail && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@boost.gg"
          className="w-full mb-4 px-3 py-2 bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#ff6b00]"
          data-testid="verify-email-input"
        />
      )}

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={submit}
        disabled={loading}
        testIdPrefix="verify-otp"
      />

      {error && (
        <div
          className="mt-4 flex items-start gap-2 border border-[#ff003c]/40 bg-[#ff003c]/10 px-3 py-2 text-sm text-[#ff5577]"
          data-testid="verify-error"
        >
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={() => submit(code)}
        disabled={loading || code.length !== 6}
        className="btn-boost hud-clip w-full py-3 text-sm mt-6 inline-flex items-center justify-center gap-2"
        data-testid="verify-submit-button"
      >
        <MailCheck className="w-4 h-4" />
        {loading ? "Verifying..." : "Verify Email"}
      </button>

      <div className="mt-5 flex items-center justify-between text-xs font-mono-rl tracking-widest">
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className={`${cooldown > 0 ? "text-zinc-600" : "text-[#007aff] hover:text-white"}`}
          data-testid="verify-resend-button"
        >
          {cooldown > 0 ? `RESEND IN ${cooldown}s` : "// RESEND CODE"}
        </button>
        <Link to="/auth" className="text-zinc-500 hover:text-white" data-testid="verify-back-link">
          // BACK TO SIGN IN →
        </Link>
      </div>
    </AuthShell>
  );
}
