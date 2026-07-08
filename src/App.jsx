import { useState, useEffect } from "react";
import { Plus, MapPin, Shield, X, Search, Layers, MessageCircle, Lock, Unlock, Check, Trash2 } from "lucide-react";

const MINERAL_COLORS = {
  Gold: "#B8922F",
  Lithium: "#8FA6A3",
  Cobalt: "#3D5A80",
  "Rare Earth": "#7A5C61",
  Tantalite: "#4A4238",
  Copper: "#9C5A3C",
  Tin: "#6B7280",
  Other: "#5C5C52",
};

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

function contactHref(contact) {
  if (!contact) return null;
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return `mailto:${trimmed}`;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 8) return `https://wa.me/${digits}`;
  return null;
}

function CoreSample({ bands }) {
  return (
    <div className="flex gap-[2px] h-16 w-6 rounded-sm overflow-hidden shrink-0 shadow-inner">
      {bands.map((c, i) => (
        <div key={i} style={{ backgroundColor: c }} className="flex-1" />
      ))}
    </div>
  );
}

function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide text-[#1F4D3D] bg-[#1F4D3D]/10 px-2 py-0.5 rounded">
      <Shield size={11} strokeWidth={2.5} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide text-[#8a6d1a] bg-[#B8922F]/15 px-2 py-0.5 rounded">
      Pending review
    </span>
  );
}

function AddListingModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    mineral: "Gold",
    grade: "",
    quantity: "",
    location: "",
    seller: "",
    contact: "",
    price: "",
  });

  const bandsFor = (mineral) => {
    const base = MINERAL_COLORS[mineral] || MINERAL_COLORS.Other;
    return [base, "#6B7280", base];
  };

  const submit = () => {
    if (!form.grade || !form.quantity || !form.location || !form.seller || !form.contact) return;
    onAdd({
      id: "l" + Date.now(),
      ...form,
      verified: false,
      strata: bandsFor(form.mineral),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#EDE8DC] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-[#15130F]">New listing</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Mineral</label>
            <select
              value={form.mineral}
              onChange={(e) => setForm({ ...form, mineral: e.target.value })}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            >
              {Object.keys(MINERAL_COLORS).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Grade / spec</label>
            <input
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              placeholder="e.g. 91.6% purity, unassayed"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Quantity</label>
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="e.g. 2.5 kg, 40 tonnes"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Region, country"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Seller / company name</label>
            <input
              value={form.seller}
              onChange={(e) => setForm({ ...form, seller: e.target.value })}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Contact (phone or email)</label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="e.g. +234... or you@company.com"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Price</label>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="e.g. $1,150/tonne or Negotiable"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={submit}
          className="w-full mt-5 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148] transition"
        >
          Submit for review
        </button>
        <p className="text-xs text-[#3D4148]/70 mt-2 text-center">
          New listings show as "Pending review" until your team verifies them.
        </p>
      </div>
    </div>
  );
}export default function MineralMarketplace() {
  const [listings, setListings] = useState(SEED_LISTINGS);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  // Simple team passcode for verify/reject access. This is a lightweight
  // workflow gate, not real security — swap for real auth once you have a backend.
  const ADMIN_PASSCODE = "stratum2026";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("stratum_listings");
      if (raw) {
        setListings(JSON.parse(raw));
      } else {
        localStorage.setItem("stratum_listings", JSON.stringify(SEED_LISTINGS));
      }
    } catch (e) {
      // localStorage unavailable, keep seed listings in memory
    }
    setLoaded(true);
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
    <div className="min-h-screen bg-[#EDE8DC] text-[#15130F]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Header */}
      <header className="bg-[#15130F] text-[#EDE8DC] px-5 py-5 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={22} className="text-[#B8922F]" strokeWidth={1.5} />
            <div>
              <div className="font-serif text-lg leading-none tracking-tight">Stratum</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#EDE8DC]/50">
                Ore Ledger · Solid mineral exchange
              </div>
            </div>
          </div>
          <div className="fle
