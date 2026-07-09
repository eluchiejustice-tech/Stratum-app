import { Shield } from "lucide-react";

export default function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide text-[#1F4D3D] bg-[#1F4D3D]/10 px-2 py-0.5 rounded">
      <Shield size={11} strokeWidth={2.5} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide text-[#8a6d1a] bg-[#B8922F]/15 px-2 py-0.5 rounded">
      Pending review
    </span>
  );
}
