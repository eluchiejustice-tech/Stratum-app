import { supabase } from "./supabaseClient";

// ---- Phase 7A: Marketplace Information ----
export async function getMarketplaceInformation() {
  const { data, error } = await supabase.rpc("get_marketplace_information");
  return { data: data?.[0] ?? null, error };
}

// ---- Phase 7B: Marketplace Insight ----
export async function getTopMinerals(limit = 5) {
  return supabase.rpc("get_top_minerals", { p_limit: limit });
}

export async function getTopStates(limit = 5) {
  return supabase.rpc("get_top_states", { p_limit: limit });
}

export async function getMarketplaceActivity(limit = 10) {
  return supabase.rpc("get_marketplace_activity", { p_limit: limit });
}

// ---- Phase 7C: Marketplace Health ----
export async function getMarketplaceHealth() {
  const { data, error } = await supabase.rpc("get_marketplace_health");
  return { data: data?.[0] ?? null, error };
}
