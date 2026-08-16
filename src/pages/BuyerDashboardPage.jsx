// BuyerDashboardPage.jsx
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Heart, MapPin, ShieldCheck, BookmarkCheck, Inbox } from "lucide-react";
import ListingCard from "../components/ListingCard";
import { mapListingRow } from "../utils/mapListingRow";
import { getSavedListings, saveListing, unsaveListing } from "../services/savedListings";
import { getFavouriteSellers, unfavouriteSeller } from "../services/favouriteSellers";
import { getListingsByIds, getSavedListingStatusSummary } from "../services/listings";
import { getProfilesByIds } from "../services/profiles";
import { useAuthContext } from "../context/AuthContext";

// Saved Listing Lifecycle Awareness — maps a listing's status/state to
// the label shown when it's no longer fully visible via the normal
// public listing view. Deliberately mirrors the muted, informational
// tone already used for terminal states elsewhere (e.g. inquiry
// "closed"/"withdrawn" styling).
function getUnavailableLabel(status, listingState) {
  if (status === "pending") return "Under review";
  if (status !== "verified") return "Unavailable";
  switch (listingState) {
    case "sold":
      return "Sold";
    case "paused":
      return "Temporarily unavailable";
    case "archived":
      return "No longer available";
    default:
      return "Unavailable";
  }
}

function UnavailableSavedListingCard({ entry, onRemove }) {
  return (
    <div className="bg-white rounded-lg p-4 flex items-center justify-between gap-3 shadow-sm border border-[#3D4148]/10">
      <div>
        <div className="font-serif text-base leading-tight text-[#3D4148]/70">
          {entry.mineral || "Listing"}
        </div>
        <span
          className="inline-block mt-1 text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded bg-[#3D4148]/10 text-[#3D4148]/60"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {getUnavailableLabel(entry.status, entry.listing_state)}
        </span>
      </div>
      <button
        onClick={() => onRemove(entry.listing_id)}
        title="Remove from saved listings"
        className="text-[#3D4148]/50 hover:text-[#8a3b3b] transition shrink-0"
      >
        <BookmarkCheck size={16} />
      </button>
    </div>
  );
}

function FavouriteSellerCard({ profile, onSellerClick, onRemove }) {
  return (
    <div className="bg-white rounded-lg p-4 flex items-start justify-between gap-3 shadow-sm border border-[#3D4148]/10">
      <button
        onClick={() => onSellerClick(profile.id)}
        className="text-left flex-1 min-w-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-serif text-base leading-tight">
            {profile.company || profile.name || "Unnamed seller"}
          </span>
          {profile.verification_status === "verified" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded bg-[#1F4D3D]/10 text-[#1F4D3D]">
              <ShieldCheck size={10} /> Verified
            </span>
          )}
        </div>
        {profile.location && (
          <div
            className="flex items-center gap-1 text-xs text-[#3D4148]/70 mt-1"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <MapPin size={11} /> {profile.location}
          </div>
        )}
      </button>
      <button
        onClick={() => onRemove(profile.id)}
        title="Remove from favourite sellers"
        className="text-[#3D4148]/50 hover:text-[#8a3b3b] transition shrink-0"
      >
        <Heart size={16} fill="currentColor" />
      </button>
    </div>
  );
}

