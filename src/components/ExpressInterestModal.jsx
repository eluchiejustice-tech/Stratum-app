import { useState } from "react";
import { X } from "lucide-react";
import { createBuyerInterest } from "../services/buyerInterest";

// Known, intentional business-rule messages raised by create_buyer_interest
// (see services/buyerInterest.js / the RPC itself). Only these exact
// messages are ever shown to the user — anything else (network failures,
// unexpected/technical errors) falls back to the generic message below,
// so we never risk exposing a raw Postgres/technical error string.
const KNOWN_INTEREST_ERRORS = {
  "You already have an active inquiry for this listing": "You already have an active inquiry for this listing.",
  "You cannot express interest in your own listing": "You cannot express interest in your own listing.",
  "Listing is not currently active": "Listing is not currently active.",
  "Listing not found": "Listing not found.",
  "Authentication required": "Authentication required.",
};

const GENERIC_INTEREST_ERROR = "Couldn't send your interest. Please try again.";

// listingId: the listing this interest is being expressed on.
// buyer_id/seller_id are never supplied from here — createBuyerInterest
// wraps the create_buyer_interest RPC, which derives both server-side.
export default function ExpressInterestModal({ listingId, onClose, onSubmitted }) {
  const [requestedQuantity, setRequestedQuantity] = useState("");
  const [buyerMessage, setBuyerMessage] = useState("");
  const [offerPrice, setOfferPrice] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleSubmit = async () => {
    // Guards against a double click/tap firing a second request while the
    // first is still in flight, in addition to the button's own
    // disabled={submitting} state.
    if (submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    const { error } = await createBuyerInterest(listingId, {
      requestedQuantity: requestedQuantity.trim() || null,
      buyerMessage: buyerMessage.trim() || null,
      offerPrice: offerPrice.trim() || null,
    });

    if (error) {
      console.error("Failed to submit buyer interest", error);
      setSubmitError(KNOWN_INTEREST_ERRORS[error.message] || GENERIC_INTEREST_ERROR);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#EDE8DC] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-[#15130F]">Express interest</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Requested quantity (optional)
            </label>
            <input
              value={requestedQuantity}
              onChange={(e) => setRequestedQuantity(e.target.value)}
              placeholder="e.g. 10 tonnes"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Message to seller (optional)
            </label>
            <textarea
              value={buyerMessage}
              onChange={(e) => setBuyerMessage(e.target.value)}
              rows={4}
              placeholder="Let the seller know what you're looking for…"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Your offer (optional)
            </label>
            <input
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder="e.g. $1,100/tonne or Negotiable"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-[#8a3b3b] mt-3">{submitError}</p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 border border-[#3D4148]/20 text-[#3D4148] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148]/5 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send interest"}
          </button>
        </div>
      </div>
    </div>
  );
}
