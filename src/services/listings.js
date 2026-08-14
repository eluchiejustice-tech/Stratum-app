import { supabase } from "./supabaseClient";

const LISTING_COLUMNS =
  "id, seller_id, mineral, category, description, quantity, mineral_grade, " +
  "country, state, location, availability, price, photo_url, status, " +
  "created_at, seller_name, seller_contact, seller_company, " +
  "local_government_area, listing_state";

export const LISTING_STATE_TRANSITIONS = {
  active: ["paused", "sold", "archived"],
  paused: ["active", "sold", "archived"],
  sold: ["archived"],
  archived: [],
};

export async function getListings() {
  return supabase
    .from("mineral_listings_public")
    .select(LISTING_COLUMNS)
    .order("created_at", { ascending: false });
}

export async function getListingById(id) {
  return supabase
    .from("mineral_listings_public")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .single();
}

export async function getListingsBySeller(sellerId) {
  return supabase
    .from("mineral_listings_public")
    .select(LISTING_COLUMNS)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
}

export async function getListingsByIds(ids) {
  return supabase
    .from("mineral_listings_public")
    .select(LISTING_COLUMNS)
    .in("id", ids)
    .order("created_at", { ascending: false });
}

export async function createListing(listing) {
  return supabase.from("mineral_listings").insert(listing).select().single();
}

const EDITABLE_LISTING_FIELDS = [
  "mineral",
  "category",
  "description",
  "quantity",
  "mineral_grade",
  "state",
  "local_government_area",
  "location",
  "availability",
  "price",
  "seller_name",
  "seller_company",
  "seller_contact",
];

export async function updateListingContent(id, fields) {
  const safeFields = {};
  for (const key of EDITABLE_LISTING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      safeFields[key] = fields[key];
    }
  }

  return supabase
    .from("mineral_listings")
    .update(safeFields)
    .eq("id", id)
    .select()
    .single();
}

export async function createListingPhotos(listingId, photos) {
  const rows = photos.map((p) => ({
    listing_id: listingId,
    photo_url: p.url,
    position: p.position,
  }));
  return supabase.from("listing_photos").insert(rows);
}

// Deletes one existing listing photo: the DB row first (RLS already
// restricts this to the owning seller via the listing_photos DELETE
// policy), then the corresponding storage object. If the id doesn't
// belong to the caller's own listing, the DELETE matches 0 rows with no
// Postgres error, which we surface as "not_authorized" below rather than
// proceeding to touch storage. If the DB delete succeeds but the storage
// cleanup fails, the photo is still correctly removed from the listing —
// the leftover storage file just joins the existing small set of
// pre-existing orphaned files, a separate known/deferred cleanup item.
export async function deleteListingPhoto(photo) {
  const { data, error: dbError } = await supabase
    .from("listing_photos")
    .delete()
    .eq("id", photo.id)
    .select();

  if (dbError) {
    console.error("Failed to delete listing_photos row", dbError);
    return { error: dbError, stage: "db_delete" };
  }

  if (!data || data.length === 0) {
    return {
      error: { message: "Photo not found or not owned by you." },
      stage: "not_authorized",
    };
  }

  const storagePath = photo.photo_url.split("/listing-photos/")[1];
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("listing-photos")
      .remove([storagePath]);

    if (storageError) {
      console.error("Photo row deleted but storage cleanup failed", storageError);
      return { error: storageError, stage: "storage_delete" };
    }
  }

  return { error: null, stage: null };
}

export async function createListingDocument(listingId, storagePath, uploadedBy) {
  return supabase.from("mineral_documents").insert({
    listing_id: listingId,
    document_type: "assay_report",
    file_url: storagePath,
    uploaded_by: uploadedBy,
    verification_status: "pending",
  });
}

export async function getPhotosByListing(listingId) {
  return supabase
    .from("listing_photos")
    .select("*")
    .eq("listing_id", listingId)
    .order("position", { ascending: true });
}

export async function updateListingStatus(id, status) {
  return supabase.from("mineral_listings").update({ status }).eq("id", id);
}

export async function createVerificationRecord(record) {
  return supabase.from("verification_records").insert(record);
}

const VERIFICATION_RECORD_STATUS = {
  verified: "approved",
  rejected: "rejected",
};

// Replaces the previous two-step client-side pattern (separate status
// update + audit insert, which could leave a status change with no
// corresponding audit row if the second call failed independently) with a
// single atomic RPC. set_listing_verification_status performs both writes
// in one database transaction: if either fails, both roll back together.
// moderatorId is intentionally unused now — the RPC derives verified_by
// from auth.uid() server-side, matching the same pattern already used by
// resubmit_listing and the buyer-interest RPCs. Kept as a parameter only
// so existing call sites (ListingDetailPage.jsx) don't need to change.
export async function setListingVerificationStatus(id, decision, moderatorId, notes = null) {
  const { data, error } = await supabase.rpc("set_listing_verification_status", {
    p_listing_id: id,
    p_decision: decision,
    p_notes: notes,
  });

  if (error) {
    return { error, stage: "verification_decision" };
  }

  return { data, error: null, stage: null };
}

export async function getVerificationHistory(listingId) {
  return supabase
    .from("verification_records")
    .select("id, status, notes, verified_at")
    .eq("verification_type", "listing")
    .eq("reference_id", listingId)
    .order("verified_at", { ascending: false });
}

export async function resubmitListing(id) {
  return supabase.rpc("resubmit_listing", { p_listing_id: id });
}

