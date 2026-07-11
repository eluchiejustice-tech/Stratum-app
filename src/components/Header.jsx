import { useState } from "react";
import { Layers, Plus, Lock, Unlock, LogOut } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { signOut } from "../services/auth";
import LoginForm from "./LoginForm";

export default function Header({ onAddListing }) {
  const { user, profile, role, loading } = useAuthContext();
  const [showLogin, setShowLogin] = useState(false);

  const isModerator = role === "moderator";

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      <header className="bg-[#15130F] text-[#EDE8DC] px-5 py-5 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={22} className="text-[#B8922F]" strokeWidth={1.5} />
            <div>
              <div className="font-serif text-lg leading-none tracking-tight">Stratum</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#EDE8DC]/50">
                Ore Ledger · Solid mineral exchange
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isModerator && (
              <div
                title="Moderator"
                className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide px-3 py-2 rounded bg-[#1F4D3D] text-[#EDE8DC]"
              >
                <Unlock size={14} />
                Moderator
              </div>
            )}

            {!loading && user && (
              <button
                onClick={handleLogout}
                title="Log out"
                className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide px-3 py-2 rounded bg-transparent text-[#EDE8DC]/70 border border-[#EDE8DC]/30 hover:brightness-110 transition"
              >
                <LogOut size={14} />
                {profile?.name || "Log out"}
              </button>
            )}

            {!loading && !user && (
              <button
                onClick={() => setShowLogin(true)}
                title="Log in"
                className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide px-3 py-2 rounded bg-transparent text-[#EDE8DC]/70 border border-[#EDE8DC]/30 hover:brightness-110 transition"
              >
                <Lock size={14} />
                Log in
              </button>
            )}

            <button
              onClick={onAddListing}
              className="flex items-center gap-1.5 bg-[#B8922F] text-[#15130F] font-mono text-xs uppercase px-3 py-2 rounded hover:brightness-110 transition"
            >
              <Plus size={14} strokeWidth={2.5} /> List
            </button>
          </div>
        </div>
      </header>

      {showLogin && (
        <LoginForm
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
