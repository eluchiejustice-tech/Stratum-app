import { supabase } from "./supabaseClient";

export async function getFavouriteSellers(userId) {
  return supabase.from("favourite_sellers").select("*").eq("user_id", userId);
}

export async function favouriteSeller(userId, sellerId) {
  return supabase
    .from("favourite_sellers")
    .insert({ user_id: userId, seller_id: sellerId });
}

export async function unfavouriteSeller(userId, sellerId) {
  return supabase
    .from("favourite_sellers")
    .delete()
    .eq("user_id", userId)
    .eq("seller_id", sellerId);
}
