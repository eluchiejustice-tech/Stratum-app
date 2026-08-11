import { useState } from "react";
import MarketplacePage from "./pages/MarketplacePage";
import SellerProfilePage from "./pages/SellerProfilePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import MyListingsPage from "./pages/MyListingsPage";
import BuyerDashboardPage from "./pages/BuyerDashboardPage";
import SellerDashboardPage from "./pages/SellerDashboardPage";
import MarketIntelligencePage from "./pages/MarketIntelligencePage";
import SellerInquiriesPage from "./pages/SellerInquiriesPage";
import BuyerInquiriesPage from "./pages/BuyerInquiriesPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { AuthProvider } from "./context/AuthContext";

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

  const openBuyerDashboard = () => {
    setView("buyerDashboard");
  };

  // Seller Dashboard is now the primary seller workspace — Listings
  // Management lives inside it (via an embedded MyListingsPage), so
  // MyListingsPage is no longer reachable as its own top-level view from
  // Header. It remains importable/renderable in principle, but nothing
  // currently sets view to "myListings".
  const openSellerDashboard = () => {
    setView("sellerDashboard");
  };

  // Market Intelligence (Phase 7) — a first-class, public destination.
  // Reachable from Header (always visible, regardless of auth state) and
  // from Seller Dashboard's Market Snapshot "view full experience" link.
  const openMarketIntelligence = () => {
    setView("marketIntelligence");
  };

  // Buyer Interest & Deal Workflow — each side's inquiry inbox is its own
  // top-level view, reachable from its respective dashboard, following
  // the same link-out pattern as openMarketIntelligence rather than being
  // embedded inline in either dashboard.
  const openSellerInquiries = () => {
    setView("sellerInquiries");
  };

  const openBuyerInquiries = () => {
    setView("buyerInquiries");
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
      ) : view === "sellerDashboard" ? (
        <SellerDashboardPage
          onBack={backToMarketplace}
          onListingClick={openListingDetail}
          onSellerClick={openSellerProfile}
          onMarketIntelligence={openMarketIntelligence}
          onSellerInquiries={openSellerInquiries}
        />
      ) : view === "buyerDashboard" ? (
        <BuyerDashboardPage
          onBack={backToMarketplace}
          onListingClick={openListingDetail}
          onSellerClick={openSellerProfile}
          onBuyerInquiries={openBuyerInquiries}
        />
      ) : view === "marketIntelligence" ? (
        <MarketIntelligencePage onBack={backToMarketplace} />
      ) : view === "sellerInquiries" ? (
        <SellerInquiriesPage
          onBack={backToMarketplace}
          onListingClick={openListingDetail}
        />
      ) : view === "buyerInquiries" ? (
        <BuyerInquiriesPage
          onBack={backToMarketplace}
          onListingClick={openListingDetail}
          onSellerClick={openSellerProfile}
        />
      ) : (
        <MarketplacePage
          onSellerClick={openSellerProfile}
          onListingClick={openListingDetail}
          onSellerDashboard={openSellerDashboard}
          onBuyerDashboard={openBuyerDashboard}
          onMarketIntelligence={openMarketIntelligence}
        />
      )}
    </AuthProvider>
  );
}
