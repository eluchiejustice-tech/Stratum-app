import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, Phone, Mail, FileText, X, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import CoreSample from "../components/CoreSample";
import VerifiedBadge from "../components/VerifiedBadge";
import RejectListingModal from "../components/RejectListingModal";
import ListingHistory from "../components/ListingHistory";
import { getContactOptions } from "../utils/contactHref";
import { mapListingRow } from "../utils/mapListingRow";
import { supabase } from "../services/supabaseClient";
import {
  getListingById,
  getPhotosByListing,
  updateListingState,
  setListingVerificationStatus,
  getVerificationHistory,
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

  const [historyRecords, setHistoryRecords] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);

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

  const openRejectModal = () => setShowRejectModal(true);
  const closeRejectModal = () => setShowRejectModal(false);

  // Called by RejectListingModal on confirm. Returns { error } so the modal
  // can show its own inline error and keep itself open on failure, rather
  // than closing optimistically. Reason has already been validated
  // (non-empty, trimmed, min length) by the modal before this is called.
  const confirmReject = async (reason) => {
    const { error } = await setListingVerificationStatus(listing.id, "rejected", user.id, reason);
    if (!error) {
      setShowRejectModal(false);
      await loadListing();
    }
    return { error };
  };

  // Seller-facing commercial lifecycle (active/paused/sold/archived) — kept
  // deliberately separate from verifyListing/confirmReject above, which
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
