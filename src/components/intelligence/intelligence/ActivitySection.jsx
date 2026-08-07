import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getMarketplaceActivity } from "../../services/marketIntelligence";

function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Phase 7B — Marketplace Activity. Only verified-listing events today;
// designed to accept future activity types (lab joins, agent milestones)
// without changing this component's shape.
export default function ActivitySection() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceActivity(10).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load marketplace activity", error);
        setError(true);
      } else {
        setActivity(data || []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl mb-1">Marketplace Activity</h2>
      <p className="text-xs text-[#3D4148]/60 mb-4" style={{ fontFamily: "system-ui, sans-serif" }}>
        Recent verified events on Stratum.
      </p>

      <div className="bg-white rounded-lg p-4 shadow-sm border border-[#3D4148]/10">
        {loading && <div className="text-sm text-[#3D4148]/60">Loading…</div>}
        {!loading && error && (
          <div className="text-sm text-[#8a3b3b]">Couldn't load marketplace activity.</div>
        )}
        {!loading && !error && activity.length === 0 && (
          <div className="text-sm text-[#3D4148]/60">No marketplace activity yet.</div>
        )}
        {!loading && !error && activity.length > 0 && (
          <ul className="space-y-3">
            {activity.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <ShieldCheck size={14} className="text-[#1F4D3D] shrink-0 mt-0.5" />
                <div style={{ fontFamily: "system-ui, sans-serif" }}>
                  <strong>{item.mineral}</strong> listing verified{item.state ? ` in ${item.state}` : ""}
                  <div className="text-[#3D4148]/50 text-xs mt-0.5">{formatDateTime(item.occurred_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
