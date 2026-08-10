import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { AFRICA_LOCATIONS } from "../data/africaLocations";
import { MINERAL_COLORS } from "../utils/mineralColors";
import { updateListingContent, createListingPhotos, createListingDocument, deleteListingPhoto } from "../services/listings";

const QUANTITY_UNITS = ["kg", "g", "tonnes", "tons", "lb", "oz"];
const MAX_PHOTOS = 5;

const PRICE_PHRASES = [
  "negotiable",
  "contact for quote",
  "contact for price",
  "price on request",
];

const PRICE_PATTERN = /^[$₦€£]?\s?[\d,]+(\.\d+)?(\s?\/\s?\w+)?$/;

const PHONE_PATTERN = /^[+\d][\d\s\-()]{6,19}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Splits a stored quantity string ("35 kg") back into amount + unit for
// editing. Falls back to treating the whole string as the amount with no
// recognized unit if it doesn't match a known unit.
function parseQuantity(stored) {
  if (!stored) return { amount: "", unit: QUANTITY_UNITS[0] };
  const parts = stored.trim().split(/\s+/);
  const lastToken = parts[parts.length - 1];
  if (QUANTITY_UNITS.includes(lastToken)) {
    return { amount: parts.slice(0, -1).join(" "), unit: lastToken };
  }
  return { amount: stored, unit: QUANTITY_UNITS[0] };
}

// If the listing's current mineral isn't one of the known dropdown
// options, treat it as a pre-existing custom value (same "Other" concept
// AddListingModal uses at creation) so editing doesn't silently discard
// or misrepresent it.
function isKnownMineral(value) {
  return Object.prototype.hasOwnProperty.call(MINERAL_COLORS, value);
}

function getPriceWarning(price) {
  const trimmed = price.trim();
  if (!trimmed) return null;
  if (PRICE_PHRASES.includes(trimmed.toLowerCase())) return null;
  if (PRICE_PATTERN.test(trimmed)) return null;
  return 'Add a number (e.g. $1,150/tonne) or write "Negotiable".';
}

// Validates editable fields. Deliberately does not require a fresh photo
// upload the way AddListingModal's validate() does — existingPhotos
// (passed in) already guarantees at least one photo exists before Edit
// Listing is ever reachable for a given listing.
function validate(form, customMineral) {
  const errors = {};

  if (form.mineral === "Other" && !customMineral.trim()) {
    errors.customMineral = "Please specify the mineral.";
  }

  if (!form.grade.trim()) errors.grade = "Grade / spec is required.";

  if (!form.quantityAmount.trim()) {
    errors.quantityAmount = "Quantity is required.";
  } else if (isNaN(Number(form.quantityAmount)) || Number(form.quantityAmount) <= 0) {
    errors.quantityAmount = "Enter a valid positive number.";
  }

  if (!form.state.trim()) errors.state = "State is required.";
  if (!form.location.trim()) errors.location = "Location is required.";
  if (!form.seller.trim()) errors.seller = "Seller name is required.";

  const contact = form.contact.trim();
  if (!contact) {
    errors.contact = "Contact is required.";
  } else if (!PHONE_PATTERN.test(contact) && !EMAIL_PATTERN.test(contact)) {
    errors.contact = "Enter a valid phone number or email address.";
  }

  return errors;
}

