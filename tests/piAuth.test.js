import test from "node:test";
import assert from "node:assert/strict";
import { authenticateWithPi } from "../src/services/piAuth.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});

test("uses only App Studio's verified identity, not browser-supplied Pi identity", async () => {
  let initFinished = false;
  let request;
  globalThis.window = { Pi: {
    async init(options) { assert.deepEqual(options, { version: "2.0" }); await Promise.resolve(); initFinished = true; },
    async authenticate(scopes, onIncompletePaymentFound) {
      assert.equal(initFinished, true, "Pi.init must finish before authenticate");
      assert.deepEqual(scopes, ["username"]);
      assert.equal(typeof onIncompletePaymentFound, "function");
      return { accessToken: "pi-access-token", uid: "attacker-uid", username: "attacker-name" };
    },
  } };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, async json() { return { sessionToken: "verified-session", user: { uid: "verified-uid", username: "verified-name" } }; } };
  };

  const session = await authenticateWithPi();
  assert.equal(request.url, "https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login");
  assert.deepEqual(JSON.parse(request.options.body), { accessToken: "pi-access-token" });
  assert.deepEqual(session, { sessionToken: "verified-session", user: { uid: "verified-uid", username: "verified-name" } });
});

test("fails closed when the Pi SDK is not loaded", async () => {
  globalThis.window = {};
  await assert.rejects(authenticateWithPi(), /Pi SDK is unavailable/);
});
