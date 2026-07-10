export const MINERAL_COLORS = {
  Gold: "#B8922F",
  Lithium: "#8FA6A3",
  Cobalt: "#3D5A80",
  "Rare Earth": "#7A5C61",
  Tantalite: "#4A4238",
  Copper: "#9C5A3C",
  Tin: "#6B7280",
  Other: "#5C5C52",
};

export function bandsFor(mineral) {
  const base = MINERAL_COLORS[mineral] || MINERAL_COLORS.Other;
  return [base, "#6B7280", base];
}
