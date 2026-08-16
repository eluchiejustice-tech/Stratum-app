import { supabase } from "./supabaseClient";

// Mirrors services/listings.js conventions: thin wrappers returning
// { data, error } from the underlying Supabase client, with manual
// mapping only where the consuming component needs a different shape
// than what the table returns (see getAssayVerificationHistory below).

export async function getAssaysByListing(listingId) {
  return supabase
    .from("assays")
    .select(
      "id, mineral, numeric_value, unit, grade_type, method, assay_date, verification_status, notes, created_at"
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
}

// Maps assay_verification_history's actual columns (decision, created_at)
// to the shape ListingHistory.jsx already expects (status, verified_at) —
// the same component used for listing verification history, reused here
// unchanged. id is required (ListingHistory uses it as the React key in
// a list that reorders), so it's selected and passed through explicitly
// rather than only appearing in the mapped output.
export async function getAssayVerificationHistory(assayId) {
  const { data, error } = await supabase
    .from("assay_verification_history")
    .select("id, decision, notes, created_at")
    .eq("assay_id", assayId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  const mapped = (data || []).map((r) => ({
    id: r.id,
    status: r.decision,
    verified_at: r.created_at,
    notes: r.notes,
  }));

  return { data: mapped, error: null };
}
