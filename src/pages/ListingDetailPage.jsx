import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, FileText } from "lucide-react";
import CoreSample from "../components/CoreSample";
import VerifiedBadge from "../components/VerifiedBadge";
import { contactHref } from "../utils/contactHref";
import { mapListingRow } from "../utils/mapListingRow";
import { getListingById } from "../services/listings";

export default function ListingDetailPage({
  listingId,
  isAdmin,
  onBack,
  onVerify,
  onReject,
  onSellerClick,
}) {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await getListingById(listingId);

      if (cancelled) return;

      if (fetchError) {
        console.error("Failed to load listing", fetchError);
        setError(true);
        setLoading(false);
        return;
      }

      setListing(mapListingRow(data));
      setLoading(false);
    }

    if (listingId) load();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const canOpenSellerProfile = Boolean(onSellerClick && listing?.sellerId);

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

        {loading && (
          <div className="text-center py-12 text-[#3D4148]/60">Loading listing…</div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-[#8a3b3b]">
            Couldn't load this listing. Please try again.
          </div>
        )}

        {!loading && !error && !listing && (
          <div className="text-center py-12 text-[#3D4148]/60">
            This listing could not be found.
          </div>
        )}

        {!loading && !error && listing && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-[#3D4148]/10">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <div className="font-serif text-2xl leading-tight">{listing.mineral}</div>
              </div>
              <VerifiedBadge verified={listing.verified} />
            </div>

            <div className="flex gap-5 flex-wrap sm:flex-nowrap">
              <div className="shrink-0">
                {listing.photoUrl ? (
                  <a href={listing.photoUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={listing.photoUrl}
                      alt={listing.mineral}
                      className="w-full sm:w-56 h-56 object-cover rounded-lg border border-[#3D4148]/10"
                    />
                  </a>
                ) : (
                  <div className="w-full sm:w-56 h-56 flex items-center justify-center">
                    <CoreSample bands={listing.strata} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <div
                    className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1"
                  >
                    Grade / specification
                  </div>
                  <p
                    className="text-sm text-[#3D4148] leading-relaxed"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {listing.grade}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                      Quantity
                    </div>
                    <div className="text-sm font-mono">{listing.quantity}</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                      Location
                    </div>
                    <div className="text-sm flex items-center gap-1">
                      <MapPin size={12} /> {listing.location}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                      Price
                    </div>
                    <div className="text-sm font-mono text-[#1F4D3D]">{listing.price}</div>
                  </div>
                </div>

                {listing.documentUrl && (
                  <a
                    href={listing.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-[#1F4D3D] underline w-fit"
                  >
                    <FileText size={14} /> Assay report / certificate
                  </a>
                )}
              </div>
            </div>

            <div className="border-t border-[#3D4148]/10 mt-5 pt-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                  Seller
                </div>
                {canOpenSellerProfile ? (
                  <button
                    onClick={() => onSellerClick(listing.sellerId)}
                    className="text-sm font-mono uppercase tracking-wide text-[#3D4148] hover:text-[#1F4D3D] hover:underline transition text-left"
                  >
                    {listing.company || listing.seller}
                  </button>
                ) : (
                  <div className="text-sm font-mono uppercase tracking-wide text-[#3D4148]">
                    {listing.company || listing.seller}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && !listing.verified && (
                  <button
                    onClick={() => onVerify(listing.id)}
                    className="bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                  >
                    Approve
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => onReject(listing.id)}
                    className="bg-[#8a3b3b] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                  >
                    Remove
                  </button>
                )}
                {contactHref(listing.contact) ? (
                  <a
                    href={contactHref(listing.contact)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                  >
                    <MessageCircle size={13} /> Contact
                  </a>
                ) : (
                  <span className="text-xs text-[#3D4148]/50 font-mono px-3 py-2">
                    No contact info
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
