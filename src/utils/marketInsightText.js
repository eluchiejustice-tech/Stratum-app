// Shared phrasing logic for ranked Intelligence API results. Ties are
// never resolved into a false single winner — if two or more entries
// share the top count, all of them are named. Used by both the full
// Market Intelligence page and the Seller Dashboard Market Snapshot,
// so a tie is described identically everywhere it appears.

function joinNames(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function describeTopMinerals(list) {
  if (!list || list.length === 0) return "No listings yet.";
  const topCount = list[0].listing_count;
  const leaders = list.filter((m) => m.listing_count === topCount);

  if (leaders.length === 1) {
    return `${leaders[0].mineral} is currently the most listed mineral, with ${topCount} listing${topCount === 1 ? "" : "s"}.`;
  }
  return `${joinNames(leaders.map((m) => m.mineral))} are currently tied for the most listings, with ${topCount} each.`;
}

export function describeTopState(list) {
  if (!list || list.length === 0) return "No listings yet.";
  const topCount = list[0].listing_count;
  const leaders = list.filter((s) => s.listing_count === topCount);

  if (leaders.length === 1) {
    return `${leaders[0].state} leads with ${topCount} listing${topCount === 1 ? "" : "s"}.`;
  }
  return `${joinNames(leaders.map((s) => s.state))} are tied, with ${topCount} listings each.`;
}
