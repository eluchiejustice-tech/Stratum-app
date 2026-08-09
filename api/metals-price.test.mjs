// api/metals-price.test.mjs
//
// Isolated unit tests for the Stratum Phase 7E.3 Metals-API adapter.
// Run with: node --test api/metals-price.test.mjs
//
// These tests exercise pure functions and an injected fake fetch — no real
// network calls, no real API key, no database access of any kind.

import { test } from "node:test";
import assert from "node:assert/strict";
import adapter from "./metals-price.js";

const {
  normalizeSymbolPrice,
  parseProviderResponse,
  isPlausibleGoldPrice,
  fetchMetalsPrices,
  MetalsApiAdapterError,
  LME_CONVERSION_FACTOR,
} = adapter;

// ---------------------------------------------------------------------------
// Gold direct-price regression (AM)
// ---------------------------------------------------------------------------
test("Gold AM (LBXAUAM): documented direct USD/oz value is preserved, not inverted", () => {
  const result = normalizeSymbolPrice("LBXAUAM", 2650.45, "per ounce");
  assert.equal(result.provider_price, 2650.45);
  assert.equal(result.normalized_price, 2650.45);
  assert.equal(result.conversion_factor, null);
  assert.notEqual(result.normalized_price, 1 / 2650.45); // must not be inverted
});

// ---------------------------------------------------------------------------
// Gold AM/PM separation
// ---------------------------------------------------------------------------
test("Gold PM (LBXAUPM): direct USD/oz value is preserved, not inverted, and distinct from AM", () => {
  const am = normalizeSymbolPrice("LBXAUAM", 4301.85, "per ounce");
  const pm = normalizeSymbolPrice("LBXAUPM", 4335.55, "per ounce");

  assert.equal(am.provider_price, 4301.85);
  assert.equal(am.normalized_price, 4301.85);
  assert.equal(am.conversion_factor, null);

  assert.equal(pm.provider_price, 4335.55);
  assert.equal(pm.normalized_price, 4335.55);
  assert.equal(pm.conversion_factor, null);

  // AM and PM must be tracked as independent, non-colliding values.
  assert.notEqual(am.normalized_price, pm.normalized_price);
  assert.equal(am.symbol, "LBXAUAM");
  assert.equal(pm.symbol, "LBXAUPM");
});

// ---------------------------------------------------------------------------
// Copper normalization
// ---------------------------------------------------------------------------
test("Copper (LME-XCU): normalized_price = provider_price * 32150, provider_price untouched", () => {
  const result = normalizeSymbolPrice("LME-XCU", 0.4429, "per troy ounce");
  assert.equal(result.provider_price, 0.4429);
  assert.equal(result.conversion_factor, LME_CONVERSION_FACTOR);
  assert.ok(
    Math.abs(result.normalized_price - 0.4429 * 32150) < 1e-9,
    `expected ~${0.4429 * 32150}, got ${result.normalized_price}`
  );
});

// ---------------------------------------------------------------------------
// Tin normalization
// ---------------------------------------------------------------------------
test("Tin (LME-TIN): normalized_price = provider_price * 32150, provider_price untouched", () => {
  const result = normalizeSymbolPrice("LME-TIN", 1.7449, "per troy ounce");
  assert.equal(result.provider_price, 1.7449);
  assert.equal(result.conversion_factor, LME_CONVERSION_FACTOR);
  assert.ok(
    Math.abs(result.normalized_price - 1.7449 * 32150) < 1e-9,
    `expected ~${1.7449 * 32150}, got ${result.normalized_price}`
  );
});

// ---------------------------------------------------------------------------
// Missing symbol in provider response
// ---------------------------------------------------------------------------
test("parseProviderResponse: a symbol absent from provider rates is reported as a failure, not a crash", () => {
  const rawBody = {
    success: true,
    base: "USD",
    date: "2026-08-09",
    rates: { LBXAUAM: 4301.85 }, // LBXAUPM missing
  };

  const { results, failures } = parseProviderResponse(rawBody, [
    "LBXAUAM",
    "LBXAUPM",
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].symbol, "LBXAUAM");
  assert.equal(failures.length, 1);
  assert.equal(failures[0].symbol, "LBXAUPM");
  assert.match(failures[0].reason, /missing/);
});

// ---------------------------------------------------------------------------
// Null / malformed response
// ---------------------------------------------------------------------------
test("parseProviderResponse: null body throws MetalsApiAdapterError", () => {
  assert.throws(
    () => parseProviderResponse(null, ["LBXAUAM"]),
    MetalsApiAdapterError
  );
});

