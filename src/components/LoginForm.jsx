import { X } from "lucide-react";

// NOTE: This still uses the passcode system from the current live app.
// It will be replaced with real Supabase auth in Stage 3 of the migration,
// without changing this component's visual appearance.
export default function LoginForm({
  passcodeInput,
  setPasscodeInput,
  loginError,
  setLoginError,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#EDE8DC] w-full max-w-xs rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg text-[#15130F]">Team login</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={18} />
          </button>
        </div>
        <input
          type="password"
          value={passcodeInput}
          onChange={(e) => {
            setPasscodeInput(e.target.value);
            setLoginError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Team passcode"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
          autoFocus
        />
        {loginError && (
          <p className="text-xs text-[#8a3b3b] mt-2 font-mono">Incorrect passcode.</p>
        )}
        <button
          onClick={onSubmit}
          className="w-full mt-3 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-2.5 rounded hover:bg-[#3D4148] transition"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
