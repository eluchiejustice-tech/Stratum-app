import { useState } from "react";
import { X } from "lucide-react";

const MIN_REASON_LENGTH = 10;

// Deliberate moderation step, not a quick action: a moderator must open
// this modal, write actionable feedback, and confirm before a listing is
// rejected. Reason is mandatory (min length, trimmed) so every rejection
// gives the seller something concrete to act on.
export default function RejectListingModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN_REASON_LENGTH;

  const handleConfirm = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await onConfirm(trimmed);
    if (error) {
      setSubmitError("Couldn't reject this listing. Please try again.");
      setSubmitting(false);
      return;
    }
    // Parent closes the modal on success via onConfirm's caller.
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-serif text-lg">Reject listing</h2>
          <button
            onClick={onClose}
            className="text-[#3D4148]/50 hover:text-[#15130F] transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p
          className="text-xs text-[#3D4148]/70 mb-3"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          Explain what needs to change. This is shown to the seller so they can
          correct and resubmit.
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Assay report is missing a lab certification number."
          className="w-full border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-1"
        />

        <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/40 mb-3">
          {trimmed.length}/{MIN_REASON_LENGTH} characters minimum
        </div>

        {submitError && (
          <div className="text-xs text-[#8a3b3b] mb-3">{submitError}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-xs font-mono uppercase tracking-wide px-3 py-2 rounded text-[#3D4148]/70 hover:text-[#15130F] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || submitting}
            className="bg-[#8a3b3b] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Rejecting…" : "Confirm rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}
