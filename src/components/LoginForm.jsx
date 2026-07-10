import { useState } from "react";
import { X } from "lucide-react";
import { signIn } from "../services/auth";

export default function LoginForm({ onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#EDE8DC] w-full max-w-xs rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg text-[#15130F]">Log in</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={18} />
          </button>
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setLoginError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Email"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-2"
          autoFocus
        />

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setLoginError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Password"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
        />

        {loginError && (
          <p className="text-xs text-[#8a3b3b] mt-2 font-mono">{loginError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-3 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-2.5 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Enter"}
        </button>
      </div>
    </div>
  );
}