test("parseProviderResponse: success:false body throws MetalsApiAdapterError", () => {
  assert.throws(
    () =>
      parseProviderResponse(
        { success: false, error: { code: 429, info: "quota exceeded" } },
        ["LBXAUAM"]
      ),
    /quota exceeded/
  );
});

test("parseProviderResponse: missing rates object throws MetalsApiAdapterError", () => {
  assert.throws(
    () => parseProviderResponse({ success: true }, ["LBXAUAM"]),
    /missing rates/
  );
});

test("normalizeSymbolPrice: non-numeric provider_price throws MetalsApiAdapterError", () => {
  assert.throws(
    () => normalizeSymbolPrice("LBXAUAM", "not-a-number", "per ounce"),
    MetalsApiAdapterError
  );
  assert.throws(
    () => normalizeSymbolPrice("LBXAUAM", null, "per ounce"),
    MetalsApiAdapterError
  );
});

// ---------------------------------------------------------------------------
// Partial symbol failure (mixed valid + invalid in one batch)
// ---------------------------------------------------------------------------
test("parseProviderResponse: partial failure does not discard valid symbols in the same batch", () => {
  const rawBody = {
    success: true,
    base: "USD",
    date: "2026-08-09",
    rates: {
      LBXAUAM: 4301.85, // valid
      LBXAUPM: 0.00023, // implausible (looks inverted)
      "LME-XCU": 0.4429, // valid
      // LME-TIN missing entirely
    },
  };

  const { results, failures } = parseProviderResponse(rawBody, [
    "LBXAUAM",
    "LBXAUPM",
    "LME-XCU",
    "LME-TIN",
  ]);

  const resultSymbols = results.map((r) => r.symbol).sort();
  assert.deepEqual(resultSymbols, ["LBXAUAM", "LME-XCU"]);

  const failureSymbols = failures.map((f) => f.symbol).sort();
  assert.deepEqual(failureSymbols, ["LBXAUPM", "LME-TIN"]);

  const pmFailure = failures.find((f) => f.symbol === "LBXAUPM");
  assert.equal(pmFailure.code, "IMPLAUSIBLE_GOLD_PRICE");

  const tinFailure = failures.find((f) => f.symbol === "LME-TIN");
  assert.match(tinFailure.reason, /missing/);
});

// ---------------------------------------------------------------------------
// Implausible Gold value (anomaly-detector safeguard)
// ---------------------------------------------------------------------------
test("isPlausibleGoldPrice: rejects generic-XAU-style inverted values", () => {
  assert.equal(isPlausibleGoldPrice(0.0004831705), false); // classic inverted XAU shape
  assert.equal(isPlausibleGoldPrice(0.00023), false);
});

test("isPlausibleGoldPrice: accepts realistic direct USD/oz values", () => {
  assert.equal(isPlausibleGoldPrice(41.95), true); // 1968 LBMA fixing
  assert.equal(isPlausibleGoldPrice(2650.45), true);
  assert.equal(isPlausibleGoldPrice(4335.55), true);
});

test("normalizeSymbolPrice: implausible Gold value is rejected, not silently corrected", () => {
  assert.throws(
    () => normalizeSymbolPrice("LBXAUAM", 0.0004831705, "per ounce"),
    (err) => err instanceof MetalsApiAdapterError && err.code === "IMPLAUSIBLE_GOLD_PRICE"
  );
});

test("normalizeSymbolPrice: implausible safeguard does not apply to Copper/Tin", () => {
  // A very small provider_price is normal for LME symbols quoted per troy
  // ounce pre-conversion; the Gold-only safeguard must not fire here.
  const result = normalizeSymbolPrice("LME-XCU", 0.0004429, "per troy ounce");
  assert.equal(result.provider_price, 0.0004429);
  assert.equal(result.conversion_factor, LME_CONVERSION_FACTOR);
});

// ---------------------------------------------------------------------------
// Unsupported symbol
// ---------------------------------------------------------------------------
test("normalizeSymbolPrice: unsupported symbol (e.g. generic XAU) is rejected", () => {
  assert.throws(
    () => normalizeSymbolPrice("XAU", 0.0004831705, "per ounce"),
    (err) => err instanceof MetalsApiAdapterError && err.code === "UNSUPPORTED_SYMBOL"
  );
});

