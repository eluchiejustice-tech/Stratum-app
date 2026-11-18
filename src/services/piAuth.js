const APP_STUDIO_LOGIN_URL = "https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login";

function getPiSdk() {
  if (typeof window === "undefined" || !window.Pi) {
    throw new Error("Pi SDK is unavailable. Open Stratum in Pi Browser and try again.");
  }
  return window.Pi;
}

export async function authenticateWithPi() {
  const pi = getPiSdk();

  // Pi.init must finish before authenticate is invoked.
  await pi.init({ version: "2.0" });

  const authResult = await pi.authenticate(
    ["username"],
    (payment) => {
      // Stratum does not request payments during sign-in. Keep this callback
      // visible for the SDK's incomplete-payment notification contract.
      console.warn("Pi reported an incomplete payment during authentication.", payment);
    }
  );

  const accessToken = authResult?.accessToken;
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Pi Network did not return an access token.");
  }

  // This is the only identity exchange. Never trust uid/username returned
  // alongside Pi.authenticate(); App Studio validates the access token and
  // supplies the authoritative identity for this app.
  const response = await fetch(APP_STUDIO_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "App Studio could not verify this Pi account.");
  }
  if (!payload?.sessionToken || !payload?.user?.uid || !payload?.user?.username) {
    throw new Error("App Studio returned an incomplete Pi session.");
  }

  // The token is held only in React memory; it is not written to storage.
  return {
    sessionToken: payload.sessionToken,
    user: {
      uid: payload.user.uid,
      username: payload.user.username,
    },
  };
}
