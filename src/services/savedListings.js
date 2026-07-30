import { supabase } from "./supabaseClient";

export async function getSavedListings(userId) {
  return supabase.from("saved_listings").select("*").eq("user_id", userId);
}

export async function saveListing(userId, listingId) {
  return supabase
    .from("saved_listings")
    .insert({ user_id: userId, listing_id: listingId });
}

export async function unsaveListing(userId, listingId) {
  return supabase
    .from("saved_listings")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId);
}
