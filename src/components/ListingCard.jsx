import { MapPin, Image as ImageIcon, MessageCircle, Check, Trash2 } from "lucide-react";
import CoreSample from "./CoreSample";
import VerifiedBadge from "./VerifiedBadge";
import { contactHref } from "../utils/contactHref";

export default function ListingCard({ listing, isAdmin, onVerify, onReject, onSellerClick }) {
  const l = listing;
  const sellerLabel = l.company || l.seller;
  const canOpenSellerProfile = Boolean(onSellerClick && l.sellerId);

  return (
    <div className="bg-white rounded-lg p-4 flex gap-4 shadow-sm border border-[#3D4148]/10">
      <CoreSample bands={l.strata} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-serif text-base leading-tight">{l.mineral}</div>
            <div
              className="text-xs text-[#3D4148]/80 mt-0.5"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {l.grade}
            </div>
          </div>
          <VerifiedBadge verified={l.verified} />
        </div>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-[#3D4148]"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <span className="font-mono">{l.quantity}</span>
          <span className="flex items-center gap-1">
            <MapPin size={11} /> {l.location}
          </span>
          {l.photoUrl && (
            <a
              href={l.photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#1F4D3D] underline"
            >
              <ImageIcon size={11} /> Photo/report
            </a>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            {canOpenSellerProfile ? (
              <button
                onClick={() => onSellerClick(l.sellerId)}
                title="View seller profile"
                className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50 hover:text-[#1F4D3D] hover:underline transition text-left"
              >
                {sellerLabel}
              </button>
            ) : (
              <div className="text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/50">
                {sellerLabel}
              </div>
            )}
            <div className="text-sm font-mono text-[#1F4D3D] mt-0.5">{l.price}</div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !l.verified && (
              <button
                onClick={() => onVerify(l.id)}
                title="Approve listing"
                className="flex items-center gap-1 bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-2.5 py-2 rounded hover:brightness-110 transition"
              >
                <Check size={13} />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onReject(l.id)}
                title="Remove listing"
                className="flex items-center gap-1 bg-[#8a3b3b] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-2.5 py-2 rounded hover:brightness-110 transition"
              >
                <Trash2 size={13} />
              </button>
            )}
            {contactHref(l.contact) ? (
              <a
                href={contactHref(l.contact)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
              >
                <MessageCircle size={13} /> Contact
              </a>
            ) : (
              <span className="text-xs text-[#3D4148]/50 font-mono px-3 py-2">No contact info</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
