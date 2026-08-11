import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, Phone, Mail, FileText, X, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import CoreSample from "../components/CoreSample";
import VerifiedBadge from "../components/VerifiedBadge";
import RejectListingModal from "../components/RejectListingModal";
import ListingHistory from "../components/ListingHistory";
import EditListingModal from "../components/EditListingModal";
import ExpressInterestModal from "../components/ExpressInterestModal";
import { getContactOptions } from "../utils/contactHref";
import { mapListingRow } from "../utils/mapListingRow";
import { supabase } from "../services/supabaseClient";
import {
  getListingById,
  getPhotosByListing,
  updateListingState,
  setListingVerificationStatus,
  getVerificationHistory,
  resubmitListing,
  createListingDocument,
  LISTING_STATE_TRANSITIONS,
} from "../services/listings";
import { getProfileById, getApprovedListingsBySeller } from "../services/profiles";
import { logListingView, logContactSellerClick } from "../services/buyerInterest";
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

async function getSignedDocumentUrl(listingId) {
  const { data: docs, error: docErr } = await supabase
    .from("mineral_documents")
    .select("file_url")
    .eq("listing_id", listingId)
    .eq("document_type", "assay_report")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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

  const [historyRecords, setHistoryRecords] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showExpressInterestModal, setShowExpressInterestModal] = useState(false);

  // Request-race guard: every call to loadListing() claims a new request id.
  // Before each state update in the async chain below, we confirm this
  // call's id is still the current one. If a newer call (a different
  // listingId, or a second call for the same listingId) has started in the
  // meantime, this call's remaining state updates are skipped entirely —
  // so a slow response for an older listing can never overwrite state that
  // belongs to whatever listing is currently being displayed.
  const requestIdRef = useRef(0);

  const loadListing = useCallback(async () => {
    if (!listingId) return;

    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestIdRef.current === requestId;

    setLoading(true);
    setError(null);
    setLifecycleError(null);

    const { data, error: fetchError } = await getListingById(listingId);

    if (!isCurrent()) return;

    if (fetchError) {
      console.error("Failed to load listing", fetchError);
      setError(true);
      setLoading(false);
      return;
    }

    const mapped = mapListingRow(data);
    setListing(mapped);

    // Buyer-interest instrumentation: fire-and-forget, never awaited, never
    // allowed to block or fail the page load. Uses the listingId this
    // specific request was made for, so it stays correctly associated with
    // the listing even if this request is later superseded.
    logListingView(listingId);

    const [photosRes, profileRes, listingsRes, documentUrl, historyRes] = await Promise.all([
      getPhotosByListing(listingId),
      mapped.sellerId
        ? getProfileById(mapped.sellerId)
        : Promise.resolve({ data: null, error: null }),
      mapped.sellerId
        ? getApprovedListingsBySeller(mapped.sellerId)
        : Promise.resolve({ data: null, error: null }),
      getSignedDocumentUrl(listingId),
      getVerificationHistory(listingId),
    ]);

    if (!isCurrent()) return;

    if (photosRes.error) {
      console.error("Failed to load listing photos", photosRes.error);
      setPhotos([]);
    } else {
      setPhotos(photosRes.data || []);
    }
    setActiveIndex(0);
    setSignedDocumentUrl(documentUrl);

    if (historyRes.error) {
      console.error("Failed to load verification history", historyRes.error);
      setHistoryRecords([]);
    } else {
      setHistoryRecords(historyRes.data || []);
    }

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
    loadListing();

    return () => {
      // Strengthened cancellation: invalidate any in-flight request when the
      // listingId changes or the component unmounts, by bumping the request
      // id past whatever the in-flight call captured. Its next isCurrent()
      // check will fail and it will discard its results instead of applying
      // them.
      requestIdRef.current += 1;
    };
  }, [loadListing]);

  const verifyListing = async () => {
    const { error } = await setListingVerificationStatus(listing.id, "verified", user.id);
    if (error) {
      console.error("Failed to verify listing", error);
    }
    await loadListing();
  };

  const openRejectModal = () => setShowRejectModal(true);
  const closeRejectModal = () => setShowRejectModal(false);

  const confirmReject = async (reason) => {
    const { error } = await setListingVerificationStatus(listing.id, "rejected", user.id, reason);
    if (!error) {
      setShowRejectModal(false);
      await loadListing();
    }
    return { error };
  };

  const handleReplaceDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    setDocUploadError(null);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from("listing-documents")
      .upload(fileName, file);

    if (uploadErr) {
      console.error("Document upload failed", uploadErr);
      setDocUploadError("Upload failed. Please try a PDF, JPG, or PNG under 10MB.");
      setUploadingDoc(false);
      return;
    }

    const { error: docError } = await createListingDocument(listing.id, fileName, user.id);

    if (docError) {
      console.error("Failed to attach replacement document", docError);
      setDocUploadError("Upload succeeded, but we couldn't attach it to your listing. Please try again.");
      setUploadingDoc(false);
      return;
    }

    await loadListing();
    setUploadingDoc(false);
  };

  const handleResubmit = async () => {
    if (resubmitting) return;
    setResubmitting(true);
    setResubmitError(null);

    const { error } = await resubmitListing(listing.id);

    if (error) {
      console.error("Failed to resubmit listing", error);
      setResubmitError("Couldn't resubmit this listing. Please try again.");
      setResubmitting(false);
      return;
    }

    await loadListing();
    setResubmitting(false);
  };

  const openEditModal = () => setShowEditModal(true);
  const closeEditModal = () => setShowEditModal(false);

  const handleEditSaved = async () => {
    setShowEditModal(false);
    await loadListing();
  };

  const openExpressInterestModal = () => setShowExpressInterestModal(true);
  const closeExpressInterestModal = () => setShowExpressInterestModal(false);

  const handleInterestSubmitted = async () => {
    setShowExpressInterestModal(false);
    await loadListing();
  };

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
  const canExpressInterest = Boolean(
    user && listing && !isOwner && listing.listingState === "active"
  );
  const canSeeHistory = isOwner || isAdmin;
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
  const showNext = () => setActiveIndex((i) => Math.min(galleryUrls.length - 1, i + 1));
  const postedDate = listing ? formatDate(listing.createdAt) : null;

  const sellerVerificationStatus = (
    sellerProfile?.verification_status || "unverified"
  ).toLowerCase();

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
          <div className="text-center py-12 text-[#3D4148]/60">
            Loading listing…
          </div>
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
                <div className="font-serif text-2xl leading-tight">
                  {listing.mineral}
                </div>
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
                  <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
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

                    <div className="text-sm font-mono">
                      {listing.quantity}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                      Location
                    </div>

                    <div className="text-sm flex items-center gap-1">
                      <MapPin size={12} />
                      {listing.location}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                      Price
                    </div>

                    <div className="text-sm font-mono text-[#1F4D3D]">
                      {listing.price}
                    </div>
                  </div>

                  {postedDate && (
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                        Posted
                      </div>

                      <div className="text-sm font-mono">
                        {postedDate}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                      Listing status
                    </div>

                    <div className="text-sm font-mono">
                      {listing.verified
                        ? "Verified"
                        : listing.statusRaw === "rejected"
                        ? "Rejected"
                        : "Pending review"}
                    </div>
                  </div>
                </div>

                {signedDocumentUrl && (
                  <a
                    href={signedDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-[#1F4D3D] underline w-fit"
                  >
                    <FileText size={14} />
                    Assay report / certificate
                  </a>
                )}
              </div>
            </div>

            <div className="border-t border-[#3D4148]/10 mt-5 pt-4">
              <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-2">
                Seller trust summary
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#3D4148]">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded ${
                    sellerVerificationStatus === "verified"
                      ? "bg-[#1F4D3D]/10 text-[#1F4D3D]"
                      : sellerVerificationStatus === "pending"
                      ? "bg-[#9c7a1f]/10 text-[#9c7a1f]"
                      : sellerVerificationStatus === "rejected"
                      ? "bg-[#8a3b3b]/10 text-[#8a3b3b]"
                      : "bg-[#3D4148]/10 text-[#3D4148]/70"
                  }`}
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  <ShieldCheck size={11} />
                  {sellerVerificationLabel}
                </span>

                {sellerProfile?.company && (
                  <span style={{ fontFamily: "system-ui, sans-serif" }}>
                    {sellerProfile.company}
                  </span>
                )}

                {sellerProfile?.location && (
                  <span
                    className="flex items-center gap-1"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    <MapPin size={11} />
                    {sellerProfile.location}
                  </span>
                )}

                {sellerListingCount !== null && (
                  <span style={{ fontFamily: "system-ui, sans-serif" }}>
                    {sellerListingCount} active listing
                    {sellerListingCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {isOwner && (
              <div className="border-t border-[#3D4148]/10 mt-4 pt-4">
                <button
                  onClick={openEditModal}
                  className="text-xs font-mono uppercase tracking-wide text-[#3D4148]/70 hover:text-[#15130F] underline transition mb-3"
                >
                  Edit listing details
                </button>

                <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-2">
                  Listing lifecycle
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#3D4148] mb-3">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded bg-[#3D4148]/10 text-[#3D4148]/80"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {LIFECYCLE_STATE_LABELS[listing.listingState] ||
                      listing.listingState}
                  </span>
                </div>

                {allowedNextStates.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {allowedNextStates.map((nextState) => (
                      <button
                        key={nextState}
                        onClick={() =>
                          handleLifecycleTransition(nextState)
                        }
                        disabled={transitioning}
                        className="bg-[#3D4148] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {LIFECYCLE_TRANSITION_LABELS[nextState] ||
                          nextState}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#3D4148]/50 font-mono">
                    This listing is archived and can no longer be changed.
                  </div>
                )}

                {lifecycleError && (
                  <div className="text-xs text-[#8a3b3b] font-mono mt-2">
                    {lifecycleError}
                  </div>
                )}
              </div>
            )}

            {canSeeHistory && (
              <ListingHistory records={historyRecords} />
            )}

            {isOwner && listing.statusRaw === "rejected" && (
              <div className="border-t border-[#3D4148]/10 mt-4 pt-4">
                <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-2">
                  Resubmit for review
                </div>

                <p
                  className="text-xs text-[#3D4148]/70 mb-3"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  Review the feedback above, make any needed corrections,
                  then resubmit this listing for moderator review.
                </p>

                <div className="mb-3">
                  <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
                    Replace assay report (optional)
                  </label>

                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleReplaceDocument}
                    disabled={uploadingDoc}
                    className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm disabled:opacity-50"
                  />

                  {uploadingDoc && (
                    <p className="text-[10px] text-[#3D4148]/60 mt-1">
                      Uploading document…
                    </p>
                  )}

                  {docUploadError && (
                    <p className="text-[10px] text-[#8a3b3b] mt-1">
                      {docUploadError}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleResubmit}
                  disabled={resubmitting}
                  className="bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resubmitting
                    ? "Resubmitting…"
                    : "Resubmit listing"}
                </button>

                {resubmitError && (
                  <div className="text-xs text-[#8a3b3b] font-mono mt-2">
                    {resubmitError}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-[#3D4148]/10 mt-4 pt-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 mb-1">
                  Seller
                </div>

                {canOpenSellerProfile ? (
                  <button
                    onClick={() =>
                      onSellerClick(listing.sellerId)
                    }
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

              <div className="flex items-center gap-2 flex-wrap justify-end">
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
                    onClick={openRejectModal}
                    className="bg-[#8a3b3b] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                  >
                    Reject
                  </button>
                )}

                {canExpressInterest && (
                  <button
                    onClick={openExpressInterestModal}
                    className="bg-[#3D4148] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                  >
                    Express interest
                  </button>
                )}

                {!user ? (
                  <span className="text-xs text-[#3D4148]/50 font-mono px-3 py-2">
                    Sign in to contact seller
                  </span>
                ) : contactOptions.length > 0 ? (
                  contactOptions.map((opt) => {
                    const Icon = CONTACT_ICONS[opt.type];

                    return (
                      <a
                        key={opt.type}
                        href={opt.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          logContactSellerClick(
                            listing.id,
                            opt.type
                          )
                        }
                        className="flex items-center gap-1.5 bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
                      >
                        <Icon size={13} />
                        {opt.label}
                      </a>
                    );
                  })
                ) : (
                  <span className="text-xs text-[#3D4148]/50 font-mono px-3 py-2">
                    No contact information available
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
            alt={`${listing?.mineral || "Listing"} photo ${
              activeIndex + 1
            }`}
            className="max-w-[92vw] max-h-[80vh] object-contain"
          />

          {galleryUrls.length > 1 &&
            activeIndex < galleryUrls.length - 1 && (
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

      {showRejectModal && (
        <RejectListingModal
          onClose={closeRejectModal}
          onConfirm={confirmReject}
        />
      )}

      {showEditModal && (
        <EditListingModal
          listing={listing}
          existingPhotos={photos}
          onClose={closeEditModal}
          onSaved={handleEditSaved}
        />
      )}

      {showExpressInterestModal && listing && (
        <ExpressInterestModal
          listingId={listing.id}
          onClose={closeExpressInterestModal}
          onSubmitted={handleInterestSubmitted}
        />
      )}
    </div>
  );
}
