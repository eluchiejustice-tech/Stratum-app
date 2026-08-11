import { supabase } from "./supabaseClient";

const FINGERPRINT_KEY = "stratum_visitor_fingerprint";

function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateFingerprint() {
  try {
    let fingerprint = window.localStorage.getItem(FINGERPRINT_KEY);
    if (!fingerprint) {
      fingerprint = generateUuid();
      window.localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    }
    return fingerprint;
  } catch (err) {
    // localStorage unavailable (private browsing, disabled, etc.) — fail gracefully
    return null;
  }
}

export async function logListingView(listingId) {
  if (!listingId) return;
  try {
    const fingerprint = getOrCreateFingerprint();
    const { error } = await supabase.rpc("log_listing_view", {
      p_listing_id: listingId,
      p_viewer_fingerprint: fingerprint,
    });
    if (error) console.error("Failed to log listing view", error);
  } catch (err) {
    console.error("Failed to log listing view", err);
  }
}

export async function logContactSellerClick(listingId, contactMethod) {
  if (!listingId || !contactMethod) return;
  try {
    const { error } = await supabase.rpc("log_contact_seller_click", {
      p_listing_id: listingId,
      p_contact_method: contactMethod,
    });
    if (error) console.error("Failed to log contact click", error);
  } catch (err) {
    console.error("Failed to log contact click", err);
  }
}

// ---- Buyer Interest & Deal Workflow ----
// Unlike the two analytics functions above (fire-and-forget, errors only
// logged), these are user-facing actions — callers need to know whether
// they succeeded, so they follow the { data, error } convention used
// throughout listings.js instead. buyer_id/seller_id are never sent from
// here: both create_buyer_interest and update_buyer_interest_status
// derive them server-side, matching the DB-level authorization design.

export async function createBuyerInterest(listingId, { requestedQuantity, buyerMessage, offerPrice } = {}) {
  return supabase.rpc("create_buyer_interest", {
    p_listing_id: listingId,
    p_requested_quantity: requestedQuantity ?? null,
    p_buyer_message: buyerMessage ?? null,
    p_offer_price: offerPrice ?? null,
  });
}

export async function updateBuyerInterestStatus(interestId, newStatus) {
  return supabase.rpc("update_buyer_interest_status", {
    p_interest_id: interestId,
    p_new_status: newStatus,
  });
}

export async function getSellerInquiries(sellerId) {
  return supabase
    .from("buyer_interests")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
}

export async function getBuyerInquiries(buyerId) {
  return supabase
    .from("buyer_interests")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
}
