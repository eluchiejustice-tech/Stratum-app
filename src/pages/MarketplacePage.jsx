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
      photo_url: form.photoUrl || null,
      document_url: form.documentUrl || null,
      seller_name: form.seller,
      seller_company: form.company,
      seller_contact: form.contact,
      status: "pending",
    };
    ...
