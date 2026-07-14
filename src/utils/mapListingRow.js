import { bandsFor } from "./mineralColors";

// Single source of truth for turning a raw mineral_listings row into the
// shape ListingCard (and now ListingDetailPage) expect. Previously this
// mapping was duplicated in MarketplacePage.jsx and SellerProfilePage.jsx;
// extracting it here means any new field only needs to be added once.
export function mapListingRow(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    mineral: row.mineral,
    grade: row.mineral_grade,
    quantity: row.quantity,
    location: [row.location, row.local_government_area, row.state, row.country]
      .filter(Boolean)
      .join(", "),
    seller: row.seller_name,
    company: row.seller_company,
    contact: row.seller_contact,
    verified: row.status === "verified",
    price: row.price,
    photoUrl: row.photo_url,
    documentUrl: row.document_url,
    strata: bandsFor(row.mineral),
  };
}
