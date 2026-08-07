import { useEffect, useState } from "react";
import { TrendingUp, MapPin } from "lucide-react";
import { getTopMinerals, getTopStates } from "../../services/marketIntelligence";
import { describeTopMinerals, describeTopState } from "../../utils/marketInsightText";

// Phase 7B — Level 2 Insight. Facts connected together, still fully
// factual and explainable. Ties are never resolved into a false winner.
export default function MarketplaceInsightsSection() {
  const [minerals, setMinerals] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTopMinerals(5), getTopStates(5)]).then(([mineralsRes, statesRes]) => {
      if (cancelled) return;
      if (mineralsRes.error || statesRes.error) {
        console.error("Failed to load marketplace insights", mineralsRes.error || statesRes.error);
        setError(true);
      } else {
        setMinerals(mineralsRes.data || []);
        setStates(statesRes.data || []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl mb-1">Marketplace Insights</h2>
      <p className="text-xs text-[#3D4148]/60 mb-4" style={{ fontFamily: "system-ui, sans-serif" }}>
        Facts connected together — still fully factual, no predictions.
      </p>

      {loading && <div className="text-sm text-[#3D4148]/60">Loading…</div>}
      {!loading && error && (
        <div className="text-sm text-[#8a3b3b]">Couldn't load marketplace insights.</div>
      )}

      {!loading && !error && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-[#3D4148]/10">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-2">
              <TrendingUp size={12} /> Most listed minerals
            </div>
            <p className="text-sm mb-3" style={{ fontFamily: "system-ui, sans-serif" }}>
              {describeTopMinerals(minerals)}
            </p>
            <ul className="space-y-1">
              {minerals.map((m) => (
                <li key={m.mineral} className="flex justify-between text-xs font-mono">
                  <span>{m.mineral}</span>
                  <span className="text-[#3D4148]/60">{m.listing_count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-[#3D4148]/10">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-2">
              <MapPin size={12} /> Top states by listings
            </div>
            <p className="text-sm mb-3" style={{ fontFamily: "system-ui, sans-serif" }}>
              {describeTopState(states)}
            </p>
            <ul className="space-y-1">
              {states.map((s) => (
                <li key={s.state} className="flex justify-between text-xs font-mono">
                  <span>{s.state}</span>
                  <span className="text-[#3D4148]/60">{s.listing_count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
