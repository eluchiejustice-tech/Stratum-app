import { useState } from "react";
import MarketplacePage from "./pages/MarketplacePage";
import SellerProfilePage from "./pages/SellerProfilePage";
import { AuthProvider } from "./context/AuthContext";

// This file intentionally stays thin. All marketplace logic still lives in
// pages/MarketplacePage.jsx and the components/services it uses.
//
// Stage: seller profile view added via simple state-based switching
// (no react-router-dom yet). "view" tracks which page is shown, and
// "selectedSellerId" carries the seller whose profile should be displayed.
// When real routing is introduced later (ListingDetailPage, LoginPage, etc.),
// this switching logic can be lifted into actual routes.
export default function App() {
  const [view, setView] = useState("marketplace"); // "marketplace" | "sellerProfile"
  const [selectedSellerId, setSelectedSellerId] = useState(null);

  const openSellerProfile = (sellerId) => {
    setSelectedSellerId(sellerId);
    setView("sellerProfile");
  };

  const backToMarketplace = () => {
    setView("marketplace");
    setSelectedSellerId(null);
  };

  return (
    <AuthProvider>
      {view === "sellerProfile" && selectedSellerId ? (
        <SellerProfilePage sellerId={selectedSellerId} onBack={backToMarketplace} />
      ) : (
        <MarketplacePage onSellerClick={openSellerProfile} />
      )}
    </AuthProvider>
  );
}
