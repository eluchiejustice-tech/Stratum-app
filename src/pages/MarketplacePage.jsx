import { useState } from "react";
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
  updateListingStatus,
  createVerificationRecord,
} from "../services/listings";

export default function MarketplacePage({ onSellerClick, onListingClick, onMyListings }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [stateFilter, setStateFilter] = useState("");
  const [lgaFilter, setLgaFilter] = useState("");

  const { user, role } = useAuthContext();
  const isModerator = role === "moderator";

  const { listings, loading, error, refresh } = useListings();

  const states = Object.keys(AFRICA_LOCATIONS.Nigeria);
  const lgaOptions = stateFilter ? AFRICA_LOCATIONS.Nigeria[stateFilter].lgas : [];

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
      document_url: form.documentUrl || null,
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

    if (form.photos && form.photos.length > 0) {
      const { error: photosError } = await createListingPhotos(newListing.id, form.photos);
      if (photosError) {
        console.error("Failed to save listing photos", photosError);
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
      }
    }

    await refresh();
  };

  const verifyListing = async (id) => {
    const { error: updateError } = await updateListingStatus(id, "verified");
    if (!updateError) {
      await createVerificationRecord({
        verification_type: "listing",
        reference_id: id,
        verified_by: user.id,
        status: "verified",
        notes: null,
      });
    }
    await refresh();
  };

  const rejectListing = async (id) => {
    const { error: updateError } = await updateListingStatus(id, "rejected");
    if (!updateError) {
      await createVerificationRecord({
        verification_type: "listing",
        reference_id: id,
        verified_by: user.id,
        status: "rejected",
        notes: null,
      });
    }
    await refresh();
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
      <Header onAddListing={() => setShowAdd(true)} onMyListings={onMyListings} />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
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
                onVerify={verifyListing}
                onReject={rejectListing}
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
