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

    // Buyer-interest instrumentation: fire-and-forget, never awaited, never
    // allowed to block or fail the page load.
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
