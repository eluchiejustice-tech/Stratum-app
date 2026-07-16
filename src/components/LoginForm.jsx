import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { signIn, signUp } from "../services/auth";
import RoleSelect from "./RoleSelect";

export default function LoginForm({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupRole, setSignupRole] = useState("buyer");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  const handleLogin = async () => {
    setLoginError("");
    if (!email || !password) {
      setLoginError("Enter your email and password.");
      return;
    }

    setLoading(true);
    const { data, error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      setLoginError("Incorrect email or password.");
      return;
    }

    onSuccess?.(data);
  };

  const handleSignup = async () => {
    setSignupError("");

    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (signupPassword.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      return;
    }

    setSignupLoading(true);
    const { data, error } = await signUp(signupEmail, signupPassword, signupName, signupRole);
    setSignupLoading(false);

    if (error) {
      setSignupError(error.message);
      return;
    }

    setSignupSuccess(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#EDE8DC] w-full max-w-xs rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg text-[#15130F]">
            {mode === "login" ? "Log in" : "Create your account"}
          </h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={18} />
          </button>
        </div>

        {mode === "login" && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Email"
              className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-2"
              autoFocus
            />

            <div className="relative">
              <input
                type={showLoginPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Password"
                className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3D4148]/60 hover:text-[#15130F]"
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
              >
                {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {loginError && (
              <p className="text-xs text-[#8a3b3b] mt-2 font-mono">{loginError}</p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full mt-3 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-2.5 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Enter"}
            </button>

            <p className="text-xs text-[#3D4148] mt-3 text-center">
              Don't have an account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="underline hover:text-[#15130F]"
              >
                Sign up
              </button>
            </p>
          </>
        )}

        {mode === "signup" && !signupSuccess && (
          <>
            <input
              type="text"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-2"
              autoFocus
            />

            <input
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-2"
            />

            <div className="relative mb-2">
              <input
                type={showSignupPassword ? "text" : "password"}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3D4148]/60 hover:text-[#15130F]"
                aria-label={showSignupPassword ? "Hide password" : "Show password"}
              >
                {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative mb-2">
              <input
                type={showSignupConfirm ? "text" : "password"}
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSignupConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3D4148]/60 hover:text-[#15130F]"
                aria-label={showSignupConfirm ? "Hide password" : "Show password"}
              >
                {showSignupConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="mb-2">
              <RoleSelect value={signupRole} onChange={setSignupRole} />
            </div>

            {signupError && (
              <p className="text-xs text-[#8a3b3b] mt-1 font-mono">{signupError}</p>
            )}

            <button
              onClick={handleSignup}
              disabled={signupLoading}
              className="w-full mt-3 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-2.5 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
            >
              {signupLoading ? "Creating account..." : "Sign up"}
            </button>

            <p className="text-xs text-[#3D4148] mt-3 text-center">
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="underline hover:text-[#15130F]"
              >
                Log in
              </button>
            </p>
          </>
        )}

        {mode === "signup" && signupSuccess && (
          <div className="text-center">
            <p className="text-sm text-[#15130F] mb-3">
              Check your email to confirm your account, then log in.
            </p>
            <button
              onClick={() => {
                setSignupSuccess(false);
                setMode("login");
              }}
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
