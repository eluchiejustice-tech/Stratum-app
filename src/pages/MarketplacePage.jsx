import {
  createListing,
  createListingPhotos,
  updateListingStatus,
  createVerificationRecord,
} from "../services/listings";

// ...

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
      document_url: form.documentUrl || null,
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

    if (form.photos && form.photos.length > 0) {
      const { error: photosError } = await createListingPhotos(newListing.id, form.photos);
      if (photosError) {
        console.error("Failed to save listing photos", photosError);
      }
    }

    await refresh();
  };
