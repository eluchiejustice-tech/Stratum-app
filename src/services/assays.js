// services/assays.js
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
//
// Fix (Aug 2026): decision 'verified' must map to status 'approved' —
// ListingHistory only renders its green/ShieldCheck state for
// status === 'approved'. Passing through 'verified' unmapped caused every
// verified assay's history entry to render as "Rejected".
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
    status: r.decision === "verified" ? "approved" : "rejected",
    verified_at: r.created_at,
    notes: r.notes,
  }));

  return { data: mapped, error: null };
}

// Creates a new assay for a listing via direct INSERT (no RPC — the
// assays_insert RLS policy already enforces both authorization and the
// submitted_by = auth.uid() invariant at the database layer).
//
// submittedBy must be the caller's own auth.uid(), passed in explicitly
// by the component (via useAuthContext()) rather than derived here —
// this file has no access to auth state itself. The policy's WITH CHECK
// will reject the insert if it doesn't match the authenticated caller.
//
// Only safe, allowlisted fields are ever sent. verification_status and
// verified_by are never included: the DB defaults verification_status to
// 'pending' and leaves verified_by NULL, and a column-privilege
// restriction blocks authenticated clients from setting either directly
// regardless of what a client attempts to send.
export async function createAssay(listingId, submittedBy, fields) {
  const { mineral, numeric_value, unit, grade_type, method, assay_date } = fields;

  return supabase
    .from("assays")
    .insert({
      listing_id: listingId,
      submitted_by: submittedBy,
      mineral,
      numeric_value,
      unit,
      grade_type: grade_type || null,
      method: method || null,
      assay_date: assay_date || null,
    })
    .select()
    .single();
}

// Records a moderator verification decision on an assay via the
// SECURITY DEFINER RPC set_assay_verification_status(uuid, text, text).
// The RPC itself enforces is_moderator(), validates the decision value,
// updates assays.verification_status + verified_by = auth.uid(), and
// appends the corresponding assay_verification_history row — all
// server-side, in one atomic operation. This wrapper never supplies
// verified_by; only assayId, decision, and optional notes are sent.
export async function submitVerificationDecision(assayId, decision, notes = null) {
  return supabase.rpc("set_assay_verification_status", {
    p_assay_id: assayId,
    p_decision: decision,
    p_notes: notes,
  });
}
