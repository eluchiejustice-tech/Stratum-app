import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Inbox } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { getBuyerInquiries, updateBuyerInterestStatus } from "../services/buyerInterest";
import { getListingsByIds } from "../services/listings";
import { getProfilesByIds } from "../services/profiles";

// Buyer's only permitted transition is withdrawing — to 'declined', and
// only while the inquiry hasn't already reached a terminal/accepted
// state. Matches the buyer half of update_buyer_interest_status exactly.
const WITHDRAWABLE_STATUSES = ["new", "contacted", "negotiating"];

const STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
  closed: "Closed",
  withdrawn: "Withdrawn",
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

export default function BuyerInquiriesPage({ onBack, onListingClick, onSellerClick }) {
  const { user } = useAuthContext();

  const [inquiries, setInquiries] = useState([]);
  const [listingsById, setListingsById] = useState({});
  const [sellersById, setSellersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [withdrawingId, setWithdrawingId] = useState(null);
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

  const handleWithdraw = async (interestId) => {
    if (withdrawingId) return;
    setWithdrawingId(interestId);
    setRowError((prev) => ({ ...prev, [interestId]: null }));

    const { data, error: updateError } = await updateBuyerInterestStatus(interestId, "withdrawn");

    if (updateError) {
      console.error("Failed to withdraw inquiry", updateError);
      setRowError((prev) => ({ ...prev, [interestId]: "Couldn't withdraw this inquiry. Please try again." }));
      setWithdrawingId(null);
      return;
    }

    setInquiries((prev) =>
      prev.map((row) => (row.id === interestId ? { ...row, status: data.status, updated_at: data.updated_at } : row))
    );
    setWithdrawingId(null);
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
          <Inbox size={20} /> My inquiries
        </h1>

        {loading && (
          <div className="text-center py-12 text-[#3D4148]/60">Loading your inquiries…</div>
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
            You haven't expressed interest in any listings yet.
          </div>
        )}

        {!loading && !error && inquiries.length > 0 && (
          <div className="space-y-3">
            {inquiries.map((inquiry) => {
              const listing = listingsById[inquiry.listing_id];
              const seller = sellersById[inquiry.seller_id];
              const canWithdraw = WITHDRAWABLE_STATUSES.includes(inquiry.status);

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
                    To{" "}
                    {seller ? (
                      <button
                        onClick={() => onSellerClick(inquiry.seller_id)}
                        className="hover:text-[#1F4D3D] hover:underline transition"
                      >
                        {seller.company || seller.name || "seller"}
                      </button>
                    ) : (
                      "seller"
                    )}{" "}
                    · {formatDate(inquiry.created_at)}
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
                          Your offer
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

                  {canWithdraw && (
                    <button
                      onClick={() => handleWithdraw(inquiry.id)}
                      disabled={withdrawingId === inquiry.id}
                      className="border border-[#8a3b3b]/30 text-[#8a3b3b] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:bg-[#8a3b3b]/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {withdrawingId === inquiry.id ? "Withdrawing…" : "Withdraw"}
                    </button>
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
