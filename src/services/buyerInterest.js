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
