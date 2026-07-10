import { supabase } from "./supabaseClient";

// Not yet wired into any UI. Used once an inquiry/messaging screen is
// built (Marketplace MVP phase, after this backend-connection phase).

export async function sendMessage({ senderId, receiverId, listingId, message }) {
  return supabase
    .from("messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, listing_id: listingId, message })
    .select()
    .single();
}

export async function getConversation(userId, otherUserId) {
  return supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order("created_at", { ascending: true });
}
