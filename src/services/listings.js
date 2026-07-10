import { supabase } from "./supabaseClient";

// Not yet wired into the UI. Built out fully in Stage 4, replacing
// SEED_LISTINGS + localStorage in pages/MarketplacePage.jsx.

export async function getListings() {
  return supabase
    .from("mineral_listings")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function createListing(listing) {
  return supabase.from("mineral_listings").insert(listing).select().single();
}

export async function updateListingStatus(id, status) {
  return supabase.from("mineral_listings").update({ status }).eq("id", id);
}
