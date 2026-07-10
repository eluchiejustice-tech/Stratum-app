import { useState, useEffect } from "react";
import Header from "../components/Header";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import ListingCard from "../components/ListingCard";
import ConsultingBanner from "../components/ConsultingBanner";
import AddListingModal from "../components/AddListingModal";
import LoginForm from "../components/LoginForm";
import { MINERAL_COLORS } from "../utils/mineralColors";

const SEED_LISTINGS = [
  {
    id: "s1",
    mineral: "Gold",
    grade: "22 karat, 91.6% purity",
    quantity: "2.5 kg",
    location: "Ijero-Ekiti, Nigeria",
    seller: "Adewale Minerals Co.",
    contact: "+2348012345678",
    verified: true,
    price: "Contact for quote",
    strata: ["#B8922F", "#4A4238", "#B8922F", "#6B7280"],
  },
  {
    id: "s2",
    mineral: "Lithium",
    grade: "Spodumene concentrate, 5.8% Li2O",
    quantity: "40 tonnes",
    location: "Nasarawa, Nigeria",
    seller: "Terra Depth Resources",
    contact: "sales@terradepth.example",
    verified: true,
    price: "$1,150/tonne",
    strata: ["#8FA6A3", "#8FA6A3", "#5C5C52"],
  },
  {
    id: "s3",
    mineral: "Tantalite",
    grade: "Coltan ore, unassayed",
    quantity: "800 kg",
    location: "Kaduna, Nigeria",
    seller: "New listing — pending review",
    contact: "+2348099998888",
    verified: false,
    price: "Negotiable",
    strata: ["#4A4238", "#6B7280"],
  },
];

export default function MarketplacePage() {
  const [listings, setListings] = useState(SEED_LISTINGS);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  const ADMIN_PASSCODE = "stratum2026";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("stratum_listings");
      if (raw) {
        setListings(JSON.parse(raw));
      } else {
        localStorage.setItem("stratum_listings", JSON.stringify(SEED_LISTINGS));
      }
    } catch (e) {}
  }, []);

  const persist = (next) => {
    setListings(next);
    try {
      localStorage.setItem("stratum_listings", JSON.stringify(next));
    } catch (e) {
      console.error("Storage error", e);
    }
  };

  const addListing = (listing) => {
    persist([listing, ...listings]);
  };

  const verifyListing = (id) => {
    persist(listings.map((l) => (l.id === id ? { ...l, verified: true } : l)));
  };

  const rejectListing = (id) => {
    persist(listings.filter((l) => l.id !== id));
  };

  const tryLogin = () => {
    if (passcodeInput === ADMIN_PASSCODE) {
      setIsAdmin(true);
      setShowLogin(false);
      setPasscodeInput("");
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const minerals = ["All", ...Object.keys(MINERAL_COLORS)];
  const visible = listings.filter((l) => {
    const matchesFilter = filter === "All" || l.mineral === filter;
    const matchesSearch =
      search === "" ||
      l.mineral.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase()) ||
      l.grade.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <Header
        isAdmin={isAdmin}
        onToggleAdmin={() => (isAdmin ? setIsAdmin(false) : setShowLogin(true))}
        onAddListing={() => setShowAdd(true)}
      />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <div className="mb-5 space-y-3">
          <SearchBar value={search} onChange={setSearch} />
          <FilterChips minerals={minerals} active={filter} onSelect={setFilter} />
        </div>

        <div className="space-y-3">
          {visible.length === 0 && (
            <div
              className="text-center py-12 text-[#3D4148]/60 text-sm"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              No listings match. Try a different filter, or be the first to list this mineral.
            </div>
          )}
          {visible.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              isAdmin={isAdmin}
              onVerify={verifyListing}
              onReject={rejectListing}
            />
          ))}
        </div>

        <ConsultingBanner />

        <p className="text-center text-[10px] text-[#3D4148]/40 mt-6 font-mono">
          Listings are currently saved on this device only. See README for shared storage setup.
        </p>
      </main>

      {showAdd && <AddListingModal onClose={() => setShowAdd(false)} onAdd={addListing} />}

      {showLogin && (
        <LoginForm
          passcodeInput={passcodeInput}
          setPasscodeInput={setPasscodeInput}
          loginError={loginError}
          setLoginError={setLoginError}
          onSubmit={tryLogin}
          onClose={() => {
            setShowLogin(false);
            setLoginError(false);
            setPasscodeInput("");
          }}
        />
      )}
    </div>
  );
}
