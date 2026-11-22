// Minimal GitHub OAuth provider for Decap CMS ("external OAuth client").
//
// Decap's GitHub backend opens a popup at `<base_url>/auth`, which must send
// the editor to GitHub; GitHub then returns to `<base_url>/callback`, which
// exchanges the code for a token and hands it back to the opener window with
// a `postMessage`. These two handlers implement exactly that and nothing else.
// They are plain `(Request, env) => Response` functions so they are host
// agnostic and unit-testable; the files in `netlify/functions/` are thin
// adapters.
//
// Required env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
//               ALLOWED_ORIGINS (comma-separated origins of the CMS, e.g.
//               "https://se-kwt.github.io,https://aiiskwt.com").
// Optional env: OAUTH_SCOPE (default "repo").

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE_SECONDS = 600;

function text(status, body) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// JSON that is safe to inline inside a <script> block.
function inlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function stateCookie(value, maxAge) {
  return `${STATE_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export async function handleAuth(request, env) {
  if (!env.GITHUB_CLIENT_ID) return text(500, "OAuth proxy is not configured: GITHUB_CLIENT_ID is missing.");

  const url = new URL(request.url);
  const state = randomState();
  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/callback`);
  authorize.searchParams.set("scope", env.OAUTH_SCOPE || "repo");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": stateCookie(state, STATE_MAX_AGE_SECONDS),
      "cache-control": "no-store",
    },
  });
}

function resultPage(origins, status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body>
<p>Authorizing, you can close this window if it does not close by itself.</p>
<script>
(function () {
  var allowed = ${inlineJson(origins)};
  var message = ${inlineJson(message)};
  function receiveMessage(e) {
    if (!allowed.includes(e.origin)) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": stateCookie("", 0),
    },
  });
}

export async function handleCallback(request, env, fetchImpl = fetch) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return text(500, "OAuth proxy is not configured: GitHub client id/secret are missing.");
  }
  const origins = allowedOrigins(env);
  if (origins.length === 0) return text(500, "OAuth proxy is not configured: ALLOWED_ORIGINS is missing.");

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expected = readCookie(request, STATE_COOKIE);

  if (!expected || !state || state !== expected) return text(400, "Invalid or expired login state. Please try again.");
  if (!code) return text(400, "Missing authorization code.");

  let data;
  try {
    const response = await fetchImpl(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    data = await response.json();
  } catch (error) {
    return resultPage(origins, "error", { message: "Could not reach GitHub to complete login." });
  }

  if (!data || data.error || !data.access_token) {
    return resultPage(origins, "error", {
      message: (data && (data.error_description || data.error)) || "GitHub did not return an access token.",
    });
  }
  return resultPage(origins, "success", { token: data.access_token, provider: "github" });
}
