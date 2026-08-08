import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, Phone, Mail, FileText, X, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import CoreSample from "../components/CoreSample";
import VerifiedBadge from "../components/VerifiedBadge";
import RejectListingModal from "../components/RejectListingModal";
import ListingHistory from "../components/ListingHistory";
import EditListingModal from "../components/EditListingModal";
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
