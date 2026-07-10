import { supabase } from "./supabaseClient";

// Not yet wired into the UI. Used once ListingDetailPage is built
// (Marketplace MVP phase, after this backend-connection phase).

export async function getDocumentsForListing(listingId) {
  return supabase.from("mineral_documents").select("*").eq("listing_id", listingId);
}

export async function uploadDocument({ listingId, documentType, fileUrl, uploadedBy }) {
  return supabase
    .from("mineral_documents")
    .insert({
      listing_id: listingId,
      document_type: documentType,
      file_url: fileUrl,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();
}
