// Converts a raw phone number into the international-format digit
// string wa.me requires (no leading 0, no +, country code included).
// Handles Nigeria's common input shapes:
//   08036142893      -> 2348036142893  (local, leading 0)
//   2348036142893    -> 2348036142893  (already international)
//   +2348036142893   -> 2348036142893  (already international, with +)
// Anything else (already-long non-Nigerian numbers, unrecognized
// shapes) is passed through unchanged rather than guessed at.
function toWhatsAppDigits(rawDigits) {
  if (rawDigits.startsWith("234")) return rawDigits;
  if (rawDigits.startsWith("0")) return `234${rawDigits.slice(1)}`;
  return rawDigits;
}

export function contactHref(contact) {
  if (!contact) return null;
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return `mailto:${trimmed}`;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 8) return `https://wa.me/${toWhatsAppDigits(digits)}`;
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
      { type: "whatsapp", label: "Chat on WhatsApp", href: `https://wa.me/${toWhatsAppDigits(digits)}` },
    ];
  }

  return [];
}
