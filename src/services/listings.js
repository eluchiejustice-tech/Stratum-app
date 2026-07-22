import { supabase } from "./supabaseClient";

const LISTING_COLUMNS =
  "id, seller_id, mineral, category, description, quantity, mineral_grade, " +
  "country, state, location, availability, price, photo_url, status, " +
  "created_at, seller_name, seller_contact, seller_company, " +
  "local_government_area, document_url";

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
