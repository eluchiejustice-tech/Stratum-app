import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import ListingCard from "../components/ListingCard";
import { mapListingRow } from "../utils/mapListingRow";
import { contactHref } from "../utils/contactHref";
import { getProfileById, getApprovedListingsBySeller } from "../services/profiles";
import { useAuthContext } from "../context/AuthContext";

function VerificationStatusBadge({ status }) {
  const s = (status || "unverified").toLowerCase();
  const styles = {
    verified: "bg-[#1F4D3D]/10 text-[#1F4D3D]",
    pending: "bg-[#9c7a1f]/10 text-[#9c7a1f]",
    rejected: "bg-[#8a3b3b]/10 text-[#8a3b3b]",
    unverified: "bg-[#3D4148]/10 text-[#3D4148]/70",
  };
  const label = {
    verified: "Verified seller",
    pending: "Verification pending",
    rejected: "Verification rejected",
    unverified: "Unverified",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded ${
        styles[s] || styles.unverified
      }`}
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <ShieldCheck size={11} />
      {label[s] || label.unverified}
    </span>
  );
}

export default function SellerProfilePage({ sellerId, onBack, onListingClick }) {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [profileRes, listingsRes] = await Promise.all([
        getProfileById(sellerId),
        getApprovedListingsBySeller(sellerId),
      ]);

      if (cancelled) return;

      if (profileRes.error || listingsRes.error) {
        console.error(
          "Failed to load seller profile",
          profileRes.error || listingsRes.error
        );
        setError(true);
        setLoading(false);
        return;
      }

      setProfile(profileRes.data);
      setListings(listingsRes.data || []);
      setLoading(false);
    }

    if (sellerId) load();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  // Mapping logic now lives in utils/mapListingRow.js, shared with
  // MarketplacePage.jsx.
  const cardListings = listings.map(mapListingRow);

  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/70 hover:text-[#15130F] transition mb-6"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <ArrowLeft size={14} /> Back to marketplace
        </button>

        {loading && (
          <div className="text-center py-12 text-[#3D4148]/60">Loading profile…</div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-[#8a3b3b]">
            Couldn't load this seller's profile. Please try again.
          </div>
        )}

        {!loading && !error && !profile && (
          <div className="text-center py-12 text-[#3D4148]/60">
            This seller profile could not be found.
          </div>
        )}

        {!loading && !error && profile && (
          <>
            <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 mb-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-serif text-xl leading-tight">
                    {profile.company || profile.name || "Unnamed seller"}
                  </div>
                  {profile.company && profile.name && (
                    <div
                      className="text-xs text-[#3D4148]/70 mt-0.5"
                      style={{ fontFamily: "system-ui, sans-serif" }}
                    >
                      {profile.name}
                    </div>
                  )}
                </div>
                <VerificationStatusBadge status={profile.verification_status} />
              </div>

              {profile.bio && (
                <p
                  className="text-sm text-[#3D4148] mt-3 leading-relaxed"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {profile.bio}
                </p>
              )}

              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-[#3D4148]"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {profile.location}
                  </span>
                )}

                {!user ? (
                  <span className="text-[#3D4148]/50">Sign in to contact seller</span>
                ) : contactHref(profile.contact) ? (
                  <a
                    href={contactHref(profile.contact)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-[#1F4D3D] text-[#EDE8DC] font-mono uppercase tracking-wide px-3 py-1.5 rounded hover:brightness-110 transition"
                  >
                    <MessageCircle size={13} /> Contact seller
                  </a>
                ) : (
                  <span className="text-[#3D4148]/50">No contact info provided</span>
                )}
              </div>
            </div>

            <div
              className="text-xs font-mono uppercase tracking-wide text-[#3D4148]/60 mb-3"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              Listings from this seller
            </div>

            <div className="space-y-3">
              {cardListings.length === 0 && (
                <div
                  className="text-center py-12 text-[#3D4148]/60"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  This seller has no approved listings yet.
                </div>
              )}

              {cardListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isAdmin={false}
                  isAuthenticated={Boolean(user)}
                  onListingClick={onListingClick}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
