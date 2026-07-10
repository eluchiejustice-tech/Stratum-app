export function contactHref(contact) {
  if (!contact) return null;
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return `mailto:${trimmed}`;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 8) return `https://wa.me/${digits}`;
  return null;
}
