export function contactHref(contact) {
  if (!contact) return null;
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return `mailto:${trimmed}`;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 8) return `https://wa.me/${digits}`;
  return null;
}

// Returns an array of contact action options for a given raw contact value.
// Used to render "Call Seller" / "Chat on WhatsApp" / "Email Seller" buttons.
// A phone-shaped value yields both a call option and a WhatsApp option,
// since most sellers' WhatsApp number is the same as their phone number.
// Returns an empty array if the value is missing or doesn't parse as
// either an email or a phone number.
export function getContactOptions(contact) {
  if (!contact) return [];
  const trimmed = contact.trim();

  if (trimmed.includes("@")) {
    return [{ type: "email", label: "Email Seller", href: `mailto:${trimmed}` }];
  }

  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 8) {
    return [
      { type: "call", label: "Call Seller", href: `tel:${digits}` },
      { type: "whatsapp", label: "Chat on WhatsApp", href: `https://wa.me/${digits}` },
    ];
  }

  return [];
}
