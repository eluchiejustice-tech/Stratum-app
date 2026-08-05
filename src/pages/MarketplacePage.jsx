import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Header from "../components/Header";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import ListingCard from "../components/ListingCard";
import ConsultingBanner from "../components/ConsultingBanner";
import AddListingModal from "../components/AddListingModal";
import { MINERAL_COLORS } from "../utils/mineralColors";
import { mapListingRow } from "../utils/mapListingRow";
import { AFRICA_LOCATIONS } from "../data/africaLocations";
import { useAuthContext } from "../context/AuthContext";
import { useListings } from "../hooks/useListings";
import {
  createListing,
  createListingPhotos,
  createListingDocument,
  setListingVerificationStatus,
} from "../services/listings";
import { getSavedListings, saveListing, unsaveListing } from "../services/savedListings";

const UPLOAD_WARNING_MESSAGES = {
  photos: "Your listing was created successfully, but the photos could not be uploaded.",
  document: "Your listing was created successfully, but the document could not be uploaded.",
  both: "Your listing was created successfully, but some attachments could not be uploaded.",
};

export default function MarketplacePage({ onSellerClick, onListingClick, onMyListings, onBuyerDashboard }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [stateFilter, setStateFilter] = useState("");
  const [lgaFilter, setLgaFilter] = useState("");
  const [uploadWarning, setUploadWarning] = useState(null);
  const [savedListingIds, setSavedListingIds] = useState(new Set());

  const { user, role } = useAuthContext();
  const isModerator = role === "moderator";

  const { listings, loading, error, refresh } = useListings();

  const states = Object.keys(AFRICA_LOCATIONS.Nigeria);
  const lgaOptions = stateFilter ? AFRICA_LOCATIONS.Nigeria[stateFilter].lgas : [];

  useEffect(() => {
    if (!user) {
      setSavedListingIds(new Set());
      return;
    }
    let cancelled = false;
    getSavedListings(user.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load saved listings", error);
        return;
      }
      setSavedListingIds(new Set(data.map((row) => row.listing_id)));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const openAddListing = () => {
    setUploadWarning(null);
    setShowAdd(true);
  };

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
      setUploadWarning(UPLOAD_WARNING_MESSAGES.both);
    } else if (photosFailed) {
      setUploadWarning(UPLOAD_WARNING_MESSAGES.photos);
    } else if (documentFailed) {
      setUploadWarning(UPLOAD_WARNING_MESSAGES.document);
    }

    await refresh();
  };

  // Reject is intentionally not handled here. Rejection now requires a
  // moderator to open the listing, review it, and provide feedback — it is
  // a Listing Detail Page workflow, not a marketplace list action.
  // ListingCard remains a lightweight summary component and no longer
  // accepts an onReject handler.
  const verifyListing = async (id) => {
    const { error } = await setListingVerificationStatus(id, "verified", user.id);
    if (error) {
      console.error("Failed to verify listing", error);
    }
    await refresh();
  };

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
    setSavedListingIds((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(listingId);
      } else {
        next.add(listingId);
      }
      return next;
    });
  };

  const minerals = ["All", ...Object.keys(MINERAL_COLORS)];

  // State/LGA are filtered against the raw Supabase rows (exact match on the
  // real `state` / `local_government_area` columns) before mapping, since
  // mapListingRow collapses those into a single display string. Mineral and
  // free-text search continue to run on the mapped cards exactly as before.
  const visible = listings
    .filter((row) => {
      const matchesState = !stateFilter || row.state === stateFilter;
      const matchesLga = !lgaFilter || row.local_government_area === lgaFilter;
      return matchesState && matchesLga;
    })
    .map(mapListingRow)
    .filter((l) => {
      const matchesFilter = filter === "All" || l.mineral === filter;
      const matchesSearch =
        search === "" ||
        l.mineral.toLowerCase().includes(search.toLowerCase()) ||
        l.location.toLowerCase().includes(search.toLowerCase()) ||
        l.grade.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });

  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <Header
        onAddListing={openAddListing}
        onMyListings={onMyListings}
        onBuyerDashboard={onBuyerDashboard}
      />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        {uploadWarning && (
          <div
            className="flex items-start justify-between gap-3 bg-[#9c7a1f]/10 border border-[#9c7a1f]/30 text-[#9c7a1f] text-sm rounded px-4 py-3 mb-4"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <span>{uploadWarning}</span>
            <button
              onClick={() => setUploadWarning(null)}
              aria-label="Dismiss"
              className="shrink-0 text-[#9c7a1f] hover:text-[#15130F] transition"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mb-5 space-y-3">
          <SearchBar value={search} onChange={setSearch} />
          <FilterChips minerals={minerals} active={filter} onSelect={setFilter} />

          <div className="flex gap-2">
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setLgaFilter("");
              }}
              className="flex-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            >
              <option value="">All States</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>

            <select
              value={lgaFilter}
              onChange={(e) => setLgaFilter(e.target.value)}
              disabled={!stateFilter}
              className="flex-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{stateFilter ? "All LGAs" : "Select State First"}</option>
              {lgaOptions.map((lga) => (
                <option key={lga.name} value={lga.name}>
                  {lga.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="text-center py-12 text-[#3D4148]/60">Loading listings…</div>
          )}

          {error && (
            <div className="text-center py-12 text-[#8a3b3b]">
              Couldn't load listings. Please try again.
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div
              className="text-center py-12 text-[#3D4148]/60"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              No listings match. Try a different filter, or be the first to list this mineral.
            </div>
          )}

          {!loading &&
            !error &&
            visible.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                isAdmin={isModerator}
                isAuthenticated={Boolean(user)}
                isSaved={savedListingIds.has(l.id)}
                onToggleSave={toggleSaveListing}
                onVerify={verifyListing}
                onSellerClick={onSellerClick}
                onListingClick={onListingClick}
              />
            ))}
        </div>

        <ConsultingBanner />
      </main>

      {showAdd && (
        <AddListingModal onClose={() => setShowAdd(false)} onAdd={addListing} />
      )}
    </div>
  );
}
