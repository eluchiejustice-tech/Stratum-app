import { supabase } from "./supabaseClient";

export async function getListings() {
  return supabase
    .from("mineral_listings")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function getListingById(id) {
  return supabase.from("mineral_listings").select("*").eq("id", id).single();
}

export async function createListing(listing) {
  return supabase.from("mineral_listings").insert(listing).select().single();
}

export async function updateListingStatus(id, status) {
  return supabase.from("mineral_listings").update({ status }).eq("id", id);
}

export async function createVerificationRecord(record) {
  return supabase.from("verification_records").insert(record);
}
