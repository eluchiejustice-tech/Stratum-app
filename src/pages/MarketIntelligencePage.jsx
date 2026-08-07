import { ArrowLeft } from "lucide-react";
import MarketplaceInformationSection from "../components/intelligence/MarketplaceInformationSection";
import MarketplaceInsightsSection from "../components/intelligence/MarketplaceInsightsSection";
import MarketplaceHealthSection from "../components/intelligence/MarketplaceHealthSection";
import ActivitySection from "../components/intelligence/ActivitySection";

export default function MarketIntelligencePage({ onBack }) {
  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/70 hover:text-[#15130F] transition mb-6"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <ArrowLeft size={14} /> Back to marketplace
        </button>

        <h1 className="font-serif text-2xl mb-1">Market Intelligence</h1>
        <p className="text-sm text-[#3D4148]/70 mb-6" style={{ fontFamily: "system-ui, sans-serif" }}>
          Evidence-backed information about Stratum's marketplace — built to help buyers, sellers, and
          partners make better decisions. Every figure here is a verified fact, not a prediction.
        </p>

        <MarketplaceInformationSection />
        <MarketplaceInsightsSection />
        <MarketplaceHealthSection />
        <ActivitySection />
      </div>
    </div>
  );
}
