import { useEffect, useState } from "react";
import { TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import {
  getMarketplaceInformation,
  getTopMinerals,
  getMarketplaceHealth,
} from "../../services/marketIntelligence";
import { describeTopMinerals } from "../../utils/marketInsightText";

// A concise Market Intelligence summary, reusable across any dashboard
// (Seller today; Buyer/Moderator/Agent in future phases). Self-contained
// — fetches its own data independently of whatever dashboard embeds it —
// and always links out to the full experience rather than duplicating it.
export default function MarketSnapshotSection({ onViewFull }) {
  const [info, setInfo] = useState(null);
  const [minerals, setMinerals] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMarketplaceInformation(), getTopMinerals(3), getMarketplaceHealth()]).then(
      ([infoRes, mineralsRes, healthRes]) => {
        if (cancelled) return;
        if (infoRes.error || mineralsRes.error || healthRes.error) {
          console.error(
            "Failed to load market snapshot",
            infoRes.error || mineralsRes.error || healthRes.error
          );
          setError(true);
        } else {
          setInfo(infoRes.data);
          setMinerals(mineralsRes.data || []);
          setHealth(healthRes.data);
        }
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 mb-6">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
        <TrendingUp size={12} /> Market snapshot
      </div>

      {loading && <div className="text-sm text-[#3D4148]/60">Loading…</div>}
      {!loading && error && (
        <div className="text-sm text-[#8a3b3b]">Couldn't load the market snapshot.</div>
      )}

      {!loading && !error && info && health && (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-3">
            <span>
              <strong>{info.verified_listings}</strong> verified listings marketplace-wide
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} className="text-[#1F4D3D]" />
              <strong>{health.approval_rate !== null ? `${health.approval_rate}%` : "—"}</strong> approval rate
            </span>
          </div>
          <p className="text-xs text-[#3D4148]/70 mb-4" style={{ fontFamily: "system-ui, sans-serif" }}>
            {describeTopMinerals(minerals)}
          </p>
        </>
      )}

      <button
        onClick={onViewFull}
        className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#1F4D3D] hover:underline transition"
      >
        View full Market Intelligence <ArrowRight size={13} />
      </button>
    </div>
  );
}
