import { useState } from "react";
import MarketplacePage from "./pages/MarketplacePage";
import SellerProfilePage from "./pages/SellerProfilePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import { AuthProvider } from "./context/AuthContext";

// This file intentionally stays thin. All marketplace logic still lives in
// pages/MarketplacePage.jsx and the components/services it uses.
//
// State-based view switching (no react-router-dom yet). "view" tracks which
// page is shown; "selectedSellerId" / "selectedListingId" carry whichever
// entity the current detail view needs.
export default function App() {
  const [view, setView] = useState("marketplace"); // "marketplace" | "sellerProfile" | "listingDetail"
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [selectedListingId, setSelectedListingId] = useState(null);

  const openSellerProfile = (sellerId) => {
    setSelectedSellerId(sellerId);
    setView("sellerProfile");
  };

  const openListingDetail = (listingId) => {
    setSelectedListingId(listingId);
    setView("listingDetail");
  };

  const backToMarketplace = () => {
    setView("marketplace");
    setSelectedSellerId(null);
    setSelectedListingId(null);
  };

  return (
    <AuthProvider>
      {view === "sellerProfile" && selectedSellerId ? (
        <SellerProfilePage
          sellerId={selectedSellerId}
          onBack={backToMarketplace}
          onListingClick={openListingDetail}
        />
      ) : view === "listingDetail" && selectedListingId ? (
        <ListingDetailPage
          listingId={selectedListingId}
          onBack={backToMarketplace}
          onSellerClick={openSellerProfile}
        />
      ) : (
        <MarketplacePage
          onSellerClick={openSellerProfile}
          onListingClick={openListingDetail}
        />
      )}
    </AuthProvider>
  );
}
