import { useEffect, useState } from "react";
import { Package, Layers as LayersIcon, MapPin, Users, ShieldCheck, CheckCircle } from "lucide-react";
import IntelligenceCard from "./IntelligenceCard";
import { getMarketplaceInformation } from "../../services/marketIntelligence";

// Phase 7A — Level 1 Information only. Every value here is a direct
// count, no interpretation, no ranking, no comparison.
export default function MarketplaceInformationSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceInformation().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load marketplace information", error);
        setError(true);
      } else {
        setData(data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl mb-1">Marketplace Information</h2>
      <p className="text-xs text-[#3D4148]/60 mb-4" style={{ fontFamily: "system-ui, sans-serif" }}>
        Verified facts about Stratum today. No interpretation — just what is currently true.
      </p>

      {loading && <div className="text-sm text-[#3D4148]/60">Loading…</div>}
      {!loading && error && (
        <div className="text-sm text-[#8a3b3b]">Couldn't load marketplace information.</div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <IntelligenceCard icon={CheckCircle} label="Verified listings" value={data.verified_listings} />
          <IntelligenceCard icon={Package} label="Active listings" value={data.active_listings} />
          <IntelligenceCard icon={LayersIcon} label="Minerals listed" value={data.minerals_listed} />
          <IntelligenceCard icon={MapPin} label="States represented" value={data.states_represented} />
          <IntelligenceCard icon={Users} label="Seller accounts" value={data.sellers_total} />
          <IntelligenceCard
            icon={ShieldCheck}
            label="Verified seller profiles"
            value={data.verified_seller_profiles}
            explanation={
              data.verified_seller_profiles === 0
                ? "No seller profiles have completed full verification yet — Stratum is in its early growth phase."
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
