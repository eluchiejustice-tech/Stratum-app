// services/interestMessages.js
import { supabase } from "./supabaseClient";

// Deal Communication V1 — messaging scoped to a single buyer_interest.
// Deliberately its own file, not folded into buyerInterest.js: keeps the
// interest lifecycle (status transitions) separate from the conversation
// attached to it, matching this project's one-file-per-capability pattern
// (assays.js is separate from listings.js despite assays living under a
// listing, for the same reason).

// Retrieves the full message thread for one interest, oldest first —
// chat-reading order, not the "recent activity" descending order used by
// getAssayVerificationHistory. Authorization is enforced entirely by the
// interest_messages SELECT RLS policy (participant-only); this function
// applies no additional filtering itself.
export async function getInterestMessages(interestId) {
  return supabase
    .from("interest_messages")
    .select("id, interest_id, sender_id, message, created_at")
    .eq("interest_id", interestId)
    .order("created_at", { ascending: true });
}

// Sends a message on behalf of the current authenticated user.
//
// Deliberately takes only (interestId, message) — no senderId parameter.
// Unlike the rest of this project's services, which receive an identity
// value already resolved by the calling component (see createAssay's
// submittedBy), this function resolves the sender itself via
// supabase.auth.getUser(). That's necessary here because this is a plain
// table INSERT rather than a SECURITY DEFINER RPC: sender_id is a NOT
// NULL column that must be present in the payload for the
// interest_messages INSERT policy's sender_id = auth.uid() check to
// evaluate at all. This is the one place in the service layer that reads
// auth state directly — a deliberate, scoped exception, not a new
// pattern for other files to imitate.
//
// message is trimmed and rejected client-side if empty, as a fast-fail
// convenience — the database's NOT NULL constraint on interest_messages.
// message remains the actual, final guarantee regardless of what this
// function does.
export async function sendInterestMessage(interestId, message) {
  const trimmed = (message || "").trim();

  if (!trimmed) {
    return { data: null, error: { message: "Message cannot be empty" } };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { data: null, error: userError || { message: "Authentication required" } };
  }

  return supabase
    .from("interest_messages")
    .insert({
      interest_id: interestId,
      sender_id: user.id,
      message: trimmed,
    })
    .select()
    .single();
}
