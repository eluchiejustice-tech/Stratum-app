// api/metals-price.js
//
// Stratum Phase 7E.3 — Metals-API provider adapter (Vercel Serverless Function).
//
// Scope (per approved 7E.3 design):
//   - Fetch Metals-API server-side (METALS_API_KEY never leaves the server).
//   - Parse and normalize provider values.
//   - Return the normalized result to the caller.
//
// Explicitly OUT of scope for 7E.3:
//   - No Supabase client, no database writes, no benchmark_snapshots inserts.
//   - No benchmark_definitions changes.
//   - No frontend/UI wiring.
//
// Confirmed symbol facts (verified against Metals-API primary documentation,
// August 2026):
//   - LBXAUAM / LBXAUPM (LBMA Gold AM/PM fixing) return DIRECT USD-per-ounce
//     prices. They must NOT be inverted, unlike the generic XAU currency-style
//     rate (which requires 1/value).
//   - LME-XCU / LME-TIN (LME Copper/Tin cash settlement) are quoted per troy
//     ounce and are normalized to per-metric-ton via × 32150, per the
//     approved 7E.1 benchmark_snapshots design.

const METALS_API_BASE_URL = "https://metals-api.com/api/latest";

const GOLD_SYMBOLS = new Set(["LBXAUAM", "LBXAUPM"]);
const LME_SYMBOLS = new Set(["LME-XCU", "LME-TIN"]);
const SUPPORTED_SYMBOLS = new Set([...GOLD_SYMBOLS, ...LME_SYMBOLS]);

const LME_CONVERSION_FACTOR = 32150;

// Plausibility safeguard (anomaly detector, not a correction mechanism).
// A direct USD-per-troy-ounce Gold fixing has never been within an order of
// magnitude of these bounds when inverted (inverted values look like
// 0.0003–0.0006). Values outside this range are rejected rather than stored,
// so a provider-side unit change or an accidental inversion fails loudly
// instead of silently corrupting downstream data.
const GOLD_PLAUSIBLE_MIN = 10;
const GOLD_PLAUSIBLE_MAX = 100000;

class MetalsApiAdapterError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "MetalsApiAdapterError";
    this.code = code;
  }
}

/**
 * Determines whether a raw provider price for a Gold symbol is plausible
 * as a direct USD-per-ounce value. Pure function, no I/O.
 */
function isPlausibleGoldPrice(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= GOLD_PLAUSIBLE_MIN &&
    value <= GOLD_PLAUSIBLE_MAX
  );
}

/**
 * Normalizes a single symbol/price pair according to the approved 7E.1
 * design. Pure function, no I/O, no side effects.
 *
 * Gold: normalized_price = provider_price, conversion_factor = null (direct,
 *       no inversion).
 * Copper/Tin: normalized_price = provider_price * 32150,
 *       conversion_factor = 32150.
 *
 * Throws MetalsApiAdapterError for unsupported symbols, malformed prices, or
 * (for Gold) values that fail the plausibility safeguard.
 */
function normalizeSymbolPrice(symbol, providerPrice, providerUnit) {
  if (!SUPPORTED_SYMBOLS.has(symbol)) {
    throw new MetalsApiAdapterError(
      `Unsupported symbol: ${symbol}`,
      "UNSUPPORTED_SYMBOL"
    );
  }

  if (typeof providerPrice !== "number" || !Number.isFinite(providerPrice)) {
    throw new MetalsApiAdapterError(
      `Malformed provider_price for ${symbol}`,
      "MALFORMED_PRICE"
    );
  }

  if (GOLD_SYMBOLS.has(symbol)) {
    if (!isPlausibleGoldPrice(providerPrice)) {
      throw new MetalsApiAdapterError(
        `Implausible Gold price for ${symbol}: ${providerPrice}. ` +
          `Expected a direct USD-per-ounce value in range ` +
          `[${GOLD_PLAUSIBLE_MIN}, ${GOLD_PLAUSIBLE_MAX}]. Rejected rather ` +
          `than stored — this may indicate an inverted/garbage provider value.`,
        "IMPLAUSIBLE_GOLD_PRICE"
      );
    }

    return {
      symbol,
      provider_price: providerPrice,
      provider_unit: providerUnit ?? "per ounce",
      normalized_price: providerPrice,
      normalized_unit: "USD per troy ounce",
      conversion_factor: null,
    };
  }

  // Copper / Tin (LME)
  return {
    symbol,
    provider_price: providerPrice,
    provider_unit: providerUnit ?? "per troy ounce",
    normalized_price: providerPrice * LME_CONVERSION_FACTOR,
    normalized_unit: "USD per metric ton",
    conversion_factor: LME_CONVERSION_FACTOR,
  };
}

