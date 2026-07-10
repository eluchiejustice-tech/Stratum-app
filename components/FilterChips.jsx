export default function FilterChips({ minerals, active, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {minerals.map((m) => (
        <button
          key={m}
          onClick={() => onSelect(m)}
          className={`shrink-0 text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border transition ${
            active === m
              ? "bg-[#15130F] text-[#EDE8DC] border-[#15130F]"
              : "bg-transparent text-[#3D4148] border-[#3D4148]/30"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
