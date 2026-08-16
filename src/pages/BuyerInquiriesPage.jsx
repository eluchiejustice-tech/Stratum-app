// BuyerInquiriesPage.jsx
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Inbox } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { getBuyerInquiries, updateBuyerInterestStatus } from "../services/buyerInterest";
import { getListingsByIds } from "../services/listings";
import { getProfilesByIds } from "../services/profiles";

// Buyer-side half of the state machine, confirmed directly against the
// deployed update_buyer_interest_status RPC (not inferred): a buyer may
// only ever move an interest to 'withdrawn', and only from 'new',
// 'contacted', or 'negotiating'. Every other transition (accept, decline,
// contacted, negotiating, closed) is seller-only and enforced there —
// see SellerInquiriesPage.jsx's SELLER_STATUS_TRANSITIONS, which this
// intentionally does not duplicate or mirror beyond shared labels/colors.
const BUYER_STATUS_TRANSITIONS = {
  new: ["withdrawn"],
  contacted: ["withdrawn"],
  negotiating: ["withdrawn"],
  accepted: [],
  declined: [],
  closed: [],
  withdrawn: [],
};

const STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

const TRANSITION_LABELS = {
  withdrawn: "Withdraw inquiry",
};

const STATUS_COLORS = {
  new: "bg-[#3D4148]/10 text-[#3D4148]/80",
  contacted: "bg-[#9c7a1f]/10 text-[#9c7a1f]",
  negotiating: "bg-[#9c7a1f]/10 text-[#9c7a1f]",
  accepted: "bg-[#1F4D3D]/10 text-[#1F4D3D]",
  declined: "bg-[#8a3b3b]/10 text-[#8a3b3b]",
  closed: "bg-[#3D4148]/10 text-[#3D4148]/60",
  withdrawn: "bg-[#3D4148]/10 text-[#3D4148]/60",
};

function formatDate(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BuyerInquiriesPage({ onBack, onListingClick }) {
  const { user } = useAuthContext();

  const [inquiries, setInquiries] = useState([]);
  const [listingsById, setListingsById] = useState({});
  const [sellersById, setSellersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [updatingId, setUpdatingId] = useState(null);
  const [rowError, setRowError] = useState({});

  const loadInquiries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: rows, error: fetchError } = await getBuyerInquiries(user.id);

    if (fetchError) {
      console.error("Failed to load buyer inquiries", fetchError);
      setError(true);
      setLoading(false);
      return;
    }

    const inquiryRows = rows || [];
    setInquiries(inquiryRows);

    const listingIds = [...new Set(inquiryRows.map((r) => r.listing_id))];
    // Buyer-facing correction: resolve the SELLER's profile per row, not
    // the buyer's own — the buyer already knows who they are; what they
    // need to see is who they're talking to.
    const sellerIds = [...new Set(inquiryRows.map((r) => r.seller_id))];

    const [listingsRes, sellersRes] = await Promise.all([
      listingIds.length > 0 ? getListingsByIds(listingIds) : Promise.resolve({ data: [], error: null }),
      sellerIds.length > 0 ? getProfilesByIds(sellerIds) : Promise.resolve({ data: [], error: null }),
    ]);

    if (listingsRes.error) {
      console.error("Failed to load listings for inquiries", listingsRes.error);
    } else {
      setListingsById(Object.fromEntries((listingsRes.data || []).map((l) => [l.id, l])));
    }

    if (sellersRes.error) {
      console.error("Failed to load seller profiles for inquiries", sellersRes.error);
    } else {
      setSellersById(Object.fromEntries((sellersRes.data || []).map((p) => [p.id, p])));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const handleStatusChange = async (interestId, newStatus) => {
    if (updatingId) return;
    setUpdatingId(interestId);
    setRowError((prev) => ({ ...prev, [interestId]: null }));

    const { data, error: updateError } = await updateBuyerInterestStatus(interestId, newStatus);

    if (updateError) {
      console.error("Failed to update inquiry status", updateError);
      setRowError((prev) => ({ ...prev, [interestId]: "Couldn't update this inquiry. Please try again." }));
      setUpdatingId(null);
      return;
    }

    setInquiries((prev) =>
      prev.map((row) => (row.id === interestId ? { ...row, status: data.status, updated_at: data.updated_at } : row))
    );
    setUpdatingId(null);
  };

  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/70 hover:text-[#15130F] transition mb-6"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <ArrowLeft size={14} /> Back to marketplace
        </button>

        <h1 className="font-serif text-2xl mb-6 flex items-center gap-2">
          <Inbox size={20} /> Your inquiries
        </h1>

        {loading && (
          <div className="text-center py-12 text-[#3D4148]/60">Loading inquiries…</div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-[#8a3b3b]">
            Couldn't load your inquiries. Please try again.
          </div>
        )}

        {!loading && !error && inquiries.length === 0 && (
          <div
            className="text-center py-12 text-[#3D4148]/60"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            No inquiries yet.
          </div>
        )}

        {!loading && !error && inquiries.length > 0 && (
          <div className="space-y-3">
            {inquiries.map((inquiry) => {
              const listing = listingsById[inquiry.listing_id];
              const seller = sellersById[inquiry.seller_id];
              const nextStates = BUYER_STATUS_TRANSITIONS[inquiry.status] || [];

              return (
                <div
                  key={inquiry.id}
                  className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <button
                      onClick={() => onListingClick(inquiry.listing_id)}
                      className="font-serif text-lg text-left hover:text-[#1F4D3D] hover:underline transition"
                    >
                      {listing?.mineral || "Listing"}
                    </button>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded ${
                        STATUS_COLORS[inquiry.status] || STATUS_COLORS.new
                      }`}
                      style={{ fontFamily: "system-ui, sans-serif" }}
                    >
                      {STATUS_LABELS[inquiry.status] || inquiry.status}
                    </span>
                  </div>

                  <div
                    className="text-xs text-[#3D4148]/70 mb-3"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    To {seller?.company || seller?.name || "A seller"} · {formatDate(inquiry.created_at)}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-3">
                    {inquiry.requested_quantity && (
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-0.5">
                          Requested quantity
                        </div>
                        <div className="font-mono">{inquiry.requested_quantity}</div>
                      </div>
                    )}
                    {inquiry.offer_price && (
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-0.5">
                          Offer
                        </div>
                        <div className="font-mono text-[#1F4D3D]">{inquiry.offer_price}</div>
                      </div>
                    )}
                  </div>

                  {inquiry.buyer_message && (
                    <p
                      className="text-sm text-[#3D4148] leading-relaxed mb-3"
                      style={{ fontFamily: "system-ui, sans-serif" }}
                    >
                      {inquiry.buyer_message}
                    </p>
                  )}

                  {rowError[inquiry.id] && (
                    <p className="text-xs text-[#8a3b3b] mb-2">{rowError[inquiry.id]}</p>
                  )}

                  {nextStates.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {nextStates.map((nextState) => (
                        <button
                          key={nextState}
                          onClick={() => handleStatusChange(inquiry.id, nextState)}
                          disabled={updatingId === inquiry.id}
                          className="bg-[#3D4148] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {TRANSITION_LABELS[nextState] || nextState}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
