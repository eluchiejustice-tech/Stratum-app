import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, FileText, X, ChevronLeft, ChevronRight } from "lucide-react";
import CoreSample from "../components/CoreSample";
import VerifiedBadge from "../components/VerifiedBadge";
import { contactHref } from "../utils/contactHref";
import { mapListingRow } from "../utils/mapListingRow";
import {
  getListingById,
  getPhotosByListing,
  updateListingStatus,
  createVerificationRecord,
} from "../services/listings";
import { useAuthContext } from "../context/AuthContext";

export default function ListingDetailPage({ listingId, onBack, onSellerClick }) {
  const { user, role } = useAuthContext();
  const isAdmin = role === "moderator";

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(null);

  const loadListing = useCallback(async () => {
    if (!listingId) return;

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getListingById(listingId);

    if (fetchError) {
      console.error("Failed to load listing", fetchError);
      setError(true);
      setLoading(false);
      return;
    }

    setListing(mapListingRow(data));

    const { data: photoRows, error: photosError } = await getPhotosByListing(listingId);
    if (photosError) {
      console.error("Failed to load listing photos", photosError);
      setPhotos([]);
    } else {
      setPhotos(photoRows || []);
    }
    setActiveIndex(0);

    setLoading(false);
  }, [listingId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await loadListing();
      if (cancelled) return;
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [loadListing]);

  const verifyListing = async () => {
    const { error: updateError } = await updateListingStatus(listing.id, "verified");
    if (!updateError) {
      await createVerificationRecord({
        verification_type: "listing",
        reference_id: listing.id,
        verified_by: user.id,
        status: "verified",
        notes: null,
      });
    }
    await loadListing();
  };

  const rejectListing = async () => {
    const { error: updateError } = await updateListingStatus(listing.id, "rejected");
    if (!updateError) {
      await createVerificationRecord({
        verification_type: "listing",
        reference_id: listing.id,
        verified_by: user.id,
        status: "rejected",
        notes: null,
      });
    }
    await loadListing();
  };

  const canOpenSellerProfile = Boolean(onSellerClick && listing?.sellerId);

  // Prefer the real gallery; fall back to the legacy single photo_url for
  // listings created before the listing_photos table existed.
  const galleryUrls =
    photos.length > 0
      ? photos.map((p) => p.photo_url)
      : listing?.photoUrl
      ? [listing.photoUrl]
      : [];

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 40;
    if (deltaX > threshold) {
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (deltaX < -threshold) {
      setActiveIndex((i) => Math.min(galleryUrls.length - 1, i + 1));
    }
    touchStartX.current = null;
  };

  const showPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const showNext = () => setActiveIndex((i) => Math.min(galleryUrls.length - 1, i + 1));

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
              <div className="shrink-0 w-full sm:w-56">
                {galleryUrls.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      className="block w-full"
                    >
                      <img
                        src={galleryUrls[activeIndex]}
                        alt={`${listing.mineral} photo ${activeIndex + 1}`}
                        className="w-full sm:w-56 h-56 object-cover rounded-lg border border-[#3D4148]/10"
                      />
                    </button>

                    {galleryUrls.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {galleryUrls.map((url, idx) => (
                          <button
                            key={`${url}-${idx}`}
                            type="button"
                            onClick={() => setActiveIndex(idx)}
                            className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition ${
                              idx === activeIndex
                                ? "border-[#1F4D3D]"
                                : "border-transparent opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Thumbnail ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
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
                    onClick={verifyListing}
                    className="bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                  >
                    Approve
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={rejectListing}
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

      {lightboxOpen && galleryUrls.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Close"
          >
            <X size={28} />
          </button>

          {galleryUrls.length > 1 && (
            <div className="absolute top-4 left-4 text-white/70 text-sm font-mono">
              {activeIndex + 1} / {galleryUrls.length}
            </div>
          )}

          {galleryUrls.length > 1 && activeIndex > 0 && (
            <button
              type="button"
              onClick={showPrev}
              className="absolute left-2 sm:left-6 text-white/80 hover:text-white p-2"
              aria-label="Previous photo"
            >
              <ChevronLeft size={36} />
            </button>
          )}

          <img
            src={galleryUrls[activeIndex]}
            alt={`${listing?.mineral || "Listing"} photo ${activeIndex + 1}`}
            className="max-w-[92vw] max-h-[80vh] object-contain"
          />

          {galleryUrls.length > 1 && activeIndex < galleryUrls.length - 1 && (
            <button
              type="button"
              onClick={showNext}
              className="absolute right-2 sm:right-6 text-white/80 hover:text-white p-2"
              aria-label="Next photo"
            >
              <ChevronRight size={36} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