// listing: the already-loaded, mapped listing object from
// ListingDetailPage (via mapListingRow) — no separate fetch happens here.
// existingPhotos: the listing's current listing_photos rows ({ id,
// photo_url, position }), passed in from ListingDetailPage so this modal
// can both display them and delete them without a separate fetch here.
export default function EditListingModal({ listing, existingPhotos, onClose, onSaved }) {
  const parsedQuantity = parseQuantity(listing.quantity);
  const startingMineralIsKnown = isKnownMineral(listing.mineral);

  const [form, setForm] = useState({
    mineral: startingMineralIsKnown ? listing.mineral : "Other",
    grade: listing.grade || "",
    quantityAmount: parsedQuantity.amount,
    quantityUnit: parsedQuantity.unit,
    state: listing.state || "",
    lga: listing.lga || "",
    location: listing.location || "",
    seller: listing.seller || "",
    company: listing.company || "",
    contact: listing.contact || "",
    price: listing.price || "",
  });
  const [customMineral, setCustomMineral] = useState(
    startingMineralIsKnown ? "" : listing.mineral || ""
  );

  const [errors, setErrors] = useState({});
  const [priceWarning, setPriceWarning] = useState(null);

  const [photos, setPhotos] = useState(existingPhotos || []);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [newPhotos, setNewPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");

  const [documentUrl, setDocumentUrl] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const states = Object.keys(AFRICA_LOCATIONS.Nigeria);
  const lgas = form.state ? AFRICA_LOCATIONS.Nigeria[form.state].lgas : [];

  const updateField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((e) => ({ ...e, [field]: undefined }));
    }
  };

  const handlePriceChange = (value) => {
    setForm((f) => ({ ...f, price: value }));
    setPriceWarning(getPriceWarning(value));
  };

  // Uploads a new photo immediately (same mechanics as AddListingModal:
  // same bucket, same filename convention) and attaches it to the
  // existing listing right away via createListingPhotos.
  const uploadNewPhoto = async (file, position) => {
    const fileExt = file.name.split(".").pop();
    const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    setNewPhotos((prev) => [
      ...prev,
      { id: storagePath, url: null, uploading: true },
    ]);

    const { error: uploadErr } = await supabase.storage
      .from("listing-photos")
      .upload(storagePath, file);

    if (uploadErr) {
      console.error("Photo upload failed", uploadErr);
      setNewPhotos((prev) => prev.filter((p) => p.id !== storagePath));
      setPhotoError("One of your photos failed to upload. Please try again.");
      return;
    }

    const { data } = supabase.storage.from("listing-photos").getPublicUrl(storagePath);

    const { error: attachErr } = await createListingPhotos(listing.id, [
      { url: data.publicUrl, position },
    ]);

    if (attachErr) {
      console.error("Failed to attach photo to listing", attachErr);
      setNewPhotos((prev) => prev.filter((p) => p.id !== storagePath));
      setPhotoError("Photo uploaded but couldn't be attached. Please try again.");
      return;
    }

    setNewPhotos((prev) =>
      prev.map((p) => (p.id === storagePath ? { ...p, url: data.publicUrl, uploading: false } : p))
    );
  };

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const currentTotal = photos.length + newPhotos.length;
    const availableSlots = MAX_PHOTOS - currentTotal;

    if (availableSlots <= 0) {
      setPhotoError(`You can have up to ${MAX_PHOTOS} photos total. Remove one elsewhere to add another.`);
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setPhotoError(
        `Only ${availableSlots} more photo${availableSlots === 1 ? "" : "s"} can be added (max ${MAX_PHOTOS} total). The rest were skipped.`
      );
    } else {
      setPhotoError("");
    }

    let nextPosition = currentTotal;
    filesToUpload.forEach((file) => {
      uploadNewPhoto(file, nextPosition);
      nextPosition += 1;
    });
  };

  // Deletes an existing (already-saved) listing photo. Ownership is
  // enforced by RLS/storage policy server-side, not just by this button
  // being hidden from non-owners — see deleteListingPhoto() in the
  // service layer for the exact authorization/failure handling.
  const handleDeleteExistingPhoto = async (photo) => {
    setDeletingPhotoId(photo.id);
    setPhotoError("");

    const { error, stage } = await deleteListingPhoto(photo);

    if (error) {
      console.error("Failed to delete photo", stage, error);
      setPhotoError(
        stage === "not_authorized"
          ? "Couldn't delete that photo."
          : "Couldn't delete that photo. Please try again."
      );
      setDeletingPhotoId(null);
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setDeletingPhotoId(null);
  };

  // Same pattern as Phase 4's handleReplaceDocument: uploads immediately
  // and adds a new mineral_documents row rather than editing one in
  // place. Same known ordering ambiguity already logged to the backlog.
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

    setDocumentUrl(fileName);
    setUploadingDoc(false);
  };

  const anyPhotoUploading = newPhotos.some((p) => p.uploading);

  const handleSave = async () => {
    const validationErrors = validate(form, customMineral);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (anyPhotoUploading || uploadingDoc) return;

    setSaving(true);
    setSaveError(null);

    const quantity = `${form.quantityAmount.trim()} ${form.quantityUnit}`;
    const mineral = form.mineral === "Other" ? customMineral.trim() : form.mineral;

    const { error: updateError } = await updateListingContent(listing.id, {
      mineral,
      category: mineral,
      description: form.grade.trim(),
      mineral_grade: form.grade.trim(),
      quantity,
      state: form.state.trim(),
      local_government_area: form.lga.trim(),
      location: form.location.trim(),
      seller_name: form.seller.trim(),
      seller_company: form.company.trim(),
      seller_contact: form.contact.trim(),
      price: form.price.trim(),
    });

    if (updateError) {
      console.error("Failed to update listing", updateError);
      setSaveError("Couldn't save your changes. Please try again.");
      setSaving(false);
      return;
    }

    if (documentUrl) {
      const { error: docError } = await createListingDocument(listing.id, documentUrl, listing.sellerId);
      if (docError) {
        console.error("Failed to attach replacement document", docError);
        setSaveError("Listing saved, but the new document couldn't be attached. Please try uploading it again.");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#EDE8DC] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-[#15130F]">Edit listing</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Mineral</label>
            <select
              value={form.mineral}
              onChange={(e) => updateField("mineral", e.target.value)}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            >
              {Object.keys(MINERAL_COLORS).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          {form.mineral === "Other" && (
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
                Specify mineral
              </label>
              <input
                value={customMineral}
                onChange={(e) => {
                  setCustomMineral(e.target.value);
                  if (errors.customMineral) {
                    setErrors((err) => ({ ...err, customMineral: undefined }));
                  }
                }}
                placeholder="e.g. Lead Ore, Zinc Ore"
                className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                  errors.customMineral ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
                }`}
              />
              {errors.customMineral && (
                <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.customMineral}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Grade / spec</label>
            <input
              value={form.grade}
              onChange={(e) => updateField("grade", e.target.value)}
              className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                errors.grade ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
              }`}
            />
            {errors.grade && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.grade}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Quantity</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantityAmount}
                onChange={(e) => updateField("quantityAmount", e.target.value)}
                className={`flex-1 bg-white border rounded px-3 py-2 text-sm ${
                  errors.quantityAmount ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
                }`}
              />
              <select
                value={form.quantityUnit}
                onChange={(e) => updateField("quantityUnit", e.target.value)}
                className="bg-white border border-[#3D4148]/20 rounded px-2 py-2 text-sm"
              >
                {QUANTITY_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            {errors.quantityAmount && (
              <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.quantityAmount}</p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">State</label>
            <select
              value={form.state}
              onChange={(e) => {
                updateField("state", e.target.value);
                updateField("lga", "");
              }}
              className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                errors.state ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
              }`}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {errors.state && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.state}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Local Government Area (optional)
            </label>
            <select
              value={form.lga}
              onChange={(e) => updateField("lga", e.target.value)}
              disabled={!form.state}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{form.state ? "Select LGA" : "Select State First"}</option>
              {lgas.map((lga) => (
                <option key={lga.name} value={lga.name}>{lga.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Location</label>
            <input
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                errors.location ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
              }`}
            />
            {errors.location && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.location}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Seller name</label>
            <input
              value={form.seller}
              onChange={(e) => updateField("seller", e.target.value)}
              className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                errors.seller ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
              }`}
            />
            {errors.seller && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.seller}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Company (optional)</label>
            <input
              value={form.company}
              onChange={(e) => updateField("company", e.target.value)}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Contact (phone or email)</label>
            <input
              value={form.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                errors.contact ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
              }`}
            />
            {errors.contact && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.contact}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Price</label>
            <input
              value={form.price}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
            {priceWarning && <p className="text-[10px] text-[#9c7a1f] mt-1">{priceWarning}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Photos (up to {MAX_PHOTOS} total)
            </label>

            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative w-16 h-16 rounded border border-[#3D4148]/20 overflow-hidden bg-white"
                  >
                    <img src={p.photo_url} alt="Listing photo" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingPhoto(p)}
                      disabled={deletingPhotoId === p.id}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 disabled:opacity-50"
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotosChange}
              disabled={photos.length + newPhotos.length >= MAX_PHOTOS}
              className="w-full mt-2 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm disabled:opacity-50"
            />
            {photoError && (
              <p className="text-sm font-medium text-[#8a3b3b] bg-[#8a3b3b]/10 border border-[#8a3b3b]/30 rounded px-3 py-2 mt-2">
                {photoError}
              </p>
            )}
            {newPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {newPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="w-16 h-16 rounded border border-[#3D4148]/20 overflow-hidden bg-white flex items-center justify-center"
                  >
                    {p.uploading ? (
                      <span className="text-[9px] text-[#3D4148]/60 text-center px-1">Uploading…</span>
                    ) : (
                      <img src={p.url} alt="New photo" className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
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
            {uploadingDoc && <p className="text-[10px] text-[#3D4148]/60 mt-1">Uploading document…</p>}
            {docUploadError && <p className="text-[10px] text-[#8a3b3b] mt-1">{docUploadError}</p>}
            {documentUrl && !uploadingDoc && (
              <p className="text-[10px] text-[#1F4D3D] mt-1">New document attached ✓</p>
            )}
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-[#8a3b3b] mt-3">{saveError}</p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-[#3D4148]/20 text-[#3D4148] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148]/5 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || anyPhotoUploading || uploadingDoc}
            className="flex-1 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
