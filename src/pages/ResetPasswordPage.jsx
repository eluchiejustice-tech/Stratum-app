import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { updatePassword } from "../services/auth";

// How long to wait for Supabase's PASSWORD_RECOVERY event before falling
// back to a plain getSession() check. This exists only to catch an edge
// case (e.g. the event having already fired before this component mounted,
// on a slow reload) — the event itself is the primary signal.
const FALLBACK_CHECK_DELAY_MS = 1500;

export default function ResetPasswordPage({ onComplete }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [validSession, setValidSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let resolved = false;
    let fallbackTimer = null;

    const resolveValid = () => {
      if (resolved) return;
      resolved = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setValidSession(true);
      setCheckingSession(false);
    };

    const resolveInvalid = () => {
      if (resolved) return;
      resolved = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setValidSession(false);
      setCheckingSession(false);
    };

    // Primary signal: Supabase fires PASSWORD_RECOVERY once it has parsed
    // the recovery token from the URL and established a temporary session.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        resolveValid();
      }
    });

    // Fallback: if the event hasn't fired after a short delay (e.g. it
    // fired before this component mounted), check getSession() directly
    // as a secondary signal rather than leaving the user stuck loading.
    fallbackTimer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        resolveValid();
      } else {
        resolveInvalid();
      }
    }, FALLBACK_CHECK_DELAY_MS);

    return () => {
      resolved = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);

    if (updateError) {
      console.error("Password update error", updateError);
      setError("We couldn't update your password right now. Please try again.");
      return;
    }

    setSuccess(true);
  };

  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F] flex items-center justify-center p-4"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="bg-white w-full max-w-xs rounded-lg p-6 shadow-sm border border-[#3D4148]/10">
        <h2 className="font-serif text-lg mb-4">Reset your password</h2>

        {checkingSession && (
          <p className="text-sm text-[#3D4148]/60">Verifying your reset link…</p>
        )}

        {!checkingSession && !validSession && !success && (
          <>
            <p className="text-sm text-[#3D4148] mb-3">
              This password reset link is invalid or has expired. Please
              request a new one from the login screen.
            </p>
            <button
              onClick={() => onComplete?.()}
              className="text-xs underline text-[#3D4148] hover:text-[#15130F]"
            >
              Back to login
            </button>
          </>
        )}

        {!checkingSession && validSession && !success && (
          <>
            <p className="text-sm text-[#3D4148] mb-3">
              Enter a new password for your account.
            </p>

            <div className="relative mb-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 pr-9 text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3D4148]/60 hover:text-[#15130F]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative mb-2">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Confirm new password"
                className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3D4148]/60 hover:text-[#15130F]"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-[#8a3b3b] mt-1 font-mono">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-3 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-2.5 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </>
        )}

        {success && (
          <div className="text-center">
            <p className="text-sm text-[#15130F] mb-3">
              Your password has been updated. You can now log in with your
              new password.
            </p>
            <button
              onClick={() => onComplete?.()}
              className="text-xs underline text-[#3D4148] hover:text-[#15130F]"
            >
              Go to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