// ---------------------------------------------------------------------------
// Secret exposure checks
// ---------------------------------------------------------------------------
test("fetchMetalsPrices: throws a generic error (no key details) when METALS_API_KEY is unset", async () => {
  const originalKey = process.env.METALS_API_KEY;
  delete process.env.METALS_API_KEY;
  try {
    await assert.rejects(
      () => fetchMetalsPrices(["LBXAUAM"], async () => {
        throw new Error("fetch should not be called without an API key");
      }),
      (err) => {
        assert.ok(err instanceof MetalsApiAdapterError);
        assert.equal(err.code, "MISSING_API_KEY");
        // The error message must not echo any env var value.
        assert.doesNotMatch(err.message, /METALS_API_KEY=/);
        return true;
      }
    );
  } finally {
    if (originalKey !== undefined) process.env.METALS_API_KEY = originalKey;
  }
});

test("fetchMetalsPrices: the request URL (containing the key) never appears in a thrown error message", async () => {
  const originalKey = process.env.METALS_API_KEY;
  process.env.METALS_API_KEY = "test-fake-key-do-not-leak-1234567890";
  try {
    const fakeFetch = async () => {
      throw new Error("simulated network failure");
    };
    await assert.rejects(
      () => fetchMetalsPrices(["LBXAUAM"], fakeFetch),
      (err) => {
        assert.ok(err instanceof MetalsApiAdapterError);
        assert.equal(err.code, "NETWORK_ERROR");
        assert.doesNotMatch(err.message, /test-fake-key-do-not-leak-1234567890/);
        assert.doesNotMatch(err.message, /access_key/);
        return true;
      }
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.METALS_API_KEY = originalKey;
    } else {
      delete process.env.METALS_API_KEY;
    }
  }
});

test("fetchMetalsPrices: rejects unsupported symbols before making any network call", async () => {
  const originalKey = process.env.METALS_API_KEY;
  process.env.METALS_API_KEY = "test-fake-key";
  try {
    let fetchCalled = false;
    const fakeFetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({}) };
    };
    await assert.rejects(
      () => fetchMetalsPrices(["XAU"], fakeFetch),
      (err) => err instanceof MetalsApiAdapterError && err.code === "UNSUPPORTED_SYMBOL"
    );
    assert.equal(fetchCalled, false);
  } finally {
    if (originalKey !== undefined) {
      process.env.METALS_API_KEY = originalKey;
    } else {
      delete process.env.METALS_API_KEY;
    }
  }
});

test("fetchMetalsPrices: end-to-end with a fake fetch returns normalized results for all four symbols", async () => {
  const originalKey = process.env.METALS_API_KEY;
  process.env.METALS_API_KEY = "test-fake-key";
  try {
    const fakeFetch = async (urlString) => {
      // Confirm the key is being sent to the provider, but never returned.
      assert.match(urlString, /access_key=test-fake-key/);
      return {
        ok: true,
        json: async () => ({
          success: true,
          base: "USD",
          date: "2026-08-09",
          rates: {
            LBXAUAM: 4301.85,
            LBXAUPM: 4335.55,
            "LME-XCU": 0.4429,
            "LME-TIN": 1.7449,
          },
        }),
      };
    };

    const { results, failures } = await fetchMetalsPrices(
      ["LBXAUAM", "LBXAUPM", "LME-XCU", "LME-TIN"],
      fakeFetch
    );

    assert.equal(failures.length, 0);
    assert.equal(results.length, 4);

    const bySymbol = Object.fromEntries(results.map((r) => [r.symbol, r]));
    assert.equal(bySymbol.LBXAUAM.normalized_price, 4301.85);
    assert.equal(bySymbol.LBXAUPM.normalized_price, 4335.55);
    assert.equal(bySymbol.LBXAUAM.conversion_factor, null);
    assert.equal(bySymbol.LBXAUPM.conversion_factor, null);
    assert.ok(Math.abs(bySymbol["LME-XCU"].normalized_price - 0.4429 * 32150) < 1e-9);
    assert.ok(Math.abs(bySymbol["LME-TIN"].normalized_price - 1.7449 * 32150) < 1e-9);
  } finally {
    if (originalKey !== undefined) {
      process.env.METALS_API_KEY = originalKey;
    } else {
      delete process.env.METALS_API_KEY;
    }
  }
});

// ---------------------------------------------------------------------------
// No source-level hardcoded key (static check against this repo's own file)
// ---------------------------------------------------------------------------
test("source file contains no hardcoded API key literal", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(
    new URL("./metals-price.js", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /METALS_API_KEY\s*=\s*["'][^"']+["']/);
  assert.match(source, /process\.env\.METALS_API_KEY/);
  assert.doesNotMatch(source, /console\.(log|error|warn)\(/);
});
