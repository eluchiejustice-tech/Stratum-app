import { useState } from "react";
import Header from "../components/Header";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import ListingCard from "../components/ListingCard";
import ConsultingBanner from "../components/ConsultingBanner";
import AddListingModal from "../components/AddListingModal";
import { MINERAL_COLORS, bandsFor } from "../utils/mineralColors";
import { useAuthContext } from "../context/AuthContext";
import { useListings } from "../hooks/useListings";
import {
  createListing,
  updateListingStatus,
  createVerificationRecord,
} from "../services/listings";

// ============================================================
// STAGE 4 ROLLBACK NOTE: the old SEED_LISTINGS + localStorage
// implementation has been removed from active use below, but is
// preserved in git history (see commit before Stage 4). If Supabase
// integration needs to be reverted, check out the previous version
// of this file rather than reconstructing it from memory.
// ============================================================

export default function MarketplacePage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { user, role } = useAuthContext();
  const isModerator = role === "moderator";

  const { listings, loading, error, refresh } = useListings();

  // Map DB rows into the shape ListingCard already expects,
  // so ListingCard.jsx itself needs no changes.
  const cardListings = listings.map((row) => ({
    id: row.id,
    mineral: row.mineral,
    grade: row.mineral_grade,
    quantity: row.quantity,
    location: [row.location, row.local_government_area, row.state, row.country]
      .filter(Boolean)
      .join(", "),
    seller: row.seller_name,
    company: row.seller_company,
    contact: row.seller_contact,
    verified: row.status === "verified",
    price: row.price,
    photoUrl: row.photo_url,
    strata: bandsFor(row.mineral),
  }));

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
      photo_url: form.photoUrl || null,
      seller_name: form.seller,
      seller_company: form.company,
      seller_contact: form.contact,
      status: "pending",
    };
    const { error: insertError } = await createListing(payload);
    if (insertError) {
      console.error("Failed to create listing", insertError);
      return;
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
  const visible = cardListings.filter((l) => {
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
      <Header onAddListing={() => setShowAdd(true)} />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <div className="mb-5 space-y-3">
          <SearchBar value={search} onChange={setSearch} />
          <FilterChips minerals={minerals} active={filter} onSelect={setFilter} />
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
                onVerify={verifyListing}
                onReject={rejectListing}
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