export async function updateListingState(id, newState) {
  const { data: current, error: fetchError } = await supabase
    .from("mineral_listings")
    .select("listing_state")
    .eq("id", id)
    .single();

  if (fetchError) {
    return { data: null, error: fetchError };
  }

  const currentState = current.listing_state;
  const allowedNextStates = LISTING_STATE_TRANSITIONS[currentState] || [];

  if (!allowedNextStates.includes(newState)) {
    return {
      data: null,
      error: {
        message: `Invalid listing_state transition: ${currentState} -> ${newState}`,
        code: "invalid_transition",
      },
    };
  }

  return supabase
    .from("mineral_listings")
    .update({ listing_state: newState })
    .eq("id", id)
    .select()
    .single();
}

export async function deleteListing(id) {
  return supabase.from("mineral_listings").delete().eq("id", id).select();
}

// ---- Seller Dashboard support functions (Phase 6) ----

// Lightweight status counts for dashboard summary cards. Four count-only
// queries (head: true, no rows returned) rather than one full-row fetch —
// cost stays flat regardless of whether a seller has 5 or 5,000 listings,
// directly addressing the scalability issue found in MyListingsPage.
export async function getListingCountsBySeller(sellerId) {
  const statuses = ["pending", "verified", "rejected"];
  const results = await Promise.all(
    statuses.map((status) =>
      supabase
        .from("mineral_listings")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("status", status)
    )
  );

  const firstError = results.find((r) => r.error)?.error || null;
  if (firstError) return { data: null, error: firstError };

  const [pendingRes, verifiedRes, rejectedRes] = results;
  const pending = pendingRes.count || 0;
  const verified = verifiedRes.count || 0;
  const rejected = rejectedRes.count || 0;

  return {
    data: { pending, verified, rejected, total: pending + verified + rejected },
    error: null,
  };
}

// Same count-only pattern, for the Listing Lifecycle overview.
export async function getListingStateCountsBySeller(sellerId) {
  const states = ["active", "paused", "sold", "archived"];
  const results = await Promise.all(
    states.map((state) =>
      supabase
        .from("mineral_listings")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("listing_state", state)
    )
  );

  const firstError = results.find((r) => r.error)?.error || null;
  if (firstError) return { data: null, error: firstError };

  const [activeRes, pausedRes, soldRes, archivedRes] = results;
  return {
    data: {
      active: activeRes.count || 0,
      paused: pausedRes.count || 0,
      sold: soldRes.count || 0,
      archived: archivedRes.count || 0,
    },
    error: null,
  };
}

// Selects only id, mineral, status — not the full ~20-column row. Powers
// the "Needs Attention" rejected-listings list and the seller's
// most-listed mineral (for Market Intelligence).
export async function getListingIdentifiersBySeller(sellerId) {
  return supabase
    .from("mineral_listings")
    .select("id, mineral, status")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
}

// Seller-scoped moderation feed: the most recent verification_records
// across ALL of this seller's listings, not per-listing like
// ListingHistory. reference_id has no real FK to mineral_listings (it's
// polymorphic across verification_type), so this is a two-step lookup,
// not a join: first this seller's listing ids+names, then records
// restricted to those ids. Mineral name is merged back in afterward.
export async function getRecentModerationActivity(sellerId, limit = 5) {
  const { data: listings, error: listErr } = await supabase
    .from("mineral_listings")
    .select("id, mineral")
    .eq("seller_id", sellerId);

  if (listErr) return { data: null, error: listErr };
  if (!listings || listings.length === 0) return { data: [], error: null };

  const idToMineral = Object.fromEntries(listings.map((l) => [l.id, l.mineral]));
  const ids = listings.map((l) => l.id);

  const { data: records, error: recErr } = await supabase
    .from("verification_records")
    .select("id, status, notes, verified_at, reference_id")
    .eq("verification_type", "listing")
    .in("reference_id", ids)
    .order("verified_at", { ascending: false })
    .limit(limit);

  if (recErr) return { data: null, error: recErr };

  const merged = records.map((r) => ({
    ...r,
    mineral: idToMineral[r.reference_id] || "Unknown listing",
  }));

  return { data: merged, error: null };
}

// Market Intelligence, deliberately minimal per product decision: a
// marketplace-wide count of verified listings for one mineral. No price
// data involved — sidesteps the free-text price field entirely. Reads
// from mineral_listings_public, matching every other marketplace-wide
// read in this app.
export async function getVerifiedListingCountForMineral(mineral) {
  return supabase
    .from("mineral_listings_public")
    .select("*", { count: "exact", head: true })
    .eq("mineral", mineral)
    .eq("status", "verified");
}

// Phase 7D — Engagement Intelligence. Returns aggregate-only counts (no
// individual events, viewer IDs, or fingerprints) for the calling
// seller's own listings. Relies entirely on existing RLS on
// listing_view and contact_seller_click for scoping — this function
// does no filtering of its own, matching the SECURITY INVOKER design
// of the underlying RPC.
export async function getListingEngagementSummary() {
  return supabase.rpc("get_listing_engagement_summary");
}

// Phase 2 — Saved Listing Lifecycle Awareness. Returns minimal status
// info (no price/location/contact/document fields) for every listing
// the calling buyer has saved, regardless of whether that listing is
// currently visible via mineral_listings_public's RLS. Takes no
// parameters — the underlying RPC enforces ownership internally via
// auth.uid(), so this can never be used to look up an arbitrary
// listing's status.
export async function getSavedListingStatusSummary() {
  return supabase.rpc("get_saved_listing_status_summary");
}
