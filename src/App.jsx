import MarketplacePage from "./pages/MarketplacePage";

// This file intentionally stays thin. All marketplace logic now lives in
// pages/MarketplacePage.jsx and the components/services it uses. As more
// pages are added (ListingDetailPage, ProfilePage, LoginPage) in later
// stages, real routing will be introduced here.
export default function App() {
  return <MarketplacePage />;
}
