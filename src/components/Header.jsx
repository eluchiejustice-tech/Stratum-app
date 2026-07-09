import { Layers, Plus, Lock, Unlock } from "lucide-react";

export default function Header({ isAdmin, onToggleAdmin, onAddListing }) {
  return (
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
          <button
            onClick={onToggleAdmin}
            title={isAdmin ? "Exit team mode" : "Team login"}
            className={`flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide px-3 py-2 rounded transition ${
              isAdmin
                ? "bg-[#1F4D3D] text-[#EDE8DC]"
                : "bg-transparent text-[#EDE8DC]/70 border border-[#EDE8DC]/30"
            }`}
          >
            {isAdmin ? <Unlock size={14} /> : <Lock size={14} />}
            {isAdmin ? "Team" : ""}
          </button>
          <button
            onClick={onAddListing}
            className="flex items-center gap-1.5 bg-[#B8922F] text-[#15130F] font-mono text-xs uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
          >
            <Plus size={14} strokeWidth={2.5} /> List
          </button>
        </div>
      </div>
    </header>
  );
}
