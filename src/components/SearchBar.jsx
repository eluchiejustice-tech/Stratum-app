import { Search } from "lucide-react";

export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3D4148]/50" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by mineral, grade, or location"
        className="w-full bg-white border border-[#3D4148]/20 rounded pl-9 pr-3 py-2.5 text-sm"
        style={{ fontFamily: "system-ui, sans-serif" }}
      />
    </div>
  );
}
