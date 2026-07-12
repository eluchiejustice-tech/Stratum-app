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
