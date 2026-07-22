{!user ? (
  <span className="text-xs text-[#3D4148]/50 font-mono px-3 py-2">
    Sign in to contact seller
  </span>
) : contactHref(listing.contact) ? (
  <a
    href={contactHref(listing.contact)}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1.5 bg-[#1F4D3D] text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-3 py-2 rounded hover:brightness-110 transition"
  >
    <MessageCircle size={13} /> Contact
  </a>
) : (
  <span className="text-xs text-[#3D4148]/50 font-mono px-3 py-2">
    No contact info
  </span>
)}
