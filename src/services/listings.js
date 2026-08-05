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

// Editable business fields for Edit Listing. This is a whitelist, not a
// blacklist: only keys in this list are ever written, regardless of what
// the caller passes. Deliberately excludes status, listing_state (both
// have their own dedicated, validated transition functions elsewhere —
// setListingVerificationStatus, resubmitListing, updateListingState), and
// every identity/system column (id, seller_id, created_at). photo_url
// (the cover-photo reference) is also excluded: Edit Listing in this
// phase only supports adding photos, not changing the cover.
//
// mineral and category ARE included: no RLS rule, trigger, or business
// rule makes a listing's mineral type immutable after creation — this
// mirrors the same field pairing AddListingModal already writes at
// creation time (category always equals mineral).
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

// Updates a listing's editable content fields only. Uses an explicit
// whitelist (EDITABLE_LISTING_FIELDS) rather than stripping specific
// disallowed keys — any field not on the list is silently dropped, so a
// future caller can't accidentally introduce a new writable field just by
// passing it in. `status`, `listing_state`, `id`, `seller_id`,
// `created_at` can never be written through this function, even if
// present in `fields`.
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
