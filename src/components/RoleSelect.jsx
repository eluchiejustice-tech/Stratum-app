// Only self-service roles appear here. "moderator" is intentionally never
// an option — it can only be granted manually via the Supabase dashboard,
// and the database trigger independently blocks it even if bypassed here.
const SELF_SERVICE_ROLES = [
  { value: "buyer", label: "Buyer" },
  { value: "miner_supplier", label: "Miner / Supplier" },
  { value: "professional", label: "Geologist / Professional" },
  { value: "company", label: "Mining Company" },
];

export default function RoleSelect({ value, onChange }) {
  return (
    <div>
      <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
        I am a...
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
      >
        {SELF_SERVICE_ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
