import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAuth, handleCallback } from "./lib/oauth.mjs";

const ENV = {
  GITHUB_CLIENT_ID: "client-123",
  GITHUB_CLIENT_SECRET: "secret-456",
  ALLOWED_ORIGINS: "https://se-kwt.github.io, https://aiiskwt.com",
};
const PROXY = "https://aiis-oauth.example.netlify.app";

function cookieValue(response, name) {
  const header = response.headers.get("set-cookie") || "";
  const match = header.match(new RegExp(`${name}=([^;]*)`));
  return match ? match[1] : null;
}

test("auth redirects to GitHub with client id, callback URL, scope and state", async () => {
  const res = await handleAuth(new Request(`${PROXY}/auth?provider=github&scope=repo`), ENV);
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get("location"));
  assert.equal(location.origin + location.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(location.searchParams.get("client_id"), "client-123");
  assert.equal(location.searchParams.get("redirect_uri"), `${PROXY}/callback`);
  assert.equal(location.searchParams.get("scope"), "repo");
  const state = location.searchParams.get("state");
  assert.ok(state && state.length >= 16, "state must be an unguessable value");
  assert.equal(cookieValue(res, "oauth_state"), state);
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test("auth uses a fresh state every time", async () => {
  const a = await handleAuth(new Request(`${PROXY}/auth`), ENV);
  const b = await handleAuth(new Request(`${PROXY}/auth`), ENV);
  assert.notEqual(cookieValue(a, "oauth_state"), cookieValue(b, "oauth_state"));
});

test("auth fails clearly when the client id is not configured", async () => {
  const res = await handleAuth(new Request(`${PROXY}/auth`), { ...ENV, GITHUB_CLIENT_ID: "" });
  assert.equal(res.status, 500);
});

test("callback rejects a state that does not match the cookie, without calling GitHub", async () => {
  let called = false;
  const req = new Request(`${PROXY}/callback?code=abc&state=attacker`, {
    headers: { cookie: "oauth_state=legit" },
  });
  const res = await handleCallback(req, ENV, async () => {
    called = true;
    return Response.json({});
  });
  assert.equal(res.status, 400);
  assert.equal(called, false);
});

test("callback rejects a request with no state cookie", async () => {
  const req = new Request(`${PROXY}/callback?code=abc&state=abc`);
  const res = await handleCallback(req, ENV, async () => Response.json({}));
  assert.equal(res.status, 400);
});

test("callback rejects a request with no code", async () => {
  const req = new Request(`${PROXY}/callback?state=abc`, { headers: { cookie: "oauth_state=abc" } });
  const res = await handleCallback(req, ENV, async () => Response.json({}));
  assert.equal(res.status, 400);
});

test("callback exchanges the code and hands the token to Decap, restricted to allowed origins", async () => {
  let seen;
  const req = new Request(`${PROXY}/callback?code=the-code&state=s1`, {
    headers: { cookie: "oauth_state=s1" },
  });
  const res = await handleCallback(req, ENV, async (url, init) => {
    seen = { url, init };
    return Response.json({ access_token: "gho_token", token_type: "bearer" });
  });
  assert.equal(seen.url, "https://github.com/login/oauth/access_token");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.client_id, "client-123");
  assert.equal(body.client_secret, "secret-456");
  assert.equal(body.code, "the-code");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const html = await res.text();
  assert.match(html, /authorizing:github/);
  assert.match(html, /authorization:github:success:/);
  assert.ok(html.includes("gho_token"));
  // token must only ever go to an origin on the allow-list, never "*"
  assert.ok(html.includes("https://se-kwt.github.io"));
  assert.ok(html.includes("https://aiiskwt.com"));
  assert.match(html, /allowed\.includes\(e\.origin\)/);
  // the secret-bearing message is only ever posted to the verified e.origin;
  // the "*" target is used solely for the secret-free "authorizing:github" ping
  assert.match(html, /postMessage\(message, e\.origin\)/);
  assert.equal((html.match(/postMessage\(/g) || []).length, 2);
  assert.match(html, /postMessage\("authorizing:github", "\*"\)/);
  // the one-time state cookie is cleared
  assert.match(res.headers.get("set-cookie"), /oauth_state=;[^]*Max-Age=0/);
});

test("callback reports a GitHub error back to Decap instead of a token", async () => {
  const req = new Request(`${PROXY}/callback?code=bad&state=s1`, {
    headers: { cookie: "oauth_state=s1" },
  });
  const res = await handleCallback(req, ENV, async () =>
    Response.json({ error: "bad_verification_code", error_description: "The code passed is incorrect" }),
  );
  const html = await res.text();
  assert.match(html, /authorization:github:error:/);
  assert.doesNotMatch(html, /authorization:github:success:/);
});

test("callback reports an error when GitHub is unreachable", async () => {
  const req = new Request(`${PROXY}/callback?code=x&state=s1`, {
    headers: { cookie: "oauth_state=s1" },
  });
  const res = await handleCallback(req, ENV, async () => {
    throw new Error("network down");
  });
  const html = await res.text();
  assert.match(html, /authorization:github:error:/);
});

test("token and origins are escaped so they cannot break out of the script block", async () => {
  const req = new Request(`${PROXY}/callback?code=x&state=s1`, {
    headers: { cookie: "oauth_state=s1" },
  });
  const res = await handleCallback(req, ENV, async () =>
    Response.json({ access_token: "</script><script>alert(1)</script>" }),
  );
  const html = await res.text();
  assert.doesNotMatch(html, /<\/script><script>alert/);
});
