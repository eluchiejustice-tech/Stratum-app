import { useEffect, useState } from "react";
import { ShieldCheck, Clock, FileCheck, UserCheck, Gauge } from "lucide-react";
import IntelligenceCard from "./IntelligenceCard";
import { getMarketplaceHealth } from "../../services/marketIntelligence";

// Phase 7C — marketplace quality indicators, not predictions. Every
// card's explanation states its own sample size where relevant, per the
// Intelligence Philosophy's Explainability Rule.
export default function MarketplaceHealthSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceHealth().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load marketplace health", error);
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
      <h2 className="font-serif text-xl mb-1">Marketplace Health</h2>
      <p className="text-xs text-[#3D4148]/60 mb-4" style={{ fontFamily: "system-ui, sans-serif" }}>
        How healthy and trustworthy the marketplace itself currently is — a measurement, not a prediction.
      </p>

      {loading && <div className="text-sm text-[#3D4148]/60">Loading…</div>}
      {!loading && error && (
        <div className="text-sm text-[#8a3b3b]">Couldn't load marketplace health.</div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <IntelligenceCard
            icon={ShieldCheck}
            label="Approval rate"
            value={data.approval_rate !== null ? `${data.approval_rate}%` : "—"}
            explanation={`Of ${data.decided_listings} listings reviewed so far (${data.verified_count} verified, ${data.rejected_count} rejected).`}
          />
          <IntelligenceCard
            icon={Clock}
            label="Avg. moderation turnaround"
            value={data.avg_turnaround_hours !== null ? `${data.avg_turnaround_hours}h` : "—"}
            explanation={`Based on ${data.turnaround_sample_size} listings with a recorded review history — not every decided listing has one yet.`}
          />
          <IntelligenceCard
            icon={UserCheck}
            label="Avg. profile completion"
            value={`${data.avg_profile_completion_pct}%`}
            explanation="Average across all seller and buyer profiles on Stratum."
          />
          <IntelligenceCard
            icon={FileCheck}
            label="Listings with assay report"
            value={`${data.documentation_coverage_pct}%`}
            explanation="Share of all listings that have a supporting assay report on file."
          />
          <IntelligenceCard
            icon={Gauge}
            label="Moderation coverage"
            value={`${data.moderation_coverage_pct}%`}
            explanation="Share of all listings that have been reviewed (verified or rejected), rather than still pending."
          />
        </div>
      )}
    </section>
  );
}