/**
 * Parses a raw Metals-API /latest response body into normalized results,
 * one entry per requested symbol. Symbols that individually fail (missing,
 * malformed, or implausible) are reported per-symbol rather than aborting
 * the whole batch, so a partial provider failure doesn't discard valid data.
 *
 * Pure function, no I/O.
 */
function parseProviderResponse(rawBody, requestedSymbols) {
  if (rawBody == null || typeof rawBody !== "object") {
    throw new MetalsApiAdapterError(
      "Malformed provider response: not a JSON object",
      "MALFORMED_RESPONSE"
    );
  }

  if (rawBody.success !== true) {
    const info =
      rawBody.error && typeof rawBody.error === "object"
        ? rawBody.error.info
        : undefined;
    throw new MetalsApiAdapterError(
      `Provider reported failure${info ? `: ${info}` : ""}`,
      "PROVIDER_ERROR"
    );
  }

  const rates = rawBody.rates;
  if (rates == null || typeof rates !== "object") {
    throw new MetalsApiAdapterError(
      "Malformed provider response: missing rates object",
      "MALFORMED_RESPONSE"
    );
  }

  const results = [];
  const failures = [];

  for (const symbol of requestedSymbols) {
    const providerPrice = rates[symbol];

    if (providerPrice === undefined) {
      failures.push({ symbol, reason: "missing from provider response" });
      continue;
    }

    try {
      const normalized = normalizeSymbolPrice(
        symbol,
        providerPrice,
        rawBody.unit
      );
      results.push(normalized);
    } catch (err) {
      if (err instanceof MetalsApiAdapterError) {
        failures.push({ symbol, reason: err.message, code: err.code });
      } else {
        throw err;
      }
    }
  }

  return { results, failures };
}

/**
 * Fetches and normalizes prices for the given symbols. `fetchImpl` is
 * injectable for testing; defaults to the global fetch (Node 18+/Vercel
 * runtime).
 *
 * The API key is read from process.env only, never hardcoded, and never
 * included in the returned value or in any thrown error message.
 */
async function fetchMetalsPrices(symbols, fetchImpl = fetch) {
  const apiKey = process.env.METALS_API_KEY;
  if (!apiKey) {
    // Deliberately generic — never state key presence/absence details that
    // could aid probing, and never echo env var contents.
    throw new MetalsApiAdapterError(
      "Metals-API is not configured on the server.",
      "MISSING_API_KEY"
    );
  }

  const invalidSymbols = symbols.filter((s) => !SUPPORTED_SYMBOLS.has(s));
  if (invalidSymbols.length > 0) {
    throw new MetalsApiAdapterError(
      `Unsupported symbol(s) requested: ${invalidSymbols.join(", ")}`,
      "UNSUPPORTED_SYMBOL"
    );
  }

  const url = new URL(METALS_API_BASE_URL);
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("base", "USD");
  url.searchParams.set("symbols", symbols.join(","));

  let response;
  try {
    response = await fetchImpl(url.toString());
  } catch (err) {
    // Never include the URL (which contains the key) in error output.
    throw new MetalsApiAdapterError(
      "Network error contacting Metals-API.",
      "NETWORK_ERROR"
    );
  }

  if (!response.ok) {
    throw new MetalsApiAdapterError(
      `Metals-API request failed with status ${response.status}`,
      "HTTP_ERROR"
    );
  }

  const rawBody = await response.json();
  return parseProviderResponse(rawBody, symbols);
}

/**
 * Vercel Serverless Function entrypoint.
 * GET /api/metals-price?symbols=LBXAUAM,LBXAUPM,LME-XCU,LME-TIN
 *
 * Adapter-only: fetches, parses, normalizes, and returns. Performs no
 * database writes of any kind.
 */
module.exports = async function handler(req, res) {
  const symbolsParam = req.query?.symbols;
  const symbols = symbolsParam
    ? String(symbolsParam)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [...SUPPORTED_SYMBOLS];

  try {
    const { results, failures } = await fetchMetalsPrices(symbols);
    res.status(200).json({
      success: true,
      results,
      failures,
    });
  } catch (err) {
    const message =
      err instanceof MetalsApiAdapterError
        ? err.message
        : "Unexpected adapter error.";
    // Never leak raw provider responses or the API key in error output.
    res.status(502).json({ success: false, error: message });
  }
};

// Named exports for isolated unit testing.
module.exports.normalizeSymbolPrice = normalizeSymbolPrice;
module.exports.parseProviderResponse = parseProviderResponse;
module.exports.isPlausibleGoldPrice = isPlausibleGoldPrice;
module.exports.fetchMetalsPrices = fetchMetalsPrices;
module.exports.MetalsApiAdapterError = MetalsApiAdapterError;
module.exports.SUPPORTED_SYMBOLS = SUPPORTED_SYMBOLS;
module.exports.LME_CONVERSION_FACTOR = LME_CONVERSION_FACTOR;
