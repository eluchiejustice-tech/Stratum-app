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
export const LISTING_STATE_TRANSITIONS = {
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

export async function createVerificationRecord(record) {
  return supabase.from("verification_records").insert(record);
}

// A moderator's decision ("verified" or "rejected") maps directly to
// mineral_listings.status, which accepts both values. verification_records.status
// has its own, narrower CHECK constraint (approved | rejected) — this map is the
// single source of truth for that difference, so the mismatch can't be
// reintroduced by a future caller writing "verified" directly into an audit record.
const VERIFICATION_RECORD_STATUS = {
  verified: "approved",
  rejected: "rejected",
};

// Applies a moderator's verify/reject decision: updates mineral_listings.status
// and writes the corresponding audit row to verification_records. Callers only
// ever deal in business state ("verified"/"rejected") — the translation to
// verification_records' own status vocabulary happens here and nowhere else.
//
// These are two independent Supabase calls (no multi-table transaction available
// via supabase-js), so it's possible for the first to succeed and the second to
// fail — callers must check the returned error and stage, not just assume
// success once the function resolves.
export async function setListingVerificationStatus(id, decision, moderatorId, notes = null) {
  const { error: statusError } = await updateListingStatus(id, decision);
  if (statusError) {
    return { error: statusError, stage: "status_update" };
  }

  const { error: recordError } = await createVerificationRecord({
    verification_type: "listing",
    reference_id: id,
    verified_by: moderatorId,
    status: VERIFICATION_RECORD_STATUS[decision],
    notes,
  });

  if (recordError) {
    return { error: recordError, stage: "verification_record" };
  }

  return { error: null, stage: null };
}

// Returns the full chronological verification history for a listing —
// every approve/reject action ever recorded, newest first. No filtering
// or collapsing: repeated moderation events (e.g. reject → resubmit →
// reject again) are shown in full, matching Stratum's audit-trail-as-
// infrastructure principle. verified_by is deliberately not selected —
// moderator identity stays internal; the DB still records it for
// accountability, the UI simply doesn't surface it. RLS already restricts
// this to the listing's owner or a moderator.
export async function getVerificationHistory(listingId) {
  return supabase
    .from("verification_records")
    .select("id, status, notes, verified_at")
    .eq("verification_type", "listing")
    .eq("reference_id", listingId)
    .order("verified_at", { ascending: false });
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
