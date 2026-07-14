import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import ListingCard from "../components/ListingCard";
import { mapListingRow } from "../utils/mapListingRow";
import { getListingsBySeller } from "../services/listings";
import { useAuthContext } from "../context/AuthContext";

function StatusSection({ title, note, listings, onListingClick, onSellerClick }) {
  if (listings.length === 0) return null;

  return (
    <div className="mb-8">
      <div
        className="text-xs font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
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
          <ListingCard
            key={l.id}
            listing={l}
            isAdmin={false}
            onListingClick={onListingClick}
            onSellerClick={onSellerClick}
          />
        ))}
      </div>
    </div>
  );
}

export default function MyListingsPage({ onBack, onListingClick, onSellerClick }) {
  const { user } = useAuthContext();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadListings = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getListingsBySeller(user.id);

    if (fetchError) {
      console.error("Failed to load your listings", fetchError);
      setError(true);
      setLoading(false);
      return;
    }

    setListings((data || []).map(mapListingRow));
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

        <h1 className="font-serif text-2xl mb-6">My listings</h1>

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
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
            <StatusSection
              title="Verified"
              listings={verified}
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
            <StatusSection
              title="Rejected"
              note="These listings were not approved. Edit and resubmit, or contact support for details."
              listings={rejected}
              onListingClick={onListingClick}
              onSellerClick={onSellerClick}
            />
          </>
        )}
      </div>
    </div>
  );
}