export default function BuyerDashboardPage({ onBack, onListingClick, onSellerClick, onBuyerInquiries }) {
  const { user } = useAuthContext();

  const [savedListings, setSavedListings] = useState([]);
  const [savedListingIds, setSavedListingIds] = useState(new Set());
  const [unavailableSaved, setUnavailableSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(null);

  const [favouriteSellers, setFavouriteSellers] = useState([]);
  const [favouritesLoading, setFavouritesLoading] = useState(true);
  const [favouritesError, setFavouritesError] = useState(null);

  const loadSavedListings = useCallback(async () => {
    if (!user) return;
    setSavedLoading(true);
    setSavedError(null);

    const { data: savedRows, error: savedError } = await getSavedListings(user.id);
    if (savedError) {
      console.error("Failed to load saved listings", savedError);
      setSavedError(true);
      setSavedLoading(false);
      return;
    }

    const ids = (savedRows || []).map((row) => row.listing_id);
    setSavedListingIds(new Set(ids));

    if (ids.length === 0) {
      setSavedListings([]);
      setUnavailableSaved([]);
      setSavedLoading(false);
      return;
    }

    const [listingsRes, statusSummaryRes] = await Promise.all([
      getListingsByIds(ids),
      getSavedListingStatusSummary(),
    ]);

    if (listingsRes.error) {
      console.error("Failed to load saved listing details", listingsRes.error);
      setSavedError(true);
      setSavedLoading(false);
      return;
    }

    const visibleListings = listingsRes.data || [];
    const visibleIds = new Set(visibleListings.map((l) => l.id));
    setSavedListings(visibleListings.map(mapListingRow));

    // Soft-fail on the status summary — an unavailable-badge feature
    // failing to load shouldn't block the normally-visible saved
    // listings from rendering.
    if (!statusSummaryRes.error) {
      const unavailable = (statusSummaryRes.data || []).filter(
        (entry) => !visibleIds.has(entry.listing_id)
      );
      setUnavailableSaved(unavailable);
    }

    setSavedLoading(false);
  }, [user]);

  const loadFavouriteSellers = useCallback(async () => {
    if (!user) return;
    setFavouritesLoading(true);
    setFavouritesError(null);

    const { data: favRows, error: favError } = await getFavouriteSellers(user.id);
    if (favError) {
      console.error("Failed to load favourite sellers", favError);
      setFavouritesError(true);
      setFavouritesLoading(false);
      return;
    }

    const ids = (favRows || []).map((row) => row.seller_id);

    if (ids.length === 0) {
      setFavouriteSellers([]);
      setFavouritesLoading(false);
      return;
    }

    const { data: profileRows, error: profilesError } = await getProfilesByIds(ids);
    if (profilesError) {
      console.error("Failed to load favourite seller profiles", profilesError);
      setFavouritesError(true);
      setFavouritesLoading(false);
      return;
    }

    setFavouriteSellers(profileRows || []);
    setFavouritesLoading(false);
  }, [user]);

  useEffect(() => {
    loadSavedListings();
  }, [loadSavedListings]);

  useEffect(() => {
    loadFavouriteSellers();
  }, [loadFavouriteSellers]);

  const toggleSaveListing = async (listingId) => {
    if (!user) return;
    const isSaved = savedListingIds.has(listingId);
    const { error } = isSaved
      ? await unsaveListing(user.id, listingId)
      : await saveListing(user.id, listingId);
    if (error) {
      console.error("Failed to toggle saved listing", error);
      return;
    }
    // Since this page only ever shows listings that are currently saved,
    // un-saving one here means removing it from the visible list entirely
    // rather than just flipping its icon state (unlike Marketplace/Seller
    // Profile, where the listing stays visible either way).
    setSavedListingIds((prev) => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
    setSavedListings((prev) => prev.filter((l) => l.id !== listingId));
    setUnavailableSaved((prev) => prev.filter((e) => e.listing_id !== listingId));
  };

  const removeFavouriteSeller = async (sellerId) => {
    if (!user) return;
    const { error } = await unfavouriteSeller(user.id, sellerId);
    if (error) {
      console.error("Failed to remove favourite seller", error);
      return;
    }
    setFavouriteSellers((prev) => prev.filter((p) => p.id !== sellerId));
  };

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

        <h1 className="font-serif text-2xl mb-6">My dashboard</h1>

        {onBuyerInquiries && (
          <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 mb-6">
            <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-3">
              Quick actions
            </div>
            <button
              onClick={onBuyerInquiries}
              className="flex items-center gap-1.5 bg-[#B8922F] text-[#15130F] font-mono text-xs uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
            >
              <Inbox size={14} strokeWidth={2.5} /> Your inquiries
            </button>
          </div>
        )}

        <div className="mb-10">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/60 mb-3">
            <Bookmark size={12} /> Saved listings
          </div>

          {savedLoading && (
            <div className="text-center py-8 text-[#3D4148]/60">Loading saved listings…</div>
          )}

          {!savedLoading && savedError && (
            <div className="text-center py-8 text-[#8a3b3b]">
              Couldn't load your saved listings. Please try again.
            </div>
          )}

          {!savedLoading && !savedError && savedListings.length === 0 && unavailableSaved.length === 0 && (
            <div
              className="text-center py-8 text-[#3D4148]/60"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              You haven't saved any listings yet.
            </div>
          )}

          {!savedLoading && !savedError && savedListings.length > 0 && (
            <div className="space-y-3">
              {savedListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isAdmin={false}
                  isAuthenticated={Boolean(user)}
                  isSaved={savedListingIds.has(l.id)}
                  onToggleSave={toggleSaveListing}
                  onListingClick={onListingClick}
                  onSellerClick={onSellerClick}
                />
              ))}
            </div>
          )}

          {!savedLoading && !savedError && unavailableSaved.length > 0 && (
            <div className="space-y-3 mt-3">
              {unavailableSaved.map((entry) => (
                <UnavailableSavedListingCard
                  key={entry.listing_id}
                  entry={entry}
                  onRemove={toggleSaveListing}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/60 mb-3">
            <Heart size={12} /> Favourite sellers
          </div>

          {favouritesLoading && (
            <div className="text-center py-8 text-[#3D4148]/60">Loading favourite sellers…</div>
          )}

          {!favouritesLoading && favouritesError && (
            <div className="text-center py-8 text-[#8a3b3b]">
              Couldn't load your favourite sellers. Please try again.
            </div>
          )}

          {!favouritesLoading && !favouritesError && favouriteSellers.length === 0 && (
            <div
              className="text-center py-8 text-[#3D4148]/60"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              You haven't favourited any sellers yet.
            </div>
          )}

          {!favouritesLoading && !favouritesError && favouriteSellers.length > 0 && (
            <div className="space-y-3">
              {favouriteSellers.map((profile) => (
                <FavouriteSellerCard
                  key={profile.id}
                  profile={profile}
                  onSellerClick={onSellerClick}
                  onRemove={removeFavouriteSeller}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
