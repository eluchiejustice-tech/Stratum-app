import { supabase } from "./supabaseClient";

export async function getProfileById(id) {
  return supabase.from("profiles").select("*").eq("id", id).single();
}

export async function getApprovedListingsBySeller(sellerId) {
  return supabase
    .from("mineral_listings")
    .select("*")
    .eq("seller_id", sellerId)
    .eq("status", "verified");
}

// Updates only the self-editable fields on the caller's own profile row.
// role and verification_status are intentionally never included here —
// the "Users can update own profile" RLS policy's WITH CHECK clause
// requires those two columns to stay unchanged, so omitting them from
// the update payload satisfies that constraint automatically.
export async function updateProfile(id, updates) {
  const { name, company, bio, contact, location } = updates;
  return supabase
    .from("profiles")
    .update({ name, company, bio, contact, location })
    .eq("id", id)
    .select()
    .single();
}
