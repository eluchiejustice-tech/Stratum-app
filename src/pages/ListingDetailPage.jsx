import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, Phone, Mail, FileText, X, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import CoreSample from "../components/CoreSample";
import VerifiedBadge from "../components/VerifiedBadge";
import { getContactOptions } from "../utils/contactHref";
import { mapListingRow } from "../utils/mapListingRow";
import { supabase } from "../services/supabaseClient";
import {
  getListingById,
  getPhotosByListing,
  updateListingState,
  setListingVerificationStatus,
  LISTING_STATE_TRANSITIONS,
} from "../services/listings";
import { getProfileById, getApprovedListingsBySeller } from "../services/profiles";
import { useAuthContext } from "../context/AuthContext";

const CONTACT_ICONS = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
};

const LIFECYCLE_STATE_LABELS = {
  active: "Active",
  paused: "Paused",
  sold: "Sold",
  archived: "Archived",
};

const LIFECYCLE_TRANSITION_LABELS = {
  active: "Reactivate",
  paused: "Pause",
  sold: "Mark as sold",
  archived: "Archive",
};

// Fetches the listing's assay report/certificate reference from
// mineral_documents (RLS-governed: visible only to the owner, uploader,
// a moderator, or if verification_status is 'verified') and, if one
// exists and is visible to the current session, exchanges its storage
// path for a short-lived signed URL. Returns null if there's no
// document, or if RLS denies visibility — never throws, since "no
// document visible" is a normal, expected outcome, not an error.
async function getSignedDocumentUrl(listingId) {
  const { data: docs, error: docErr } = await supabase
    .from("mineral_documents")
    .select("file_url")
    .eq("listing_id", listingId)
    .eq("document_type", "assay_report")
    .limit(1);

  if (docErr || !docs || docs.length === 0) return null;

  const { data: signed, error: signErr } = await supabase.storage
    .from("listing-documents")
    .createSignedUrl(docs[0].file_url, 3600);

  if (signErr) {
    console.error("Failed to create signed document URL", signErr);
    return null;
  }

  return signed.signedUrl;
}

function formatDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

  const [sellerProfile, setSellerProfile] = useState(null);
  const [sellerListingCount, setSellerListingCount] = useState(null);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState(null);

  const [transitioning, setTransitioning] = useState(false);
  const [lifecycleError, setLifecycleError] = useState(null);

  const loadListing = useCallback(async () => {
    if (!listingId) return;

    setLoading(true);
    setError(null);
    setLifecycleError(null);

    const { data, error: fetchError } = await getListingById(listingId);

    if (fetchError) {
      console.error("Failed to load listing", fetchError);
      setError(true);
      setLoading(false);
      return;
    }

    const mapped = mapListingRow(data);
    setListing(mapped);

    const [photosRes, profileRes, listingsRes, documentUrl] = await Promise.all([
      getPhotosByListing(listingId),
      mapped.sellerId
        ? getProfileById(mapped.sellerId)
        : Promise.resolve({ data: null, error: null }),
      mapped.sellerId
        ? getApprovedListingsBySeller(mapped.sellerId)
        : Promise.resolve({ data: null, error: null }),
      getSignedDocumentUrl(listingId),
    ]);

    if (photosRes.error) {
      console.error("Failed to load listing photos", photosRes.error);
      setPhotos([]);
    } else {
      setPhotos(photosRes.data || []);
    }
    setActiveIndex(0);
    setSignedDocumentUrl(documentUrl);

    if (mapped.sellerId) {
      if (profileRes.error) {
        console.error("Failed to load seller profile", profileRes.error);
        setSellerProfile(null);
      } else {
        setSellerProfile(profileRes.data);
      }

      if (listingsRes.error) {
        console.error("Failed to load seller listing count", listingsRes.error);
        setSellerListingCount(null);
      } else {
        setSellerListingCount((listingsRes.data || []).length);
      }
    } else {
      setSellerProfile(null);
      setSellerListingCount(null);
    }

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
    const { error } = await setListingVerificationStatus(listing.id, "verified", user.id);
    if (error) {
      console.error("Failed to verify listing", error);
    }
    await loadListing();
  };

  const rejectListing = async () => {
    const { error } = await setListingVerificationStatus(listing.id, "rejected", user.id);
    if (error) {
      console.error("Failed to reject listing", error);
    }
    await loadListing();
  };

  // Seller-facing commercial lifecycle (active/paused/sold/archived) — kept
  // deliberately separate from verifyListing/rejectListing above, which
  // handle moderation status (pending/verified/rejected). Archive is
  // terminal, so it gets a confirmation prompt; other transitions apply
  // immediately.
  const handleLifecycleTransition = async (newState) => {
    if (transitioning) return;
if (newState === "archived") {
      const confirmed = window.confirm(
        "Archive this listing? This is permanent — archived listings cannot be reactivated."
      );
      if (!confirmed) return;
    }

    setTransitioning(true);
    setLifecycleError(null);

    const { data, error: transitionError } = await updateListingState(listing.id, newState);

    if (transitionError || !data) {
      setLifecycleError("Couldn't update the listing. Please refresh and try again.");
      setTransitioning(false);
      return;
    }

    await loadListing();
    setTransitioning(false);
  };

  const canOpenSellerProfile = Boolean(onSellerClick && listing?.sellerId);
  const contactOptions = user ? getContactOptions(listing?.contact) : [];
  const isOwner = Boolean(user && listing && user.id === listing.sellerId);
  const allowedNextStates = listing
    ? LISTING_STATE_TRANSITIONS[listing.listingState] || []
    : [];

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
  const showNext = () => setActiveIndex((i) => Math.min(galleryUrls.length - 1, i + 1));const postedDate = listing ? formatDate(listing.createdAt) : null;
  const sellerVerificationStatus = (sellerProfile?.verification_status || "unverified").toLowerCase();
  const sellerVerificationLabel = {
    verified: "Verified seller",
    pending: "Verification pending",
    rejected: "Verification rejected",
    unverified: "Unverified seller",
  }[sellerVerificationStatus] || "Unverified seller";

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
                    style={{ fontFamily: "sys
