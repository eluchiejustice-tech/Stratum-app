import { useState, useEffect, useCallback } from "react";
import { getListings } from "../services/listings";

// Not yet used anywhere. Will replace the SEED_LISTINGS + localStorage
// state currently living in pages/MarketplacePage.jsx during Stage 4.
export function useListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getListings();
    if (error) setError(error);
    else setListings(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { listings, loading, error, refresh };
}
