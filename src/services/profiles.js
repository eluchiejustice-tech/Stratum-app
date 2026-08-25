import { supabase } from "./supabaseClient";

export async function getProfileById(id) {
  return supabase.from("profiles_public").select("*").eq("id", id).single();
}

export async function getProfilesByIds(ids) {
  return supabase.from("profiles_public").select("*").in("id", ids);
}

export async function getApprovedListingsBySeller(sellerId) {
  return supabase
    .from("mineral_listings_public")
    .select("*")
    .eq("seller_id", sellerId)
    .eq("status", "verified");
}

// Updates the self-editable fields on the caller's own profile row.
// verification_status is intentionally never included here — the
// "Users can update own profile" RLS policy's WITH CHECK clause requires
// it to stay unchanged, so omitting it from the update payload satisfies
// that constraint automatically.
//
// role IS included as of Stage 8C's listing-creation role gate: users may
// now self-select among the five non-moderator roles (buyer,
// miner_supplier, professional, company, mineral_agent). Attempting to set
// role to "moderator" is still rejected — independently enforced by the
// same RLS policy's WITH CHECK clause, regardless of what a client sends.
export async function updateProfile(id, updates) {
  const { name, company, bio, contact, location, role } = updates;
  return supabase
    .from("profiles")
    .update({ name, company, bio, contact, location, role })
    .eq("id", id)
    .select()
    .single();
}
// Dedicated read for EditProfileModal only. Wraps get_own_contact(),
// which takes no parameters and is hardcoded server-side to auth.uid() —
// this can never be used to fetch anyone else's contact value, by
// construction, not just by convention.
export async function getOwnContact() {
  return supabase.rpc("get_own_contact");
}
