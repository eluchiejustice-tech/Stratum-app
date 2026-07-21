import { useState } from "react";
import MarketplacePage from "./pages/MarketplacePage";
import SellerProfilePage from "./pages/SellerProfilePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import MyListingsPage from "./pages/MyListingsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { AuthProvider } from "./context/AuthContext";

// This file intentionally stays thin. All marketplace logic still lives in
// pages/MarketplacePage.jsx and the components/services it uses.
//
// State-based view switching (no react-router-dom yet). "view" tracks which
// page is shown; "selectedSellerId" / "selectedListingId" carry whichever
// entity the current detail view needs.
//
// "resetPassword" is a special case: unlike the other views, it's entered
// via a URL query param (?view=reset-password) from a Supabase recovery
// email link, not through in-app navigation — so it's detected once, at
// initial mount, via the useState initializer below, rather than being
// triggered by a setView() call elsewhere in the app.
export default function App() {
  const [view, setView] = useState(() =>
    new URLSearchParams(window.location.search).get("view") === "reset-password"
      ? "resetPassword"
      : "marketplace"
  );
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

  const openMyListings = () => {
    setView("myListings");
  };

  const backToMarketplace = () => {
    setView("marketplace");
    setSelectedSellerId(null);
    setSelectedListingId(null);
  };

  const exitResetPassword = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
    setView("marketplace");
  };

  return (
    <AuthProvider>
      {view === "resetPassword" ? (
        <ResetPasswordPage onComplete={exitResetPassword} />
      ) : view === "sellerProfile" && selectedSellerId ? (
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
      ) : view === "myListings" ? (
        <MyListingsPage
          onBack={backToMarketplace}
          onListingClick={openListingDetail}
          onSellerClick={openSellerProfile}
        />
      ) : (
        <MarketplacePage
          onSellerClick={openSellerProfile}
          onListingClick={openListingDetail}
          onMyListings={openMyListings}
        />
      )}
    </AuthProvider>
  );
}
