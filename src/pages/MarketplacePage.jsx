import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Header from "../components/Header";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import ListingCard from "../components/ListingCard";
import ConsultingBanner from "../components/ConsultingBanner";
import AddListingModal from "../components/AddListingModal";
import { MINERAL_COLORS } from "../utils/mineralColors";
import { mapListingRow } from "../utils/mapListingRow";
import { AFRICA_LOCATIONS } from "../data/africaLocations";
import { useAuthContext } from "../context/AuthContext";
import { useListings } from "../hooks/useListings";
import {
  createListing,
  createListingPhotos,
  createListingDocument,
  updateListingStatus,
  createVerificationRecord,
} from "../services/listings";
import { getSavedListings, saveListing, unsaveListing } from "../services/savedListings";

const UPLOAD_WARNING_MESSAGES = {
  photos: "Your listing was created successfully, but the photos could not be uploaded.",
  document: "Your listing was created successfully, but the document could not be uploaded.",
  both: "Your listing was created successfully, but some attachments could not be uploaded.",
};

export default function MarketplacePage({ onSellerClick, onListingClick, onMyListings }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [stateFilter, setStateFilter] = useState("");
  const [lgaFilter, setLgaFilter] = useState("");
  const [uploadWarning, setUploadWarning] = useState(null);
  const [savedListingIds, setSavedListingIds] = useState(new Set());

  const { user, role } = useAuthContext();
  const isModerator = role === "moderator";

  const { listings, loading, error, refresh } = useListings();

  const states = Object.keys(AFRICA_LOCATIONS.Nigeria);
  const lgaOptions = stateFilter ? AFRICA_LOCATIONS.Nigeria[stateFilter].lgas : [];

  useEffect(() => {
    if (!user) {
      setSavedListingIds(new Set());
      return;
    }
    let cancelled = false;
    getSavedListings(user.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load saved listings", error);
        return;
      }
      setSavedListingIds(new Set(data.map((row) => row.listing_id)));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const openAddListing = () => {
    setUploadWarning(null);
    setShowAdd(true);
  };

  const addListing = async (form) => {
    const payload = {
      seller_id: user.id,
      mineral: form.mineral,
      category: form.mineral,
      description: form.grade,
      quantity: form.quantity,
      mineral_grade: form.grade,
      country: "Nigeria",
      state: form.state,
      local_government_area: form.lga,
      location: form.location,
      availability: "in_stock",
      price: form.price,
      photo_url: form.photos?.[0]?.url || null,
      seller_name: form.seller,
      seller_company: form.company,
      seller_contact: form.contact,
      status: "pending",
    };
    const { data: newListing, error: insertError } = await createListing(payload);
    if (insertError) {
      console.error("Failed to create listing", insertError);
      return;
    }

    let photosFailed = false;
    let documentFailed = false;

    if (form.photos && form.photos.length > 0) {
      const { error: photosError } = await createListingPhotos(newListing.id, form.photos);
      if (photosError) {
        console.error("Failed to save listing photos", photosError);
        photosFailed = true;
      }
    }

    if (form.documentUrl) {
      const { error: documentError } = await createListingDocument(
        newListing.id,
        form.documentUrl,
        user.id
      );
      if (documentError) {
        console.error("Failed to save listing document", documentError);
        documentFailed = true;
      }
    }

    if (photosFailed && documentFailed) {
      setUploadWarning(UPLOAD_WARNING_MESSAGES.both);
    } else if (photosFailed) {
      setUploadWarning(UPLOAD_WARNING_MESSAGES.photos);
    } else if (documentFailed) {
      setUploadWarning(UPLOAD_WARNING_MESSAGES.document);
    }

    await refresh();
  };

  const verifyListing = async (id) => {
    const { error: updateError } = await updateListingStatus(id, "verified");
    if (!updateError) {
      await createVerificationRecord({
        ve
