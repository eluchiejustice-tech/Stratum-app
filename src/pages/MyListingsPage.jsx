// MyListingsPage.jsx
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban } from "lucide-react";
import ListingCard from "../components/ListingCard";
import { mapListingRow } from "../utils/mapListingRow";
import { getListingsBySeller, getListingEngagementDetail } from "../services/listings";
import { useAuthContext } from "../context/AuthContext";

function EngagementLine({ engagement }) {
  const e = engagement || {
    views_all_time: 0,
    views_last_7_days: 0,
    contact_clicks_all_time: 0,
    contact_clicks_last_7_days: 0,
  };

  return (
    <div
      className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 px-1 -mt-2 mb-3"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      Views: {e.views_all_time} (7d: {e.views_last_7_days}) · Contacts: {e.contact_clicks_all_time} (7d: {e.contact_clicks_last_7_days})
    </div>
  );
}

function StatusSection({ title, note, icon: Icon, listings, engagementByListing, onListingClick, onSellerClick }) {
  if (listings.length === 0) return null;

  return (
    <div className="mb-8">
      <div
        className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {Icon && <Icon size={12} />}
        {title}
      </div>
      {note && (
        <p
          className="text-xs text-[#3D4148]/60 mb-3"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {note}
        </p>
      )}
      <div className="space-y-3">
        {listings.map((l) => (
          <div key={l.id}>
            <ListingCard
              listing={l}
              isAdmin={false}
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
            <EngagementLine engagement={engagementByListing[l.id]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyListingsPage({ onBack, onListingClick, onSellerClick, embedded = false }) {
  const { user } = useAuthContext();
  const [listings, setListings] = useState([]);
  const [engagementByListing, setEngagementByListing] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadListings = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const [listingsRes, engagementRes] = await Promise.all([
      getListingsBySeller(user.id),
      getListingEngagementDetail(),
    ]);

    if (listingsRes.error) {
      console.error("Failed to load your listings", listingsRes.error);
      setError(true);
      setLoading(false);
      return;
    }

    setListings((listingsRes.data || []).map(mapListingRow));

    if (!engagementRes.error) {
      setEngagementByListing(
        Object.fromEntries((engagementRes.data || []).map((row) => [row.listing_id, row]))
      );
    } else {
      console.error("Failed to load listing engagement detail", engagementRes.error);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const pending = listings.filter((l) => l.statusRaw === "pending");
  const verified = listings.filter((l) => l.statusRaw === "verified");
  const rejected = listings.filter((l) => l.statusRaw === "rejected");

  return (
    <div
      className={embedded ? "" : "min-h-screen bg-[#EDE8DC] text-[#15130F]"}
      style={embedded ? undefined : { fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className={embedded ? "" : "max-w-4xl mx-auto px-5 sm:px-8 py-6"}>
        {!embedded && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/70 hover:text-[#15130F] transition mb-6"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <ArrowLeft size={14} /> Back to marketplace
          </button>
        )}

        {!embedded && <h1 className="font-serif text-2xl mb-6">My listings</h1>}

        {loading && (
          <div className="text-center py-12 text-[#3D4148]/60">Loading your listings…</div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-[#8a3b3b]">
            Couldn't load your listings. Please try again.
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div
            className="text-center py-12 text-[#3D4148]/60"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            You haven't submitted any listings yet.
          </div>
        )}

        {!loading && !error && listings.length > 0 && (
          <>
            <StatusSection
              title="Pending review"
              note="These listings are waiting for a moderator to verify them."
              listings={pending}
              engagementByListing={engagementByListing}
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
            <StatusSection
              title="Verified"
              listings={verified}
              engagementByListing={engagementByListing}
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
            <StatusSection
              title="Rejected"
              icon={Ban}
              note="This listing did not meet our verification requirements and isn't visible in the marketplace. Contact support for details, then submit a new listing once you've made corrections."
              listings={rejected}
              engagementByListing={engagementByListing}
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
          </>
        )}
      </div>
    </div>
  );
}
