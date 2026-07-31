import { supabase } from "./supabaseClient";

const LISTING_COLUMNS =
  "id, seller_id, mineral, category, description, quantity, mineral_grade, " +
  "country, state, location, availability, price, photo_url, status, " +
  "created_at, seller_name, seller_contact, seller_company, " +
  "local_government_area, listing_state";

// Valid listing_state values are enforced at the DB layer by a CHECK
// constraint (active, paused, sold, archived). This map additionally
// enforces which transitions between those values are allowed. This is a
// business-workflow rule, not a security rule — the DB does not enforce
// transitions, only valid values — so this validation must run before every
// listing_state write in the app.
const LISTING_STATE_TRANSITIONS = {
  active: ["paused", "sold", "archived"],
  paused: ["active", "sold", "archived"],
  sold: ["archived"],
  archived: [], // terminal state, no transitions out
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

// Saves the seller's uploaded photos for a listing. Expects photos already
// sorted by position (position 0 = cover). Only called after the listing
// row itself has been created, since listing_id is a required FK.
export async function createListingPhotos(listingId, photos) {
  const rows = photos.map((p) => ({
    listing_id: listingId,
    photo_url: p.url,
    position: p.position,
  }));
  return supabase.from("listing_photos").insert(rows);
}

// Saves a reference to the seller's uploaded assay report/certificate for
// a listing. Only called after the listing row itself has been created,
// since listing_id is a required FK — same timing as createListingPhotos.
// storagePath is the bucket-relative path (not a public URL), since the
// listing-documents bucket is private and access is via signed URLs.
// Document verification is independent of listing status, so this always
// starts as "pending" regardless of the listing's own approval state.
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

// Transitions a listing's lifecycle state (active/paused/sold/archived).
// Validates the transition against LISTING_STATE_TRANSITIONS before ever
// reaching the database — invalid transitions are rejected locally with no
// network call. Reads the current state from mineral_listings directly
// (not the public view) so this works regardless of the listing's
// verification status, matching the "sellers can view/manage own listings
// regardless of status" RLS policy.
//
// A successful DB write still isn't guaranteed just because the transition
// was valid: RLS silently returns zero rows (no thrown error) if the
// listing isn't owned by the caller. Callers should check
// `data` (null/undefined means denied or not found) rather than assuming
// success just because no error was thrown.
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

// Attempts to hard-delete a listing. There is currently no DELETE policy
// for any role on mineral_listings — not sellers, not moderators — so this
// call is expected to be denied by RLS for everyone. It's included here so
// the app has a single, honest entry point that mirrors real DB behaviour
// (returns zero rows, no thrown error) rather than the UI assuming a hard
// delete path exists. Archiving (via updateListingState) is the only
// supported removal path from a listing's lifecycle.
export async function deleteListing(id) {
  return supabase.from("mineral_listings").delete().eq("id", id).select();
}

export async function createVerificationRecord(record) {
  return supabase.from("verification_records").insert(record);
}
