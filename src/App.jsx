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
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import ContactPage from "./pages/ContactPage";
import Footer from "./components/Footer";
import { AuthProvider } from "./context/AuthContext";

function viewFromLocation() {
  const path = window.location.pathname;
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  if (path === "/contact") return "contact";
  if (new URLSearchParams(window.location.search).get("view") === "reset-password") {
    return "resetPassword";
  }
  return "marketplace";
}

export default function App() {
  const [view, setView] = useState(viewFromLocation);
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

  const openSellerDashboard = () => {
    setView("sellerDashboard");
  };

  const openMarketIntelligence = () => {
    setView("marketIntelligence");
  };

  const openSellerInquiries = () => {
    setView("sellerInquiries");
  };

  const openBuyerInquiries = () => {
    setView("buyerInquiries");
  };

  // Legal/support pages — real, directly-loadable paths (handled by a
  // Vercel SPA rewrite so a hard refresh or direct link still works).
  // pushState keeps the address bar in sync without a full page reload,
  // matching the lightweight pattern already used for reset-password.
  const openPrivacy = () => {
    window.history.pushState({}, "", "/privacy");
    setView("privacy");
  };

  const openTerms = () => {
    window.history.pushState({}, "", "/terms");
    setView("terms");
  };

  const openContact = () => {
    window.history.pushState({}, "", "/contact");
    setView("contact");
  };

  const backToMarketplace = () => {
    window.history.replaceState({}, "", "/");
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
      ) : (
        <>
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
          ) : view === "privacy" ? (
            <PrivacyPolicyPage onBack={backToMarketplace} onContact={openContact} />
          ) : view === "terms" ? (
            <TermsOfServicePage onBack={backToMarketplace} onContact={openContact} />
          ) : view === "contact" ? (
            <ContactPage onBack={backToMarketplace} />
          ) : (
            <MarketplacePage
              onSellerClick={openSellerProfile}
              onListingClick={openListingDetail}
              onSellerDashboard={openSellerDashboard}
              onBuyerDashboard={openBuyerDashboard}
              onMarketIntelligence={openMarketIntelligence}
            />
          )}

          <Footer onPrivacy={openPrivacy} onTerms={openTerms} onContact={openContact} />
        </>
      )}
    </AuthProvider>
  );
}
