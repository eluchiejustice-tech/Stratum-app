// components/MessageThread.jsx
import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { getInterestMessages, sendInterestMessage } from "../services/interestMessages";
import { useAuthContext } from "../context/AuthContext";

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  }) + " · " + date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Shared conversation thread attached to a single buyer_interest. Used
// identically by SellerInquiriesPage.jsx and BuyerInquiriesPage.jsx —
// this component has no seller/buyer-specific branching; "own message"
// vs "their message" is determined purely by comparing sender_id to the
// current authenticated user, which works the same regardless of which
// side of the interest the viewer is on.
//
// V1 scope, deliberately: no realtime, no attachments, no notifications,
// no edit/delete. Sending re-fetches the full thread rather than
// optimistically appending, keeping this component simple and always
// consistent with what the database actually holds.
export default function MessageThread({ interestId }) {
  const { user } = useAuthContext();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const loadMessages = useCallback(async () => {
    if (!interestId) return;
    setLoading(true);
    setLoadError(null);

    const { data, error } = await getInterestMessages(interestId);

    if (error) {
      console.error("Failed to load interest messages", error);
      setLoadError(true);
      setLoading(false);
      return;
    }

    setMessages(data || []);
    setLoading(false);
  }, [interestId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    // UI-level guard against empty/whitespace submissions — the service
    // layer and the database NOT NULL constraint both also enforce this
    // independently; this is purely to avoid a pointless round trip.
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError(null);

    const { error } = await sendInterestMessage(interestId, trimmed);

    if (error) {
      console.error("Failed to send message", error);
      setSendError("Couldn't send your message. Please try again.");
      setSending(false);
      return;
    }

    setDraft("");
    setSending(false);
    await loadMessages();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[#3D4148]/10 mt-3 pt-3">
      <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-2">
        Conversation
      </div>

      {loading && (
        <div className="text-center py-4 text-[#3D4148]/60 text-xs">
          Loading conversation…
        </div>
      )}

      {!loading && loadError && (
        <div className="text-center py-4 text-[#8a3b3b] text-xs">
          Couldn't load this conversation. Please try again.
        </div>
      )}

      {!loading && !loadError && messages.length === 0 && (
        <div
          className="text-center py-4 text-[#3D4148]/50 text-xs"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          No messages yet. Send the first one below.
        </div>
      )}

      {!loading && !loadError && messages.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto mb-3 pr-1">
          {messages.map((m) => {
            const isOwn = user && m.sender_id === user.id;
            return (
              <div
                key={m.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    isOwn
                      ? "bg-[#15130F] text-[#EDE8DC]"
                      : "bg-[#3D4148]/10 text-[#15130F]"
                  }`}
                >
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {m.message}
                  </p>
                  <div
                    className={`text-[10px] mt-1 ${
                      isOwn ? "text-[#EDE8DC]/50" : "text-[#3D4148]/50"
                    }`}
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {formatTimestamp(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sendError && (
        <p className="text-xs text-[#8a3b3b] mb-2">{sendError}</p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Write a message…"
          disabled={sending}
          className="flex-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm resize-none disabled:opacity-50"
          style={{ fontFamily: "system-ui, sans-serif" }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="flex items-center gap-1.5 bg-[#B8922F] text-[#15130F] font-mono text-xs uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={14} strokeWidth={2.5} />
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
