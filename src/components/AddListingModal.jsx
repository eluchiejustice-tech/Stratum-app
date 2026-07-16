import { useState } from "react";
import { X } from "lucide-react";
import { MINERAL_COLORS } from "../utils/mineralColors";
import { supabase } from "../services/supabaseClient";

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

function validate(form, photos) {
  const errors = {};

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

  if (photos.length === 0) {
    errors.photos = "At least one photo is required.";
  }

  return errors;
}

function getPriceWarning(price) {
  const trimmed = price.trim();
  if (!trimmed) return null;
  if (PRICE_PHRASES.includes(trimmed.toLowerCase())) return null;
  if (PRICE_PATTERN.test(trimmed)) return null;
  return 'Add a number (e.g. $1,150/tonne) or write "Negotiable".';
}

export default function AddListingModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    mineral: "Gold",
    grade: "",
    quantityAmount: "",
    quantityUnit: "kg",
    state: "",
    lga: "",
    location: "",
    seller: "",
    company: "",
    contact: "",
    price: "",
    documentUrl: "",
  });
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [errors, setErrors] = useState({});
  const [priceWarning, setPriceWarning] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState("");

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

  const uploadPhoto = async (file, position) => {
    const fileExt = file.name.split(".").pop();
    const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    setPhotos((prev) => [
      ...prev,
      { id: storagePath, url: null, storagePath, position, uploading: true },
    ]);

    const { error: uploadErr } = await supabase.storage
      .from("listing-photos")
      .upload(storagePath, file);

    if (uploadErr) {
      console.error("Photo upload failed", uploadErr);
      setPhotos((prev) => prev.filter((p) => p.id !== storagePath));
      setPhotoError("One of your photos failed to upload. Please try again.");
      return;
    }

    const { data } = supabase.storage.from("listing-photos").getPublicUrl(storagePath);
    setPhotos((prev) =>
      prev.map((p) => (p.id === storagePath ? { ...p, url: data.publicUrl, uploading: false } : p))
    );
  };

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const availableSlots = MAX_PHOTOS - photos.length;

    if (availableSlots <= 0) {
      setPhotoError(`You can upload up to ${MAX_PHOTOS} photos. Remove one to add another.`);
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

    if (errors.photos) {
      setErrors((e) => ({ ...e, photos: undefined }));
    }

    let nextPosition = photos.length;
    filesToUpload.forEach((file) => {
      uploadPhoto(file, nextPosition);
      nextPosition += 1;
    });
  };

  const removePhoto = (id) => {
    setPhotos((prev) =>
      prev
        .filter((p) => p.id !== id)
        .map((p, idx) => ({ ...p, position: idx }))
    );
    setPhotoError("");
  };

  const handleDocumentChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    setDocUploadError("");

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

    const { data } = supabase.storage.from("listing-documents").getPublicUrl(fileName);
    setForm((f) => ({ ...f, documentUrl: data.publicUrl }));
    setUploadingDoc(false);
  };

  const anyPhotoUploading = photos.some((p) => p.uploading);

  const submit = () => {
    const validationErrors = validate(form, photos);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;
    if (anyPhotoUploading || uploadingDoc) return;

    const quantity = `${form.quantityAmount.trim()} ${form.quantityUnit}`;

    onAdd({
      mineral: form.mineral,
      grade: form.grade.trim(),
      quantity,
      state: form.state.trim(),
      lga: form.lga.trim(),
      location: form.location.trim(),
      seller: form.seller.trim(),
      company: form.company.trim(),
      contact: form.contact.trim(),
      price: form.price.trim(),
      documentUrl: form.documentUrl,
      photos: photos
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((p) => ({ url: p.url, storagePath: p.storagePath, position: p.position })),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#EDE8DC] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-[#15130F]">New listing</h2>
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

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Grade / spec</label>
            <input
              value={form.grade}
              onChange={(e) => updateField("grade", e.target.value)}
              placeholder="e.g. 91.6% purity, unassayed"
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
                placeholder="e.g. 35"
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
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {errors.quantityAmount && (
              <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.quantityAmount}</p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">State</label>
            <input
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder="e.g. Ekiti, Nasarawa, Kaduna"
              className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${
                errors.state ? "border-[#8a3b3b]" : "border-[#3D4148]/20"
              }`}
            />
            {errors.state && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.state}</p>}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Local Government Area (optional)
            </label>
            <input
              value={form.lga}
              onChange={(e) => updateField("lga", e.target.value)}
              placeholder="e.g. Jos North, Ijero"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Location</label>
            <input
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="Town, or mining community"
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
              placeholder="e.g. Adewale Minerals Co."
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Contact (phone or email)</label>
            <input
              value={form.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              placeholder="e.g. +234... or you@company.com"
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
              placeholder="e.g. $1,150/tonne or Negotiable"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
            {priceWarning && (
              <p className="text-[10px] text-[#9c7a1f] mt-1">{priceWarning}</p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Mineral photos (up to {MAX_PHOTOS}, first one is the cover photo)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotosChange}
              disabled={photos.length >= MAX_PHOTOS}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm disabled:opacity-50"
            />
            {errors.photos && <p className="text-[10px] text-[#8a3b3b] mt-1">{errors.photos}</p>}
            {photoError && (
              <p className="text-sm font-medium text-[#8a3b3b] bg-[#8a3b3b]/10 border border-[#8a3b3b]/30 rounded px-3 py-2 mt-2">
                {photoError}
              </p>
            )}

            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photos
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((p, idx) => (
                    <div
                      key={p.id}
                      className="relative w-16 h-16 rounded border border-[#3D4148]/20 overflow-hidden bg-white flex items-center justify-center"
                    >
                      {p.uploading ? (
                        <span className="text-[9px] text-[#3D4148]/60 text-center px-1">
                          Uploading…
                        </span>
                      ) : (
                        <img
                          src={p.url}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {idx === 0 && !p.uploading && (
                        <span className="absolute top-0 left-0 bg-[#1F4D3D] text-[#EDE8DC] text-[8px] font-mono uppercase px-1 py-0.5">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        title="Remove photo"
                        className="absolute top-0 right-0 bg-[#8a3b3b] text-[#EDE8DC] rounded-bl w-4 h-4 flex items-center justify-center text-[10px] leading-none"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Assay report / certificate (optional)
            </label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={handleDocumentChange}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
            <p className="text-[10px] text-[#3D4148]/50 mt-1">
              PDF, JPG, or PNG, up to 10MB. Boosts buyer trust in your listing.
            </p>
            {uploadingDoc && (
              <p className="text-[10px] text-[#3D4148]/60 mt-1">Uploading document…</p>
            )}
            {docUploadError && (
              <p className="text-[10px] text-[#8a3b3b] mt-1">{docUploadError}</p>
            )}
            {form.documentUrl && !uploadingDoc && (
              <p className="text-[10px] text-[#1F4D3D] mt-1">Document attached ✓</p>
            )}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={anyPhotoUploading || uploadingDoc}
          className="w-full mt-5 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
        >
          {anyPhotoUploading || uploadingDoc ? "Uploading…" : "Submit for review"}
        </button>
        <p className="text-xs text-[#3D4148]/70 mt-2 text-center">
          New listings show as "Pending review" until your team verifies them.
        </p>
      </div>
    </div>
  );
}
