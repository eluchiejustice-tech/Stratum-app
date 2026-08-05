import { ShieldCheck, Ban } from "lucide-react";

function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Renders the complete, unfiltered verification history for a listing as a
// timeline. No collapsing of repeated events — every approve/reject action
// is shown, oldest to newest, so the audit trail is never hidden from an
// owner or moderator who has permission to see it.
//
// This timeline starts from the first recorded verification action, not
// from the listing's creation — deriving an initial "Pending" entry from
// mineral_listings.created_at is deliberately deferred (product decision)
// and can be added later without changing this component's shape.
export default function ListingHistory({ records }) {
  if (!records || records.length === 0) return null;

  // records arrive newest-first from getVerificationHistory; the timeline
  // reads oldest-to-newest, top to bottom.
  const chronological = [...records].reverse();

  return (
    <div className="border-t border-[#3D4148]/10 mt-4 pt-4">
      <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
        Verification history
      </div>
      <div className="relative pl-5">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-[#3D4148]/15" />
        <div className="space-y-4">
          {chronological.map((r) => (
            <div key={r.id} className="relative">
              <div
                className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  r.status === "approved" ? "bg-[#1F4D3D]" : "bg-[#8a3b3b]"
                }`}
              >
                {r.status === "approved" ? (
                  <ShieldCheck size={9} className="text-[#EDE8DC]" />
                ) : (
                  <Ban size={9} className="text-[#EDE8DC]" />
                )}
              </div>
              <div style={{ fontFamily: "system-ui, sans-serif" }}>
                <span
                  className={`text-sm ${
                    r.status === "approved" ? "text-[#1F4D3D]" : "text-[#8a3b3b]"
                  }`}
                >
                  {r.status === "approved" ? "Approved" : "Rejected"}
                </span>{" "}
                <span className="text-[#3D4148]/50 text-xs">
                  {formatDateTime(r.verified_at)}
                </span>
              </div>
              {r.notes && (
                <p
                  className="text-xs text-[#3D4148]/80 mt-0.5"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {r.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
