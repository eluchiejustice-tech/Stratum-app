import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  Ban,
  Check,
  Layers,
  Plus,
} from "lucide-react";
import MyListingsPage from "./MyListingsPage";
import MarketSnapshotSection from "../components/intelligence/MarketSnapshotSection";
import AddListingModal from "../components/AddListingModal";
import { useAuthContext } from "../context/AuthContext";
import { getProfileById } from "../services/profiles";
import {
  getListingCountsBySeller,
  getListingStateCountsBySeller,
  getListingIdentifiersBySeller,
  getRecentModerationActivity,
  createListing,
  createListingPhotos,
  createListingDocument,
} from "../services/listings";

// Fields a seller can fill in via Edit Profile — used only to compute a
// completion percentage here. Profile editing itself is deliberately not
// duplicated on this page; Header's existing "Edit profile" button
// remains the single entry point, per product decision.
const PROFILE_COMPLETION_FIELDS = ["name", "company", "bio", "contact", "location"];

function computeProfileCompletion(profile) {
  if (!profile) return 0;
  const filled = PROFILE_COMPLETION_FIELDS.filter((field) => {
    const value = profile[field];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  return Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SellerDashboardPage({ onBack, onListingClick, onSellerClick, onMarketIntelligence }) {
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [counts, setCounts] = useState(null);
  const [stateCounts, setStateCounts] = useState(null);
  const [identifiers, setIdentifiers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [profile, setProfile] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [uploadWarning, setUploadWarning] = useState(null);

  // This page owns its own AddListingModal state, separate from
  // MarketplacePage's — each page-level "+ New Listing" workflow is
  // self-contained, matching how this project has consistently preferred
  // page-owned state over lifting shared state into App.jsx.
  const loadDashboard = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const [countsRes, stateCountsRes, identifiersRes, activityRes, profileRes] = await Promise.all([
      getListingCountsBySeller(user.id),
      getListingStateCountsBySeller(user.id),
      getListingIdentifiersBySeller(user.id),
      getRecentModerationActivity(user.id, 5),
      getProfileById(user.id),
    ]);

    if (countsRes.error || stateCountsRes.error || identifiersRes.error || activityRes.error || profileRes.error) {
      console.error("Failed to load seller dashboard data", {
        countsError: countsRes.error,
        stateCountsError: stateCountsRes.error,
        identifiersError: identifiersRes.error,
        activityError: activityRes.error,
        profileError: profileRes.error,
      });
      setError(true);
      setLoading(false);
      return;
    }

    setCounts(countsRes.data);
    setStateCounts(stateCountsRes.data);
    setIdentifiers(identifiersRes.data || []);
    setRecentActivity(activityRes.data || []);
    setProfile(profileRes.data);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openAddListing = () => {
    setUploadWarning(null);
    setShowAdd(true);
  };

  // Mirrors MarketplacePage's addListing exactly (same payload shape,
  // same upload-failure handling) — duplicated deliberately rather than
  // shared, consistent with this page owning its own modal state rather
  // than reaching into MarketplacePage's.
  const addListing = async (form) => {
    const payload = {
      seller_id: user.id,
      mineral: form.mineral,
      category: form.mineral,
      description: form.grade,
      quantity: form.quantity,
      mineral_grade: form.grade,
      country: "Nigeria",
      state: form.state,
      local_government_area: form.lga,
      location: form.location,
      availability: "in_stock",
      price: form.price,
      photo_url: form.photos?.[0]?.url || null,
      seller_name: form.seller,
      seller_company: form.company,
      seller_contact: form.contact,
      status: "pending",
    };
    const { data: newListing, error: insertError } = await createListing(payload);
    if (insertError) {
      console.error("Failed to create listing", insertError);
      return;
    }

    let photosFailed = false;
    let documentFailed = false;

    if (form.photos && form.photos.length > 0) {
      const { error: photosError } = await createListingPhotos(newListing.id, form.photos);
      if (photosError) {
        console.error("Failed to save listing photos", photosError);
        photosFailed = true;
      }
    }

    if (form.documentUrl) {
      const { error: documentError } = await createListingDocument(
        newListing.id,
        form.documentUrl,
        user.id
      );
      if (documentError) {
        console.error("Failed to save listing document", documentError);
        documentFailed = true;
      }
    }

    if (photosFailed && documentFailed) {
      setUploadWarning("Your listing was created successfully, but some attachments could not be uploaded.");
    } else if (photosFailed) {
      setUploadWarning("Your listing was created successfully, but the photos could not be uploaded.");
    } else if (documentFailed) {
      setUploadWarning("Your listing was created successfully, but the document could not be uploaded.");
    }

    await loadDashboard();
  };

  const rejectedListings = identifiers.filter((l) => l.status === "rejected");
  const completionPct = computeProfileCompletion(profile);
  const verificationStatus = (profile?.verification_status || "unverified").toLowerCase();

  const needsAttentionItems = [];
  if (rejectedListings.length > 0) {
    needsAttentionItems.push({
      key: "rejected",
      icon: Ban,
      color: "#8a3b3b",
      text: `${rejectedListings.length} listing${rejectedListings.length === 1 ? "" : "s"} rejected — review feedback and resubmit`,
    });
  }
  if (counts && counts.pending > 0) {
    needsAttentionItems.push({
      key: "pending",
      icon: AlertTriangle,
      color: "#9c7a1f",
      text: `${counts.pending} listing${counts.pending === 1 ? "" : "s"} pending moderator review`,
    });
  }
  if (completionPct < 100) {
    needsAttentionItems.push({
      key: "profile",
      icon: AlertTriangle,
      color: "#9c7a1f",
      text: `Your profile is ${completionPct}% complete — finish it to build buyer trust`,
    });
  }
  if (verificationStatus !== "verified") {
    needsAttentionItems.push({
      key: "verification",
      icon: ShieldCheck,
      color: "#9c7a1f",
      text: `Seller verification status: ${verificationStatus}`,
    });
  }

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

        <h1 className="font-serif text-2xl mb-6">Seller dashboard</h1>

        {loading && (
          <div className="text-center py-12 text-[#3D4148]/60">Loading your dashboard…</div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-[#8a3b3b]">
            Couldn't load your dashboard. Please try again.
          </div>
        )}

        {!loading && !error && (
          <>
            {uploadWarning && (
              <div
                className="bg-[#9c7a1f]/10 border border-[#9c7a1f]/30 text-[#9c7a1f] text-sm rounded px-4 py-3 mb-6"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {uploadWarning}
              </div>
            )}

            {/* Needs Attention */}
            {needsAttentionItems.length > 0 ? (
              <div className="bg-white rounded-lg p-5 shadow-sm border border-[#8a3b3b]/20 mb-6">
                <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
                  Needs attention
                </div>
                <div className="space-y-2">
                  {needsAttentionItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.key} className="flex items-start gap-2 text-sm">
                        <Icon size={14} style={{ color: item.color }} className="shrink-0 mt-0.5" />
                        <span style={{ fontFamily: "system-ui, sans-serif" }}>{item.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-5 shadow-sm border border-[#1F4D3D]/20 mb-6 flex items-center gap-2">
                <Check size={16} className="text-[#1F4D3D]" />
                <span className="text-sm" style={{ fontFamily: "system-ui, sans-serif" }}>
                  All caught up — nothing needs your attention right now.
                </span>
              </div>
            )}

            {/* Summary cards */}
            {counts && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Total", value: counts.total },
                  { label: "Pending", value: counts.pending },
                  { label: "Verified", value: counts.verified },
                  { label: "Rejected", value: counts.rejected },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="bg-white rounded-lg p-4 shadow-sm border border-[#3D4148]/10 text-center"
                  >
                    <div className="text-2xl font-mono text-[#15130F]">{card.value}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mt-1">
                      {card.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Listing Lifecycle overview */}
            {stateCounts && (
              <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 mb-6">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
                  <Layers size={12} /> Listing lifecycle
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>Active: <strong>{stateCounts.active}</strong></span>
                  <span>Paused: <strong>{stateCounts.paused}</strong></span>
                  <span>Sold: <strong>{stateCounts.sold}</strong></span>
                  <span>Archived: <strong>{stateCounts.archived}</strong></span>
                </div>
              </div>
            )}

            {/* Market Snapshot — Phase 7. Concise summary only; the full
                Market Intelligence experience lives on its own page,
                reachable from here and from Header. */}
            <MarketSnapshotSection onViewFull={onMarketIntelligence} />

            {/* Recent Moderation Activity */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 mb-6">
              <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
                Recent moderation activity
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-[#3D4148]/60" style={{ fontFamily: "system-ui, sans-serif" }}>
                  No moderation activity yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex gap-2 text-sm">
                      {item.status === "approved" ? (
                        <ShieldCheck size={14} className="text-[#1F4D3D] shrink-0 mt-0.5" />
                      ) : (
                        <Ban size={14} className="text-[#8a3b3b] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div style={{ fontFamily: "system-ui, sans-serif" }}>
                          <strong>{item.mineral}</strong>{" "}
                          <span className={item.status === "approved" ? "text-[#1F4D3D]" : "text-[#8a3b3b]"}>
                            {item.status === "approved" ? "Approved" : "Rejected"}
                          </span>{" "}
                          <span className="text-[#3D4148]/50 text-xs">{formatDate(item.verified_at)}</span>
                        </div>
                        {item.status === "rejected" && item.notes && (
                          <p className="text-xs text-[#3D4148]/70 mt-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 mb-6">
              <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
                Quick actions
              </div>
              <button
                onClick={openAddListing}
                className="flex items-center gap-1.5 bg-[#B8922F] text-[#15130F] font-mono text-xs uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
              >
                <Plus size={14} strokeWidth={2.5} /> New listing
              </button>
            </div>

            {/* Listings Management — embedded, replaces the old standalone
                "My listings" page/nav entry entirely */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10">
              <h2 className="font-serif text-xl mb-4">Your listings</h2>
              <MyListingsPage
                embedded
                onListingClick={onListingClick}
                onSellerClick={onSellerClick}
              />
            </div>
          </>
        )}
      </div>

      {showAdd && (
        <AddListingModal onClose={() => setShowAdd(false)} onAdd={addListing} />
      )}
    </div>
  );
}
