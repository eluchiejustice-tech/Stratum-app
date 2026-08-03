import { Shield, Clock, Ban } from "lucide-react";

const STATUS_CONFIG = {
  verified: {
    label: "Verified",
    icon: Shield,
    className: "text-[#1F4D3D] bg-[#1F4D3D]/10",
  },
  pending: {
    label: "Pending review",
    icon: Clock,
    className: "text-[#8a6d1a] bg-[#B8922F]/15",
  },
  rejected: {
    label: "Rejected",
    icon: Ban,
    className: "text-[#8a3b3b] bg-[#8a3b3b]/10",
  },
};

export default function VerifiedBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide px-2 py-0.5 rounded ${config.className}`}
    >
      <Icon size={11} strokeWidth={2.5} /> {config.label}
    </span>
  );
}
