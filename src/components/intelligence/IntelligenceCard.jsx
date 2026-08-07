export default function IntelligenceCard({ label, value, explanation, icon: Icon }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-[#3D4148]/10">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="text-2xl font-mono text-[#15130F]">{value}</div>
      {explanation && (
        <p
          className="text-xs text-[#3D4148]/60 mt-1"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {explanation}
        </p>
      )}
    </div>
  );
}
